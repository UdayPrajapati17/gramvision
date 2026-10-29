# Dataset management: owner-scoped uploads, history, preview, analysis, and downloads.
from __future__ import annotations

import json
import os
import shutil
import uuid
from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.analytics.aggregate import grouped_chart_data
from app.analytics.analysis import analyze
from app.core.config import settings
from app.core.database import get_db
from app.core.security import current_user
from app.models.models import Dataset, SavedChart, User
from app.services import builtin
from app.services.report import build_report

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

PREVIEW_DEFAULT = 5000
PREVIEW_MAX = 20000
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def owned(dataset_id: int, user: User, db: Session) -> Dataset:
    item = db.query(Dataset).filter_by(id=dataset_id, owner_id=user.id).first()
    if not item:
        raise HTTPException(404, "Dataset not found")
    return item


def read_frame(item: Dataset) -> pd.DataFrame:
    path = Path(settings.upload_dir) / item.filename
    if not path.exists():
        raise HTTPException(
            410,
            f"The stored file for “{item.name}” is missing from the uploads folder. "
            "Upload it again, or delete this record.",
        )
    return pd.read_excel(path) if item.format in {"xlsx", "xls"} else pd.read_csv(path)


def serialize(d: Dataset) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "format": d.format,
        "size": d.size,
        "rows": d.rows,
        "columns": d.columns,
        "column_names": json.loads(d.column_names),
        "provenance": d.provenance,
        "created_at": d.created_at,
        "builtin": False,
    }


# A dataset reference is either a saved dataset id or a built-in key such as "builtin:surat".
def resolve_source(reference: str, user: User, db: Session) -> tuple[pd.DataFrame, dict]:
    token = str(reference).strip()
    if token.startswith("builtin:"):
        slug = token.split(":", 1)[1]
        try:
            return builtin.load_frame(slug), builtin.describe(slug)
        except KeyError:
            raise HTTPException(404, "There is no built-in dataset with that name")
        except FileNotFoundError:
            raise HTTPException(500, "The built-in dataset file is missing from backend/data")
    if not token.isdigit():
        raise HTTPException(400, "Use a dataset id, or a built-in key such as builtin:surat")
    item = owned(int(token), user, db)
    return read_frame(item), serialize(item)


# Upload: persist CSV or Excel files and their owner-specific metadata.
@router.post("")
async def upload(
    file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(400, "Upload a CSV or Excel file (.csv, .xlsx or .xls)")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 20 MB limit")
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = Path(settings.upload_dir) / safe_name
    path.write_bytes(data)
    try:
        frame = pd.read_excel(path) if ext != ".csv" else pd.read_csv(path)
    except Exception:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "Could not read this file. Check that the first row holds column names.")
    if frame.empty or not len(frame.columns):
        path.unlink(missing_ok=True)
        raise HTTPException(400, "This file has no rows to chart")
    item = Dataset(
        owner_id=user.id,
        name=file.filename or safe_name,
        filename=safe_name,
        format=ext.lstrip("."),
        size=len(data),
        rows=len(frame),
        columns=len(frame.columns),
        column_names=json.dumps(list(map(str, frame.columns))),
        provenance="Uploaded by you",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"dataset": serialize(item), "analysis": analyze(frame)}


# Dataset history: list only the signed-in user's saved datasets.
@router.get("")
def list_datasets(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Dataset).filter_by(owner_id=user.id).order_by(Dataset.created_at.desc()).all()
    return [serialize(d) for d in rows]


# Comparison accepts dataset ids and built-in keys, so the bundled data needs no copy.
@router.get("/compare")
def compare_datasets(
    dataset_a: str,
    dataset_b: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if str(dataset_a) == str(dataset_b):
        raise HTTPException(400, "Choose two different datasets to compare")
    frame_a, meta_a = resolve_source(dataset_a, user, db)
    frame_b, meta_b = resolve_source(dataset_b, user, db)
    numeric_a = frame_a.select_dtypes(include="number")
    numeric_b = frame_b.select_dtypes(include="number")
    shared = [c for c in numeric_a.columns if c in numeric_b.columns]
    comparisons = []
    for column in shared:
        left, right = numeric_a[column].mean(), numeric_b[column].mean()
        difference = None if pd.isna(left) or pd.isna(right) else float(right - left)
        change = None
        if difference is not None and left not in (0, None) and not pd.isna(left) and left != 0:
            change = float(difference / abs(left) * 100)
        comparisons.append(
            {
                "column": str(column),
                "dataset_a_mean": None if pd.isna(left) else float(left),
                "dataset_b_mean": None if pd.isna(right) else float(right),
                "difference": difference,
                "percent_change": change,
            }
        )
    return {
        "dataset_a": {"id": str(dataset_a), "name": meta_a["name"], "rows": len(frame_a), "columns": len(frame_a.columns)},
        "dataset_b": {"id": str(dataset_b), "name": meta_b["name"], "rows": len(frame_b), "columns": len(frame_b.columns)},
        "common_numeric_columns": comparisons,
        "message": "Each row compares the mean of a column the two datasets share. Check that both datasets measure the same thing before reading a difference as meaningful.",
    }


# Saved visualizations: stored per account, for datasets and built-in sources alike.
class ChartConfigIn(BaseModel):
    dataset_id: int | None = None
    source_key: str | None = None
    source_label: str | None = Field(default=None, max_length=160)
    name: str = Field(default="Saved visualization", min_length=1, max_length=160)
    config: dict


@router.get("/saved-charts/list")
def list_saved_charts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    charts = db.query(SavedChart).filter_by(owner_id=user.id).order_by(SavedChart.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "dataset_id": c.dataset_id,
            "source_key": c.source_key,
            "source_label": c.source_label,
            "name": c.name,
            "config": json.loads(c.config_json),
            "created_at": c.created_at,
        }
        for c in charts
    ]


@router.post("/saved-charts")
def save_chart(data: ChartConfigIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    label = data.source_label
    if data.dataset_id is not None:
        item = owned(data.dataset_id, user, db)
        label = label or item.name
    elif data.source_key and data.source_key.startswith("builtin:"):
        slug = data.source_key.split(":", 1)[1]
        try:
            label = label or builtin.describe(slug)["short_name"]
        except (KeyError, FileNotFoundError):
            raise HTTPException(404, "There is no built-in dataset with that name")
    else:
        raise HTTPException(400, "Save a visualization against a dataset or a built-in source")
    chart = SavedChart(
        owner_id=user.id,
        dataset_id=data.dataset_id,
        source_key=data.source_key,
        source_label=label,
        name=data.name.strip(),
        config_json=json.dumps(data.config),
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return {
        "id": chart.id,
        "dataset_id": chart.dataset_id,
        "source_key": chart.source_key,
        "source_label": chart.source_label,
        "name": chart.name,
        "config": data.config,
        "created_at": chart.created_at,
    }


@router.delete("/saved-charts/{chart_id}")
def delete_saved_chart(chart_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    chart = db.query(SavedChart).filter_by(id=chart_id, owner_id=user.id).first()
    if not chart:
        raise HTTPException(404, "Saved visualization not found")
    db.delete(chart)
    db.commit()
    return {"deleted": True}


# Import the bundled Surat dataset into the signed-in user's library, at most once.
@router.post("/synthetic/surat/default")
def import_builtin_surat(user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        source = builtin.describe("surat")
        sample_path = builtin.file_path("surat")
    except (KeyError, FileNotFoundError):
        raise HTTPException(500, "The built-in Surat dataset is missing from backend/data")

    existing = (
        db.query(Dataset)
        .filter_by(owner_id=user.id, provenance=source["provenance"])
        .first()
    )
    if existing:
        return {
            "dataset": serialize(existing),
            "analysis": analyze(read_frame(existing)),
            "provenance": existing.provenance,
            "already_imported": True,
        }

    frame = builtin.load_frame("surat")
    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.csv"
    shutil.copyfile(sample_path, Path(settings.upload_dir) / stored_name)
    item = Dataset(
        owner_id=user.id,
        name=f"{source['short_name']}.csv",
        filename=stored_name,
        format="csv",
        size=source["size"],
        rows=len(frame),
        columns=len(frame.columns),
        column_names=json.dumps(list(map(str, frame.columns))),
        provenance=source["provenance"],
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "dataset": serialize(item),
        "analysis": analyze(frame),
        "provenance": source["provenance"],
        "already_imported": False,
    }


# Practice data: clearly labelled, generated locally, never mixed with real records.
@router.post("/synthetic/surat")
def synthetic(
    count: int = 100,
    category: str = "mixed",
    geographic_level: str = "mixed",
    seed: int = 410,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if count < 1 or count > 10000:
        raise HTTPException(400, "Choose between 1 and 10,000 records")
    import random

    rng = random.Random(seed)
    rows = []
    for i in range(count):
        level_index = i % 3
        if geographic_level == "taluka":
            level_index = 0
        elif geographic_level == "village":
            level_index = 1
        elif geographic_level in {"ward", "municipal_ward"}:
            level_index = 2
        if level_index == 0:
            level, area = "taluka_illustration", f"Illustrative Taluka {((i // 3) % 9) + 1:02d}"
        elif level_index == 1:
            level, area = "village_illustration", f"Illustrative Village {((i // 3) % 30) + 1:03d}"
        else:
            level, area = "municipal_ward_illustration", f"Illustrative Surat Municipal Ward {((i // 3) % 30) + 1:03d}"
        population = rng.randint(900, 12900)
        households = max(1, round(population / rng.uniform(3.8, 4.64)))
        rows.append(
            {
                "district": "Surat",
                "state": "Gujarat",
                "country": "India",
                "geographic_level": level,
                "area_name": area,
                "year": 2020 + (i % 5),
                "population": population,
                "households": households,
                "average_household_size": round(population / households, 2),
                "literacy_percent": round(rng.uniform(62, 96), 1),
                "schools_count": rng.randint(1, 18),
                "healthcare_facilities": rng.randint(1, 9),
                "employment_rate_percent": round(rng.uniform(48, 90), 1),
                "drinking_water_access_percent": round(rng.uniform(65, 99), 1),
                "sanitation_access_percent": round(rng.uniform(55, 99), 1),
                "electricity_access_percent": round(rng.uniform(88, 99.9), 1),
                "road_connectivity_percent": round(rng.uniform(50, 99), 1),
                "provenance": "SIMULATED DATA — NOT OFFICIAL STATISTICS",
            }
        )
    frame = pd.DataFrame(rows)
    groups = {
        "education": ["district", "state", "country", "geographic_level", "area_name", "year", "literacy_percent", "schools_count", "provenance"],
        "occupation": ["district", "state", "country", "geographic_level", "area_name", "year", "employment_rate_percent", "provenance"],
        "population": ["district", "state", "country", "geographic_level", "area_name", "year", "population", "households", "average_household_size", "provenance"],
        "agriculture": ["district", "state", "country", "geographic_level", "area_name", "year", "cultivated_area_hectares", "provenance"],
        "infrastructure": ["district", "state", "country", "geographic_level", "area_name", "year", "drinking_water_access_percent", "sanitation_access_percent", "electricity_access_percent", "road_connectivity_percent", "healthcare_facilities", "provenance"],
    }
    if category in groups:
        if category == "agriculture":
            frame["cultivated_area_hectares"] = [rng.randint(50, 4500) for _ in range(count)]
        frame = frame[[c for c in groups[category] if c in frame.columns]]

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.csv"
    stored_path = Path(settings.upload_dir) / stored_name
    frame.to_csv(stored_path, index=False)
    item = Dataset(
        owner_id=user.id,
        name=f"Practice dataset, {count} rows",
        filename=stored_name,
        format="csv",
        size=stored_path.stat().st_size,
        rows=len(frame),
        columns=len(frame.columns),
        column_names=json.dumps(list(map(str, frame.columns))),
        provenance="Generated practice data, not official statistics",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "dataset": serialize(item),
        "analysis": analyze(frame),
        "provenance": "SIMULATED DATA — NOT OFFICIAL STATISTICS. Area names are illustrative and do not represent verified administrative boundaries.",
    }


@router.post("/defaults/{category}")
def load_category_default(category: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    import random

    key = category.strip().lower()
    allowed = {"education", "occupation", "population", "agriculture", "infrastructure"}
    if key not in allowed:
        raise HTTPException(404, "Unknown built-in dataset category")
    rng = random.Random(410 + sum(map(ord, key)))
    areas = [f"Illustrative Area {i:02d}" for i in range(1, 31)]
    common = {"district": ["Surat"] * len(areas), "area_name": areas, "year": [2020 + (i % 6) for i in range(len(areas))]}
    if key == "education":
        frame = pd.DataFrame({**common, "literacy_percent": [round(rng.uniform(65, 96), 1) for _ in areas], "schools_count": [rng.randint(1, 24) for _ in areas], "enrollment_percent": [round(rng.uniform(70, 99), 1) for _ in areas], "higher_education_access_percent": [round(rng.uniform(25, 85), 1) for _ in areas]})
    elif key == "occupation":
        frame = pd.DataFrame({**common, "agriculture_employment_percent": [round(rng.uniform(5, 45), 1) for _ in areas], "manufacturing_employment_percent": [round(rng.uniform(10, 42), 1) for _ in areas], "services_employment_percent": [round(rng.uniform(18, 65), 1) for _ in areas], "employment_rate_percent": [round(rng.uniform(48, 88), 1) for _ in areas]})
    elif key == "population":
        population = [rng.randint(1200, 45000) for _ in areas]
        households = [max(1, round(p / rng.uniform(3.4, 5.1))) for p in population]
        frame = pd.DataFrame({**common, "population": population, "households": households, "average_household_size": [round(p / h, 2) for p, h in zip(population, households)], "female_percent": [round(rng.uniform(47, 53), 1) for _ in areas], "urban_population_percent": [round(rng.uniform(15, 98), 1) for _ in areas]})
    elif key == "agriculture":
        frame = pd.DataFrame({**common, "cultivated_area_hectares": [rng.randint(50, 4500) for _ in areas], "rice_production_tonnes": [rng.randint(100, 9000) for _ in areas], "sugarcane_production_tonnes": [rng.randint(50, 7500) for _ in areas], "irrigated_area_percent": [round(rng.uniform(20, 99), 1) for _ in areas]})
    else:
        frame = pd.DataFrame({**common, "road_connectivity_percent": [round(rng.uniform(45, 100), 1) for _ in areas], "water_access_percent": [round(rng.uniform(50, 100), 1) for _ in areas], "sanitation_access_percent": [round(rng.uniform(45, 99), 1) for _ in areas], "electricity_access_percent": [round(rng.uniform(80, 100), 1) for _ in areas], "healthcare_facilities": [rng.randint(1, 18) for _ in areas]})
    frame["provenance"] = "SIMULATED DATA — NOT OFFICIAL STATISTICS"

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.csv"
    stored_path = Path(settings.upload_dir) / stored_name
    frame.to_csv(stored_path, index=False)
    item = Dataset(
        owner_id=user.id,
        name=f"{key.title()} practice sample",
        filename=stored_name,
        format="csv",
        size=stored_path.stat().st_size,
        rows=len(frame),
        columns=len(frame.columns),
        column_names=json.dumps(list(map(str, frame.columns))),
        provenance="Generated practice data, not official statistics",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "dataset": serialize(item),
        "analysis": analyze(frame),
        "provenance": "SIMULATED DATA — NOT OFFICIAL STATISTICS. Area names are illustrative.",
    }


# Dataset preview: a bounded window, so a very large file never floods the browser.
@router.get("/{dataset_id}/preview")
def preview(
    dataset_id: int,
    limit: int = Query(PREVIEW_DEFAULT, ge=1, le=PREVIEW_MAX),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    item = owned(dataset_id, user, db)
    frame = read_frame(item)
    window = frame.head(limit).fillna("")
    return {
        "columns": [str(c) for c in frame.columns],
        "rows": window.astype(str).values.tolist(),
        "total_rows": int(len(frame)),
        "returned_rows": int(len(window)),
        "truncated": bool(len(frame) > len(window)),
    }


@router.get("/{dataset_id}/analysis")
def dataset_analysis(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return analyze(read_frame(owned(dataset_id, user, db)))


@router.get("/{dataset_id}/aggregate")
def aggregate_dataset(
    dataset_id: int,
    x: str,
    y: str,
    aggregation: str | None = None,
    filter_column: str | None = None,
    filter_value: str | None = None,
    limit: int = Query(40, ge=1, le=400),
    order: str = "value_desc",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    frame = read_frame(owned(dataset_id, user, db))
    try:
        return grouped_chart_data(frame, x, y, aggregation, filter_column, filter_value, limit, order)
    except ValueError as error:
        raise HTTPException(400, str(error))


@router.patch("/{dataset_id}")
def rename(dataset_id: int, name: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(dataset_id, user, db)
    item.name = name[:255]
    db.commit()
    return serialize(item)


@router.delete("/{dataset_id}")
def delete(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(dataset_id, user, db)
    (Path(settings.upload_dir) / item.filename).unlink(missing_ok=True)
    db.query(SavedChart).filter_by(dataset_id=item.id, owner_id=user.id).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    return {"deleted": True}


@router.get("/{dataset_id}/download")
def download(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(dataset_id, user, db)
    path = Path(settings.upload_dir) / item.filename
    if not path.exists():
        raise HTTPException(410, "The stored file for this dataset is missing from the uploads folder")
    return FileResponse(path, filename=item.name)


@router.get("/{dataset_id}/download-excel")
def download_excel(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(dataset_id, user, db)
    frame = read_frame(item)
    stream = BytesIO()
    frame.to_excel(stream, index=False, engine="openpyxl")
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="dataset-{item.id}.xlsx"'},
    )


@router.get("/{dataset_id}/report.pdf")
def dataset_report_pdf(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(dataset_id, user, db)
    frame = read_frame(item)
    stream = build_report(item.name, frame, item.provenance or "Uploaded by you")
    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="gramvision-report-{item.id}.pdf"'},
    )
