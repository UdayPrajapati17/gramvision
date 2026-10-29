# Plain-language readings of a chart's own numbers.
#
# Every sentence here is produced from the aggregated values that the chart draws,
# so a reading can never describe something the reader cannot see on screen.
from __future__ import annotations

from statistics import median
from typing import Iterable

import pandas as pd

from app.analytics.profiling import RATE_NAME


# Census abbreviations spelled out; anything unlisted is tidied up instead.
CENSUS_NAMES = {
    "tot_p": "total population",
    "tot_m": "male population",
    "tot_f": "female population",
    "p_06": "children aged 0-6",
    "m_06": "boys aged 0-6",
    "f_06": "girls aged 0-6",
    "p_sc": "Scheduled Caste population",
    "m_sc": "Scheduled Caste males",
    "f_sc": "Scheduled Caste females",
    "p_st": "Scheduled Tribe population",
    "m_st": "Scheduled Tribe males",
    "f_st": "Scheduled Tribe females",
    "p_lit": "literate persons",
    "m_lit": "literate males",
    "f_lit": "literate females",
    "p_ill": "illiterate persons",
    "m_ill": "illiterate males",
    "f_ill": "illiterate females",
    "no_hh": "households",
    "tot_work_p": "total workers",
    "tot_work_m": "male workers",
    "tot_work_f": "female workers",
    "mainwork_p": "main workers",
    "margwork_p": "marginal workers",
    "non_work_p": "non-workers",
    "main_cl_p": "cultivators",
    "main_al_p": "agricultural labourers",
    "main_hh_p": "household-industry workers",
    "main_ot_p": "other workers",
    "sex_ratio": "sex ratio",
    "child_sex_ratio_06": "child sex ratio",
    "effective_literacy_rate_pct": "effective literacy rate",
    "work_participation_rate_pct": "work participation rate",
    "growth_2011_to_2026_pct": "growth since 2011",
    "baseline_pop_2011": "population in 2011",
    "smc_zone_name": "municipal zone",
    "ward_code": "ward",
    "area_name": "area",
    "enumeration_block": "enumeration block",
    "tru": "rural or urban",
    "district_name": "district",
    "census_year": "census year",
}


def pretty(name: str) -> str:
    """Turn a census column key into something a person would say out loud."""
    key = str(name).strip().lower()
    if key in CENSUS_NAMES:
        return CENSUS_NAMES[key]
    words = str(name).replace("_", " ").strip().lower()
    return words.replace("pct", "percent")


def fmt(value: float, decimals: int = 1) -> str:
    if value is None:
        return "—"
    if abs(value) >= 1000:
        return f"{value:,.0f}"
    if abs(value) >= 100:
        return f"{value:,.1f}".rstrip("0").rstrip(".")
    return f"{value:,.{decimals}f}".rstrip("0").rstrip(".") or "0"


def aggregate_series(
    frame: pd.DataFrame, category: str, measure: str, how: str | None = None
) -> list[dict]:
    """Group a measure by a category the way the chart does, then sort it."""
    if category not in frame.columns or measure not in frame.columns:
        return []
    how = how or ("average" if RATE_NAME.search(measure) else "sum")
    numbers = pd.to_numeric(frame[measure], errors="coerce")
    working = pd.DataFrame({"name": frame[category].astype(str), "value": numbers}).dropna()
    if working.empty:
        return []
    grouped = working.groupby("name")["value"]
    series = grouped.mean() if how == "average" else (
        grouped.count() if how == "count" else grouped.sum()
    )
    return [
        {"name": str(name), "value": float(value)}
        for name, value in series.sort_values(ascending=False).items()
    ]


def describe_series(points: list[dict], category: str, measure: str, how: str = "sum") -> str:
    """The highest, the lowest, the middle, and how uneven the spread is."""
    if not points:
        return "There are no comparable values for this combination of columns."
    values = [p["value"] for p in points]
    top, bottom = points[0], points[-1]
    mean = sum(values) / len(values)
    mid = median(values)
    unit = pretty(measure)
    place = pretty(category)
    verb = "averages" if how == "average" else "totals"

    if len(points) == 1:
        return f"Only one {place} has data: {top['name']}, where {unit} {verb} {fmt(top['value'])}."

    lines = [
        f"{top['name']} records the highest {unit} at {fmt(top['value'])}, "
        f"and {bottom['name']} the lowest at {fmt(bottom['value'])}."
    ]
    if bottom["value"] > 0:
        gap = top["value"] / bottom["value"]
        lines.append(
            f"That is a {fmt(gap, 1)}× gap across {len(points)} {place} groups, "
            f"against an average of {fmt(mean)} and a midpoint of {fmt(mid)}."
        )
    else:
        lines.append(
            f"Across {len(points)} {place} groups the average is {fmt(mean)} "
            f"and the midpoint is {fmt(mid)}."
        )

    total = sum(values)
    if total > 0 and len(points) >= 5 and how != "average":
        top_three = sum(values[:3]) / total * 100
        lines.append(
            f"The three largest groups hold {fmt(top_three)}% of the combined total, "
            f"so the measure is {'concentrated in a few places' if top_three > 50 else 'spread fairly evenly'}."
        )
    above = sum(1 for v in values if v > mean)
    lines.append(
        f"{above} of {len(points)} groups sit above the average, "
        f"{'so a small number of high values pull the average up' if above < len(points) / 2 else 'so the distribution leans high'}."
    )
    return " ".join(lines)


def describe_frame(frame: pd.DataFrame, profiles: list[dict]) -> str:
    """A short readable summary of the file as a whole."""
    rows, columns = len(frame), len(frame.columns)
    measures = [p for p in profiles if p["role"] == "measure"]
    dimensions = [p for p in profiles if p["role"] == "dimension"]
    missing = sum(p["missing"] for p in profiles)
    parts = [
        f"This file holds {rows:,} rows and {columns} columns: "
        f"{len(measures)} numeric measures and {len(dimensions)} grouping columns."
    ]
    if missing:
        parts.append(f"{missing:,} values are blank across the file.")
    else:
        parts.append("No values are missing.")
    constants = [p["name"] for p in profiles if p["role"] == "constant"]
    if constants:
        shown = ", ".join(constants[:3])
        parts.append(
            f"{len(constants)} column{'s' if len(constants) > 1 else ''} never change "
            f"({shown}{'…' if len(constants) > 3 else ''}), so they are kept off the chart axes."
        )
    return " ".join(parts)


def correlation_note(frame: pd.DataFrame, left: str, right: str) -> str | None:
    a = pd.to_numeric(frame[left], errors="coerce")
    b = pd.to_numeric(frame[right], errors="coerce")
    pair = pd.DataFrame({"a": a, "b": b}).dropna()
    if len(pair) < 8:
        return None
    r = pair["a"].corr(pair["b"])
    if r is None or pd.isna(r):
        return None
    strength = (
        "almost no" if abs(r) < 0.2
        else "a weak" if abs(r) < 0.4
        else "a moderate" if abs(r) < 0.6
        else "a strong" if abs(r) < 0.8
        else "a very strong"
    )
    direction = "positive" if r > 0 else "negative"
    tail = (
        "they rise together" if r > 0.2
        else "one falls as the other rises" if r < -0.2
        else "knowing one tells you little about the other"
    )
    return (
        f"{pretty(left)} and {pretty(right)} show {strength} {direction} relationship "
        f"(r = {r:.2f}) across {len(pair):,} records — {tail}."
    )


def trend_note(points: Iterable[dict], measure: str) -> str | None:
    series = list(points)
    if len(series) < 3:
        return None
    first, last = series[0]["value"], series[-1]["value"]
    if first == 0:
        return None
    change = (last - first) / abs(first) * 100
    direction = "rose" if change > 1 else "fell" if change < -1 else "held steady"
    return (
        f"{pretty(measure)} {direction} from {fmt(first)} at {series[0]['name']} "
        f"to {fmt(last)} at {series[-1]['name']}, a change of {fmt(change)}%."
    )
