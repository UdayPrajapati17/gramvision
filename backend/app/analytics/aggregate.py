# Server-side grouping, used when a dataset is too large to chart in the browser.
from __future__ import annotations

import pandas as pd

from app.analytics.interpret import aggregate_series, describe_series
from app.analytics.profiling import RATE_NAME

MAX_GROUPS = 400


def apply_filter(frame: pd.DataFrame, column: str | None, value: str | None) -> pd.DataFrame:
    if not column or value in (None, "") or column not in frame.columns:
        return frame
    return frame[frame[column].astype(str) == str(value)]


def grouped_chart_data(
    frame: pd.DataFrame,
    x: str,
    y: str,
    aggregation: str | None = None,
    filter_column: str | None = None,
    filter_value: str | None = None,
    limit: int = 40,
    order: str = "value_desc",
) -> dict:
    """Group one measure by one category and describe the result in words."""
    if x not in frame.columns:
        raise ValueError(f"Column '{x}' is not in this dataset")
    if y not in frame.columns:
        raise ValueError(f"Column '{y}' is not in this dataset")

    scoped = apply_filter(frame, filter_column, filter_value)
    how = aggregation or ("average" if RATE_NAME.search(y) else "sum")
    points = aggregate_series(scoped, x, y, how)

    if order == "value_asc":
        points = list(reversed(points))
    elif order == "name_asc":
        points = sorted(points, key=lambda p: p["name"])
    elif order == "name_desc":
        points = sorted(points, key=lambda p: p["name"], reverse=True)

    capped = points[: max(1, min(limit, MAX_GROUPS))]
    return {
        "x": x,
        "y": y,
        "aggregation": how,
        "points": capped,
        "group_count": len(points),
        "truncated": len(points) > len(capped),
        "rows_used": int(len(scoped)),
        "reading": describe_series(points, x, y, how),
    }
