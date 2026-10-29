# Column profiling decides what can go on a chart axis, so it is tested against
# the real bundled dataset rather than a toy frame.
import pandas as pd
import pytest

from app.analytics.analysis import analyze
from app.analytics.profiling import best_category, best_measures, profile_frame
from app.services import builtin


@pytest.fixture(scope="module")
def census() -> pd.DataFrame:
    return builtin.load_frame("surat")


def role_of(profiles, name):
    return next(p["role"] for p in profiles if p["name"] == name)


def test_columns_that_never_change_are_marked_constant(census):
    profiles = profile_frame(census)
    for column in ("State_Name", "District_Name", "Census_Year", "State_Code", "District_Code"):
        assert role_of(profiles, column) == "constant", column


def test_a_column_unique_to_every_row_is_an_identifier(census):
    assert role_of(profile_frame(census), "Record_ID") == "identifier"


def test_reference_codes_are_not_offered_as_measurements(census):
    profiles = profile_frame(census)
    assert role_of(profiles, "SMC_Zone_Code") == "code"
    assert not next(p for p in profiles if p["name"] == "SMC_Zone_Code")["usable_as_measure"]


def test_rates_are_averaged_and_counts_are_added(census):
    profiles = {p["name"]: p for p in profile_frame(census)}
    assert profiles["Effective_Literacy_Rate_Pct"]["aggregation"] == "average"
    assert profiles["TOT_P"]["aggregation"] == "sum"


def test_axes_chosen_for_the_census_are_meaningful(census):
    profiles = profile_frame(census)
    # A grouping with ten zones beats a district name that is the same in every row.
    assert best_category(profiles) == "SMC_Zone_Name"
    # The headline measure wins over an equally varied but obscure column.
    assert best_measures(profiles, 1) == ["TOT_P"]


def test_suggested_measures_do_not_repeat_the_same_quantity(census):
    chosen = best_measures(profile_frame(census), 3)
    # TOT_P, TOT_M and TOT_F are one quantity split three ways.
    assert len({"TOT_P", "TOT_M", "TOT_F"} & set(chosen)) <= 1


def test_a_file_with_only_identifiers_offers_no_axes():
    frame = pd.DataFrame({"row_id": [1, 2, 3], "label": ["a", "b", "c"], "fixed": [7, 7, 7]})
    profiles = profile_frame(frame)
    assert best_measures(profiles, 1) == []
    assert role_of(profiles, "fixed") == "constant"


def test_analysis_reports_a_category_a_measure_and_a_reading(census):
    summary = analyze(census)
    assert summary["rows"] == 2000
    assert summary["suggested_category"] == "SMC_Zone_Name"
    assert summary["recommendations"]
    assert summary["readings"]
    assert "highest" in summary["readings"][0]
