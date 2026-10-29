// Turning preview rows into the exact arrays each chart draws.
import { isRateColumn, toNumber } from './format.js';

export function columnIndex(preview, name) {
  return preview?.columns?.indexOf(name) ?? -1;
}

export function defaultAggregation(measure) {
  return isRateColumn(measure) ? 'average' : 'sum';
}

function filtered(preview, filters = []) {
  const rows = preview?.rows || [];
  const active = filters.filter((f) => f?.column && f.value !== '' && f.value != null);
  if (!active.length) return rows;
  const resolved = active.map((f) => ({ index: columnIndex(preview, f.column), value: String(f.value) }));
  return rows.filter((row) => resolved.every((f) => f.index >= 0 && String(row[f.index]) === f.value));
}

/**
 * Group one measure by one category, the way a bar chart reads it.
 * Returns points already sorted, plus everything a written reading needs.
 */
export function aggregateSeries(preview, { x, y, aggregation, filters = [], order = 'value_desc', limit = 24 }) {
  const xi = columnIndex(preview, x);
  const yi = columnIndex(preview, y);
  if (xi < 0 || yi < 0) return { points: [], all: [], groupCount: 0, truncated: false, rowsUsed: 0 };

  const how = aggregation || defaultAggregation(y);
  const rows = filtered(preview, filters);
  const groups = new Map();
  for (const row of rows) {
    const name = String(row[xi] ?? '').trim();
    if (!name) continue;
    const value = toNumber(row[yi]);
    const bucket = groups.get(name) || { sum: 0, count: 0, rows: 0 };
    bucket.rows += 1;
    if (Number.isFinite(value)) {
      bucket.sum += value;
      bucket.count += 1;
    }
    groups.set(name, bucket);
  }

  let points = [...groups.entries()]
    .map(([name, bucket]) => ({
      name,
      value:
        how === 'average'
          ? bucket.count
            ? bucket.sum / bucket.count
            : null
          : how === 'count'
            ? bucket.rows
            : bucket.sum,
      records: bucket.rows,
    }))
    .filter((point) => Number.isFinite(point.value));

  if (order === 'value_desc') points.sort((a, b) => b.value - a.value);
  else if (order === 'value_asc') points.sort((a, b) => a.value - b.value);
  else if (order === 'name_asc') points.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  else if (order === 'name_desc') points.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

  const capped = limit > 0 ? points.slice(0, limit) : points;
  return {
    points: capped,
    all: points,
    groupCount: points.length,
    truncated: points.length > capped.length,
    rowsUsed: rows.length,
    aggregation: how,
  };
}

/** Several measures side by side against one category: grouped or stacked bars. */
export function aggregateMulti(preview, { x, measures, aggregation, filters = [], order = 'total_desc', limit = 14 }) {
  const xi = columnIndex(preview, x);
  if (xi < 0 || !measures?.length) return { rows: [], keys: [] };

  const indexes = measures.map((m) => columnIndex(preview, m));
  const rows = filtered(preview, filters);
  const groups = new Map();

  for (const row of rows) {
    const name = String(row[xi] ?? '').trim();
    if (!name) continue;
    const bucket = groups.get(name) || { name, sums: measures.map(() => 0), counts: measures.map(() => 0) };
    indexes.forEach((index, slot) => {
      const value = index >= 0 ? toNumber(row[index]) : NaN;
      if (Number.isFinite(value)) {
        bucket.sums[slot] += value;
        bucket.counts[slot] += 1;
      }
    });
    groups.set(name, bucket);
  }

  let output = [...groups.values()].map((bucket) => {
    const entry = { name: bucket.name };
    measures.forEach((measure, slot) => {
      const how = aggregation || defaultAggregation(measure);
      entry[measure] =
        how === 'average'
          ? bucket.counts[slot]
            ? bucket.sums[slot] / bucket.counts[slot]
            : 0
          : bucket.sums[slot];
    });
    entry.__total = measures.reduce((sum, measure) => sum + (entry[measure] || 0), 0);
    return entry;
  });

  if (order === 'total_desc') output.sort((a, b) => b.__total - a.__total);
  else if (order === 'name_asc') output.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { rows: limit > 0 ? output.slice(0, limit) : output, keys: measures, groupCount: output.length };
}

/** One measure split into equal-width bins. */
export function buildHistogram(preview, { column, bins = 9, filters = [] }) {
  const index = columnIndex(preview, column);
  if (index < 0) return { bars: [], values: [] };
  const values = filtered(preview, filters)
    .map((row) => toNumber(row[index]))
    .filter(Number.isFinite);
  if (!values.length) return { bars: [], values: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const bars = Array.from({ length: bins }, (_, i) => {
    const low = min + i * width;
    const high = i === bins - 1 ? max : min + (i + 1) * width;
    const count = values.filter((v) => (i === bins - 1 ? v >= low && v <= high : v >= low && v < high)).length;
    return { name: formatBin(low, high), low, high, value: count };
  });
  return { bars, values, min, max, width };
}

function formatBin(low, high) {
  const round = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-IN') : Number(n.toFixed(1)));
  return `${round(low)}–${round(high)}`;
}

/** Raw pairs for a scatter plot, capped so the browser stays responsive. */
export function buildScatter(preview, { x, y, filters = [], limit = 5000 }) {
  const xi = columnIndex(preview, x);
  const yi = columnIndex(preview, y);
  if (xi < 0 || yi < 0) return [];
  const points = [];
  for (const row of filtered(preview, filters)) {
    const xv = toNumber(row[xi]);
    const yv = toNumber(row[yi]);
    if (Number.isFinite(xv) && Number.isFinite(yv)) points.push({ x: xv, y: yv });
    if (points.length >= limit) break;
  }
  return points;
}

/** Column totals across the whole file, for composition charts and stat tiles. */
export function totalsFor(preview, measures, { filters = [], aggregation } = {}) {
  const rows = filtered(preview, filters);
  return measures.map((measure) => {
    const index = columnIndex(preview, measure);
    if (index < 0) return { name: measure, value: 0 };
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const value = toNumber(row[index]);
      if (Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    const how = aggregation || defaultAggregation(measure);
    return { name: measure, value: how === 'average' && count ? sum / count : sum, records: count };
  });
}

export function distinctValues(preview, column, limit = 200) {
  const index = columnIndex(preview, column);
  if (index < 0) return [];
  const seen = new Set();
  for (const row of preview.rows || []) {
    const value = String(row[index] ?? '').trim();
    if (value) seen.add(value);
    if (seen.size >= limit) break;
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
