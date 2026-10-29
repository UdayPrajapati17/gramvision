# Built-in datasets: shipped with the project and readable without any upload.
#
# These are read straight from backend/data on every request and are never copied
# into a user's library, so every account sees the same figures and no duplicate
# dataset records pile up.
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

BUILTIN_SOURCES: dict[str, dict] = {
    "surat": {
        "slug": "surat",
        "key": "builtin:surat",
        "name": "Surat Census 2026 — Primary Census Abstract",
        "short_name": "Surat Census 2026",
        "file": "Surat_Census_2026_PCA_2000_Sample.csv",
        "description": (
            "Enumeration-block records for Surat district covering households, "
            "population, literacy and the working population."
        ),
        "provenance": "Primary Census Abstract extract supplied by the workspace owner.",
        "region": "Surat, Gujarat",
    }
}

DEFAULT_SOURCE = "surat"


def source_or_error(slug: str) -> dict:
    source = BUILTIN_SOURCES.get(slug.strip().lower())
    if not source:
        raise KeyError(slug)
    return source


@lru_cache(maxsize=4)
def _load(slug: str, stamp: float) -> pd.DataFrame:
    source = source_or_error(slug)
    path = DATA_DIR / source["file"]
    return pd.read_csv(path)


def file_path(slug: str) -> Path:
    return DATA_DIR / source_or_error(slug)["file"]


def load_frame(slug: str) -> pd.DataFrame:
    """Read a built-in dataset, re-reading it if the file on disk changed."""
    path = file_path(slug)
    if not path.exists():
        raise FileNotFoundError(path)
    return _load(slug, path.stat().st_mtime).copy()


def describe(slug: str) -> dict:
    source = source_or_error(slug)
    path = file_path(slug)
    frame = load_frame(slug)
    return {
        "id": source["key"],
        "slug": source["slug"],
        "key": source["key"],
        "name": source["name"],
        "short_name": source["short_name"],
        "description": source["description"],
        "provenance": source["provenance"],
        "region": source["region"],
        "format": "csv",
        "size": path.stat().st_size,
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "column_names": [str(c) for c in frame.columns],
        "builtin": True,
    }


def catalogue() -> list[dict]:
    return [describe(slug) for slug in BUILTIN_SOURCES]
