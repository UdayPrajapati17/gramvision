// The figures a dashboard opens with, worked out from whichever dataset is loaded.
import { totalsFor, aggregateSeries } from './aggregate.js';
import { isRateColumn, titleLabel } from './format.js';
import { pickCategory, pickMeasures, profileDataset } from './profile.js';

const PREFERRED_HERO = ['TOT_P', 'population', 'Population', 'total_population'];
const PREFERRED_FIGURES = [
  'No_HH',
  'Effective_Literacy_Rate_Pct',
  'Work_Participation_Rate_Pct',
  'Growth_2011_to_2026_Pct',
  'Sex_Ratio',
  'Avg_Household_Size',
];

export function buildHeadline(preview) {
  if (!preview?.columns?.length || !preview.rows?.length) return null;
  const profiles = profileDataset(preview);
  const columns = preview.columns;

  const heroColumn =
    PREFERRED_HERO.find((name) => columns.includes(name)) || pickMeasures(profiles, 1)[0] || null;
  if (!heroColumn) return null;

  const [hero] = totalsFor(preview, [heroColumn]);
  const heroIsRate = isRateColumn(heroColumn);

  const chosen = PREFERRED_FIGURES.filter((name) => columns.includes(name)).slice(0, 3);
  const extra = pickMeasures(profiles, 6).filter((name) => name !== heroColumn && !chosen.includes(name));
  const figureColumns = [...chosen, ...extra].slice(0, 3);
  const figures = totalsFor(preview, figureColumns).map((entry) => ({
    column: entry.name,
    label: titleLabel(entry.name),
    value: entry.value,
    aggregated: isRateColumn(entry.name) ? 'average' : 'total',
  }));

  // A part-to-whole strip under the hero, using the clearest two-to-six-way split.
  const splitColumn = ['TRU', 'Rural_Urban', 'region_type'].find((name) => columns.includes(name)) || null;
  let split = null;
  if (splitColumn) {
    const grouped = aggregateSeries(preview, { x: splitColumn, y: heroColumn, aggregation: 'sum', limit: 6 });
    if (grouped.points.length > 1) {
      split = { column: splitColumn, label: titleLabel(splitColumn), parts: grouped.points };
    }
  }

  const groupColumn = pickCategory(profiles);
  const groupCount = groupColumn
    ? new Set(preview.rows.map((row) => String(row[columns.indexOf(groupColumn)]))).size
    : 0;

  return {
    hero: {
      column: heroColumn,
      // totalsFor already averages rate columns and adds up count columns.
      label: titleLabel(heroColumn),
      value: hero.value,
      aggregated: heroIsRate ? 'average' : 'total',
    },
    figures,
    split,
    records: preview.total_rows || preview.rows.length,
    groupColumn,
    groupCount,
    columnCount: columns.length,
  };
}
