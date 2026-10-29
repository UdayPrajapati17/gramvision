from pathlib import Path
import pandas as pd
from pydantic import ValidationError
from app.schemas.schemas import RegisterIn, ResetIn


def test_bundled_surat_sample_is_labeled_and_has_expected_geography():
    sample = Path(__file__).resolve().parents[1] / "data" / "surat_synthetic_sample.csv"
    frame = pd.read_csv(sample)
    assert len(frame) == 120
    assert set(frame["district"]) == {"Surat"}
    assert set(frame["state"]) == {"Gujarat"}
    assert set(frame["country"]) == {"India"}
    assert frame["provenance"].str.contains("NOT OFFICIAL STATISTICS").all()
    assert {"taluka_illustration", "village_illustration", "municipal_ward_illustration"}.issubset(set(frame["geographic_level"]))
    assert frame["literacy_percent"].between(0, 100).all()
    assert frame["drinking_water_access_percent"].between(0, 100).all()


def test_password_over_bcrypt_byte_limit_is_rejected_clearly():
    try:
        RegisterIn(name="Sample User", email="sample@example.com", password="x" * 73)
    except ValidationError as exc:
        assert "72 UTF-8 bytes" in str(exc)
    else:
        raise AssertionError("A password over the bcrypt byte limit should be rejected")


def test_valid_password_is_accepted():
    account = RegisterIn(name="Sample User", email="sample@example.com", password="surat-pass-2026")
    assert account.password == "surat-pass-2026"
