# Analytics tests: check that actual dataframe structure drives summaries and chart suggestions.
import pandas as pd
from app.analytics.analysis import analyze

def test_analysis_reports_missing_duplicates_and_recommendations():
    result = analyze(pd.DataFrame({'district':['A','A','B'], 'year':[2020,2021,2022], 'population':[10,12,14]}))
    assert result['rows'] == 3
    assert result['duplicate_rows'] == 0
    assert any(item['type'] == 'bar' for item in result['recommendations'])
    assert any(item['type'] == 'line' for item in result['recommendations'])

def test_analysis_counts_missing_values():
    result = analyze(pd.DataFrame({'value':[1,None,3]}))
    assert result['missing'] == {'value': 1}
