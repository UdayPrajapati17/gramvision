# Dataset analytics: profile real columns, pick sensible axes, and explain the result.
from __future__ import annotations

import pandas as pd

from app.analytics.interpret import (
    aggregate_series,
    correlation_note,
    describe_frame,
    describe_series,
    pretty,
    trend_note,
)
from app.analytics.profiling import (
    RATE_NAME,
    best_category,
    best_measures,
    best_temporal,
    profile_frame,
)


def _numeric_summary(frame: pd.DataFrame) -> dict:
    numeric = frame.select_dtypes(include="number")
    if numeric.empty:
        return {}
    return numeric.describe().replace({float("nan"): None}).to_dict()


def recommend_charts(frame: pd.DataFrame, profiles: list[dict]) -> list[dict]:
    """Chart suggestions built from the columns that actually vary."""
    category = best_category(profiles)
    measures = best_measures(profiles, count=4)
    temporal = best_temporal(profiles)
    ideas: list[dict] = []

    if category and measures:
        measure = measures[0]
        how = "average" if RATE_NAME.search(measure) else "sum"
        ideas.append(
            {
                "type": "bar",
                "x": category,
                "y": measure,
                "aggregation": how,
                "title": f"{pretty(measure).capitalize()} by {pretty(category)}",
                "reason": f"Ranks {pretty(measure)} across every {pretty(category)} so the extremes stand out.",
            }
        )

    if temporal and measures:
        measure = next((m for m in measures if m != temporal), measures[0])
        ideas.append(
            {
                "type": "line",
                "x": temporal,
                "y": measure,
                "aggregation": "average" if RATE_NAME.search(measure) else "sum",
                "title": f"{pretty(measure).capitalize()} over {pretty(temporal)}",
                "reason": f"Follows {pretty(measure)} through time.",
            }
        )

    if len(measures) > 1:
        ideas.append(
            {
                "type": "scatter",
                "x": measures[0],
                "y": measures[1],
                "aggregation": "none",
                "title": f"{pretty(measures[0]).capitalize()} against {pretty(measures[1])}",
                "reason": "Tests whether the two measures move together.",
            }
        )

    if measures:
        ideas.append(
            {
                "type": "histogram",
                "x": measures[0],
                "y": measures[0],
                "aggregation": "count",
                "title": f"Spread of {pretty(measures[0])}",
                "reason": "Shows whether records cluster or spread out.",
            }
        )

    return ideas


def analyze(frame: pd.DataFrame) -> dict:
    """Everything the workspace needs to describe a dataset it has never seen before."""
    profiles = profile_frame(frame)
    missing = {str(k): int(v) for k, v in frame.isna().sum().items() if v}
    duplicates = int(frame.duplicated().sum())
    recommendations = recommend_charts(frame, profiles)
    category = best_category(profiles)
    measures = best_measures(profiles, count=3)

    readings: list[str] = []
    if category and measures:
        how = "average" if RATE_NAME.search(measures[0]) else "sum"
        series = aggregate_series(frame, category, measures[0], how)
        readings.append(describe_series(series, category, measures[0], how))
    if len(measures) > 1:
        note = correlation_note(frame, measures[0], measures[1])
        if note:
            readings.append(note)
    temporal = best_temporal(profiles)
    if temporal and measures:
        note = trend_note(aggregate_series(frame, temporal, measures[0]), measures[0])
        if note:
            readings.append(note)

    return {
        "rows": len(frame),
        "columns": len(frame.columns),
        "column_names": list(map(str, frame.columns)),
        "missing": missing,
        "duplicate_rows": duplicates,
        "numeric_summary": _numeric_summary(frame),
        "profiles": profiles,
        "suggested_category": category,
        "suggested_measures": measures,
        "suggested_temporal": temporal,
        "recommendations": recommendations,
        "readings": readings,
        "interpretation": describe_frame(frame, profiles),
    }
