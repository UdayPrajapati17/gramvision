# Built-in datasets: charted straight from backend/data, with no upload and no copy.
from __future__ import annotations

from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.analytics.aggregate import grouped_chart_data
from app.analytics.analysis import analyze
from app.core.security import current_user
from app.models.models import User
from app.services import builtin
from app.services.report import build_report

router = APIRouter(prefix="/api/builtin", tags=["Built-in datasets"])

PREVIEW_DEFAULT = 5000
PREVIEW_MAX = 20000


def _frame(slug: str) -> pd.DataFrame:
    try:
        return builtin.load_frame(slug)
    except KeyError:
        raise HTTPException(404, "There is no built-in dataset with that name")
    except FileNotFoundError:
        raise HTTPException(
            500,
            "The built-in dataset file is missing from backend/data. "
            "Restore it or upload your own copy from the Upload page.",
        )


@router.get("")
def list_builtin(user: User = Depends(current_user)):
    """Every dataset the workspace can chart without an upload."""
    return builtin.catalogue()


@router.get("/{slug}")
def describe_builtin(slug: str, user: User = Depends(current_user)):
    _frame(slug)
    return builtin.describe(slug)


@router.get("/{slug}/preview")
def preview_builtin(
    slug: str,
    limit: int = Query(PREVIEW_DEFAULT, ge=1, le=PREVIEW_MAX),
    user: User = Depends(current_user),
):
    frame = _frame(slug)
    window = frame.head(limit).fillna("")
    return {
        "columns": [str(c) for c in frame.columns],
        "rows": window.astype(str).values.tolist(),
        "total_rows": int(len(frame)),
        "returned_rows": int(len(window)),
        "truncated": bool(len(frame) > len(window)),
        "source": builtin.describe(slug),
    }


@router.get("/{slug}/analysis")
def analyse_builtin(slug: str, user: User = Depends(current_user)):
    return analyze(_frame(slug))


@router.get("/{slug}/aggregate")
def aggregate_builtin(
    slug: str,
    x: str,
    y: str,
    aggregation: str | None = None,
    filter_column: str | None = None,
    filter_value: str | None = None,
    limit: int = Query(40, ge=1, le=400),
    order: str = "value_desc",
    user: User = Depends(current_user),
):
    try:
        return grouped_chart_data(
            _frame(slug), x, y, aggregation, filter_column, filter_value, limit, order
        )
    except ValueError as error:
        raise HTTPException(400, str(error))


@router.get("/{slug}/download")
def download_builtin(slug: str, user: User = Depends(current_user)):
    _frame(slug)
    source = builtin.describe(slug)
    return FileResponse(
        builtin.file_path(slug),
        media_type="text/csv",
        filename=f"{source['slug']}-dataset.csv",
    )


@router.get("/{slug}/download-excel")
def download_builtin_excel(slug: str, user: User = Depends(current_user)):
    frame = _frame(slug)
    stream = BytesIO()
    frame.to_excel(stream, index=False, engine="openpyxl")
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{slug}-dataset.xlsx"'},
    )


@router.get("/{slug}/report.pdf")
def report_builtin(slug: str, user: User = Depends(current_user)):
    frame = _frame(slug)
    source = builtin.describe(slug)
    stream = build_report(source["name"], frame, source["provenance"])
    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="gramvision-{slug}-report.pdf"'},
    )
