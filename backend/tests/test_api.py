# End-to-end checks over the HTTP API, against a throwaway database.
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

WORKSPACE = tempfile.mkdtemp(prefix="gramvision-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(WORKSPACE) / 'test.db'}"
os.environ["UPLOAD_DIR"] = str(Path(WORKSPACE) / "uploads")

from app.main import app  # noqa: E402  (imported after the test settings are in place)

ACCOUNT = {"name": "Test Analyst", "email": "analyst@example.com", "password": "surat-pass-2026"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def auth(client):
    response = client.post("/api/auth/register", json=ACCOUNT)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_reports_the_bundled_dataset(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["builtin_datasets"][0]["present"] is True


def test_the_api_refuses_anonymous_requests(client):
    assert client.get("/api/builtin/surat/preview").status_code == 401


def test_default_charts_need_no_upload(client, auth):
    """The point of the built-in source: data to chart the moment you sign in."""
    assert client.get("/api/datasets", headers=auth).json() == []

    preview = client.get("/api/builtin/surat/preview", headers=auth).json()
    assert preview["total_rows"] == 2000
    assert "SMC_Zone_Name" in preview["columns"]
    assert len(preview["rows"]) == 2000

    # Still nothing in the user's library: the built-in file is never copied.
    assert client.get("/api/datasets", headers=auth).json() == []


def test_builtin_aggregate_returns_points_and_a_written_reading(client, auth):
    body = client.get(
        "/api/builtin/surat/aggregate",
        params={"x": "SMC_Zone_Name", "y": "TOT_P", "limit": 5},
        headers=auth,
    ).json()
    assert len(body["points"]) == 5
    assert body["group_count"] == 10
    assert body["points"][0]["value"] > body["points"][-1]["value"]
    assert "highest" in body["reading"] and "lowest" in body["reading"]


def test_a_rate_column_is_averaged_not_added(client, auth):
    body = client.get(
        "/api/builtin/surat/aggregate",
        params={"x": "TRU", "y": "Effective_Literacy_Rate_Pct"},
        headers=auth,
    ).json()
    assert body["aggregation"] == "average"
    assert all(0 <= point["value"] <= 100 for point in body["points"])


def test_a_filter_narrows_the_rows_used(client, auth):
    everything = client.get(
        "/api/builtin/surat/aggregate", params={"x": "SMC_Zone_Name", "y": "TOT_P"}, headers=auth
    ).json()
    rural = client.get(
        "/api/builtin/surat/aggregate",
        params={"x": "SMC_Zone_Name", "y": "TOT_P", "filter_column": "TRU", "filter_value": "Rural"},
        headers=auth,
    ).json()
    assert rural["rows_used"] < everything["rows_used"]


def test_a_chart_can_be_saved_against_the_builtin_source(client, auth):
    saved = client.post(
        "/api/datasets/saved-charts",
        json={
            "source_key": "builtin:surat",
            "name": "Literacy by zone",
            "config": {"chartType": "dot", "x": "SMC_Zone_Name", "y": "Effective_Literacy_Rate_Pct"},
        },
        headers=auth,
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["dataset_id"] is None
    assert body["source_key"] == "builtin:surat"

    listing = client.get("/api/datasets/saved-charts/list", headers=auth).json()
    assert any(chart["name"] == "Literacy by zone" for chart in listing)
    assert client.delete(f"/api/datasets/saved-charts/{body['id']}", headers=auth).status_code == 200


def test_uploading_a_file_stores_it_and_describes_it(client, auth, tmp_path):
    csv = tmp_path / "villages.csv"
    csv.write_text(
        "village,year,population,literacy_percent\n"
        "Olpad,2024,1200,71.2\nMangrol,2024,980,66.5\nKamrej,2024,1510,78.9\nBardoli,2024,1340,74.1\n"
    )
    with csv.open("rb") as handle:
        response = client.post("/api/datasets", files={"file": ("villages.csv", handle, "text/csv")}, headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dataset"]["rows"] == 4
    assert body["analysis"]["suggested_category"] == "village"
    assert body["analysis"]["suggested_measures"][0] == "population"


def test_a_file_that_is_not_a_spreadsheet_is_refused(client, auth, tmp_path):
    bad = tmp_path / "notes.txt"
    bad.write_text("not a spreadsheet")
    with bad.open("rb") as handle:
        response = client.post("/api/datasets", files={"file": ("notes.txt", handle, "text/plain")}, headers=auth)
    assert response.status_code == 400
    assert "CSV or Excel" in response.json()["detail"]


def test_exports_are_produced_for_the_builtin_dataset(client, auth):
    csv = client.get("/api/builtin/surat/download", headers=auth)
    assert csv.status_code == 200

    excel = client.get("/api/builtin/surat/download-excel", headers=auth)
    assert excel.status_code == 200
    assert excel.content[:2] == b"PK"  # an xlsx file is a zip archive

    pdf = client.get("/api/builtin/surat/report.pdf", headers=auth)
    assert pdf.status_code == 200
    assert pdf.content[:5] == b"%PDF-"


def test_comparison_accepts_a_builtin_key_alongside_a_dataset_id(client, auth, tmp_path):
    csv = tmp_path / "subset.csv"
    csv.write_text("SMC_Zone_Name,TOT_P,No_HH\nCentral Zone (Muglisara),2628,588\nNanpura,3076,695\n")
    with csv.open("rb") as handle:
        uploaded = client.post("/api/datasets", files={"file": ("subset.csv", handle, "text/csv")}, headers=auth).json()

    body = client.get(
        "/api/datasets/compare",
        params={"dataset_a": "builtin:surat", "dataset_b": str(uploaded["dataset"]["id"])},
        headers=auth,
    ).json()
    shared = {row["column"] for row in body["common_numeric_columns"]}
    assert {"TOT_P", "No_HH"} <= shared


def test_importing_the_builtin_copy_happens_at_most_once(client, auth):
    first = client.post("/api/datasets/synthetic/surat/default", headers=auth).json()
    second = client.post("/api/datasets/synthetic/surat/default", headers=auth).json()
    assert first["already_imported"] is False
    assert second["already_imported"] is True
    assert first["dataset"]["id"] == second["dataset"]["id"]


def test_one_account_cannot_read_another_account_dataset(client, auth, tmp_path):
    csv = tmp_path / "private.csv"
    csv.write_text("area,value\nA,1\nB,2\n")
    with csv.open("rb") as handle:
        mine = client.post("/api/datasets", files={"file": ("private.csv", handle, "text/csv")}, headers=auth).json()

    other = client.post(
        "/api/auth/register",
        json={"name": "Other", "email": "other@example.com", "password": "another-pass-2026"},
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/api/datasets/{mine['dataset']['id']}/preview", headers=headers).status_code == 404
