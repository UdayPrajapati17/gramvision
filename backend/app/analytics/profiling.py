# Column profiling: decide what each column actually is before any chart is drawn.
#
# Nothing here looks at a hard-coded list of dataset names. Every decision is made
# from the values in the column plus a light reading of its name, so an uploaded
# file is treated exactly like the bundled Surat census extract.
from __future__ import annotations

import re
from typing import Any

import pandas as pd

# Names that identify a row rather than measure anything about it.
IDENTIFIER_NAME = re.compile(
    r"(^|_)(id|uid|uuid|key|slno|sl_no|serial|record|index|rowid)(_|$)", re.I
)
# Names that encode a classification as a number: never a measurement.
CODE_NAME = re.compile(r"(^|_)(code|pin|pincode|zip|lgd|phone|mobile)(_|$)", re.I)
# Names that carry a point in time.
TEMPORAL_NAME = re.compile(r"(^|_)(year|yr|date|month|quarter|period|time)(_|$)", re.I)
# Names whose values are already normalised, so they must be averaged, never summed.
RATE_NAME = re.compile(
    r"(pct|percent|percentage|rate|ratio|index|share|density|avg|average|mean|median|"
    r"per_capita|per_1000|per_hh|score)", re.I
)
# Names that read as a place, a group or a classification worth putting on an axis.
DIMENSION_NAME = re.compile(
    r"(area|ward|zone|village|taluka|tehsil|block|district|state|region|city|town|"
    r"locality|name|category|type|class|group|sector|segment|gender|sex|tru|"
    r"rural|urban|status|level|band|cohort|department|crop|season)", re.I
)
# Names that read as something worth measuring.
MEASURE_NAME = re.compile(
    r"(pop|population|total|count|number|num|households?|hh|lit|literacy|illit|work|"
    r"worker|employ|job|labour|labor|cultivat|farm|agri|crop|yield|produc|area|hectare|"
    r"acre|irrigat|school|college|student|enrol|health|clinic|hospital|road|water|"
    r"sanitation|electric|toilet|facility|facilities|amenity|income|revenue|expenditure|"
    r"budget|rate|percent|pct|ratio|growth|sex_ratio|density|size|value|amount|sc|st)",
    re.I,
)

MAX_SAMPLE_VALUES = 12


def _as_numeric(series: pd.Series) -> pd.Series:
    """Coerce a column to numbers, tolerating thousands separators and stray symbols."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    text = series.astype("string").str.strip()
    text = text.str.replace(r"[,\s]", "", regex=True)
    text = text.str.replace(r"^[₹$€£]", "", regex=True)
    text = text.str.replace(r"%$", "", regex=True)
    return pd.to_numeric(text, errors="coerce")


def _looks_like_year(numbers: pd.Series) -> bool:
    valid = numbers.dropna()
    if valid.empty:
        return False
    inside = valid.between(1800, 2200).mean()
    return bool(inside > 0.95 and (valid % 1 == 0).all())


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if pd.isna(number) else round(number, 6)


def profile_column(frame: pd.DataFrame, name: str) -> dict:
    """Describe one column: what it holds, how varied it is, and how it may be used."""
    series = frame[name]
    total = len(series)
    missing = int(series.isna().sum())
    numbers = _as_numeric(series)
    numeric_share = float(numbers.notna().sum() / total) if total else 0.0
    is_numeric = numeric_share >= 0.9 and numbers.notna().sum() > 0
    distinct = int(series.nunique(dropna=True))
    label = str(name)

    profile: dict[str, Any] = {
        "name": label,
        "missing": missing,
        "distinct": distinct,
        "total": total,
        "numeric_share": round(numeric_share, 4),
        "constant": distinct <= 1,
        "sample_values": [str(v) for v in series.dropna().unique()[:MAX_SAMPLE_VALUES]],
    }

    if is_numeric:
        valid = numbers.dropna()
        profile.update(
            {
                "min": _float(valid.min()),
                "max": _float(valid.max()),
                "mean": _float(valid.mean()),
                "median": _float(valid.median()),
                "std": _float(valid.std()),
                "sum": _float(valid.sum()),
            }
        )

    # Role: the single most important output of this function.
    if distinct <= 1:
        role = "constant"
    elif IDENTIFIER_NAME.search(label) and distinct >= total * 0.9:
        role = "identifier"
    elif not is_numeric and distinct >= total * 0.95 and total > 20:
        role = "identifier"
    elif is_numeric and TEMPORAL_NAME.search(label) and _looks_like_year(numbers):
        role = "temporal"
    elif not is_numeric and TEMPORAL_NAME.search(label):
        role = "temporal"
    elif CODE_NAME.search(label) or (is_numeric and IDENTIFIER_NAME.search(label)):
        role = "code"
    elif is_numeric:
        role = "measure"
    else:
        role = "dimension"

    profile["role"] = role
    profile["type"] = "numeric" if is_numeric else "text"
    # A rate is averaged across rows; a count is added up.
    profile["aggregation"] = (
        "average" if role == "measure" and RATE_NAME.search(label) else "sum"
    )
    profile["usable_as_category"] = role in {"dimension", "temporal"} and 1 < distinct <= max(
        60, total * 0.5
    )
    profile["usable_as_measure"] = role == "measure" and distinct > 1
    return profile


def profile_frame(frame: pd.DataFrame) -> list[dict]:
    return [profile_column(frame, column) for column in frame.columns]


def score_category(profile: dict) -> float:
    """How good this column is as the x axis of a comparison chart."""
    if not profile.get("usable_as_category"):
        return -1.0
    distinct = profile["distinct"]
    total = max(profile["total"], 1)
    score = 10.0
    # Between 4 and 30 groups is the band a reader can actually compare.
    if 4 <= distinct <= 30:
        score += 30
    elif distinct <= 3:
        score += 8
    elif distinct <= 60:
        score += 18
    else:
        score += 4
    score -= (distinct / total) * 25  # near-unique columns make a useless axis
    if DIMENSION_NAME.search(profile["name"]):
        score += 14
    if profile["role"] == "temporal":
        score -= 6  # time belongs on a line chart, not a ranking
    score -= (profile["missing"] / total) * 10
    return score


# Measures a reader reaches for first, strongest signal to weakest.
HEADLINE_MEASURE = re.compile(
    r"(^tot_p$|total_pop|^population$|^pop$|^tot_|_total$|^total_)", re.I
)
STRONG_MEASURE = re.compile(
    r"(population|households?|^no_hh$|literacy|workers?|employ|production|yield|"
    r"cultivat|area|enrol|income|revenue)", re.I
)
# A male/female split of a measure that also exists as a combined column.
SPLIT_MEASURE = re.compile(r"(^|_)(m|f|male|female|boys|girls)(_|$)", re.I)


def score_measure(profile: dict) -> float:
    """How good this column is as the y axis of a comparison chart."""
    if not profile.get("usable_as_measure"):
        return -1.0
    total = max(profile["total"], 1)
    name = profile["name"]
    score = 10.0
    if HEADLINE_MEASURE.search(name):
        score += 26
    elif STRONG_MEASURE.search(name):
        score += 18
    elif MEASURE_NAME.search(name):
        score += 10
    if SPLIT_MEASURE.search(name):
        score -= 9  # prefer the combined column over its male/female halves
    mean, std = profile.get("mean"), profile.get("std")
    if mean not in (None, 0) and std:
        score += min(abs(std / mean), 1.5) * 5  # a flat column makes a dull chart
    score += min(profile["distinct"] / total, 1.0) * 4
    score -= (profile["missing"] / total) * 12
    return score


def measure_family(name: str) -> str:
    """Group columns that measure the same thing for different people.

    TOT_P, TOT_M and TOT_F all belong to the family "tot", so a list of
    suggestions never opens with three views of one number.
    """
    key = str(name).lower()
    key = re.sub(r"^(p|m|f|tot|main|marg|non)_", "", key)
    key = re.sub(r"_(p|m|f|persons?|males?|females?)$", "", key)
    return key or str(name).lower()


def best_category(profiles: list[dict]) -> str | None:
    ranked = sorted(profiles, key=score_category, reverse=True)
    return ranked[0]["name"] if ranked and score_category(ranked[0]) > 0 else None


def best_measures(profiles: list[dict], count: int = 1) -> list[str]:
    ranked = [p for p in sorted(profiles, key=score_measure, reverse=True) if score_measure(p) > 0]
    chosen: list[str] = []
    seen: set[str] = set()
    for profile in ranked:
        family = measure_family(profile["name"])
        if family in seen:
            continue
        seen.add(family)
        chosen.append(profile["name"])
        if len(chosen) >= count:
            break
    # If de-duplication left too few, fall back to plain ranking.
    if len(chosen) < count:
        for profile in ranked:
            if profile["name"] not in chosen:
                chosen.append(profile["name"])
            if len(chosen) >= count:
                break
    return chosen[:count]


def best_temporal(profiles: list[dict]) -> str | None:
    options = [p for p in profiles if p["role"] == "temporal" and p["distinct"] > 1]
    return options[0]["name"] if options else None
