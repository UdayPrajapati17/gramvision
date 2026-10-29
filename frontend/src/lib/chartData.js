// One place that turns a chart specification into drawable data plus its reading.
//
// Both the topic dashboards and the chart builder go through here, so a chart
// built by hand and a chart generated for you are computed and explained in
// exactly the same way.
import { aggregateMulti, aggregateSeries, buildHistogram, buildScatter, totalsFor } from './aggregate.js';
import { titleLabel, prettyLabel } from './format.js';
import {
  readCategorical,
  readComposition,
  readHistogram,
  readMulti,
  readScatter,
  readTrend,
} from './interpret.js';

export const MULTI_TYPES = new Set(['stacked', 'grouped']);
export const COMPOSITION_TYPES = new Set(['pie', 'donut']);

/** A title that describes whatever the chart currently shows. */
export function autoTitle(spec) {
  const { chartType = 'bar' } = spec;
  if (chartType === 'histogram') return `Spread of ${prettyLabel(spec.y || spec.x)}`;
  if (chartType === 'scatter') return `${titleLabel(spec.x)} against ${prettyLabel(spec.y)}`;
  const many = spec.measures?.length > 1;
  if (COMPOSITION_TYPES.has(chartType)) {
    return many
      ? `${spec.measures.map(titleLabel).slice(0, 2).join(' and ')} as shares`
      : `${titleLabel(spec.y)} split by ${prettyLabel(spec.x)}`;
  }
  if (MULTI_TYPES.has(chartType) && many) {
    const named = spec.measures.slice(0, 2).map((m, i) => (i ? prettyLabel(m) : titleLabel(m))).join(' and ');
    const extra = spec.measures.length > 2 ? ` and ${spec.measures.length - 2} more` : '';
    return `${named}${extra} by ${prettyLabel(spec.x)}`;
  }
  return `${titleLabel(spec.y)} by ${prettyLabel(spec.x)}`;
}

export function buildChartData(preview, spec) {
  const { chartType = 'bar' } = spec;
  const filters = (spec.filters || []).filter((f) => f?.column && f.value);

  if (chartType === 'histogram') {
    const histogram = buildHistogram(preview, { column: spec.y || spec.x, bins: spec.bins || 9, filters });
    return {
      shape: 'histogram',
      data: histogram.bars,
      keys: ['value'],
      reading: readHistogram(histogram, { column: spec.y || spec.x }),
      empty: !histogram.bars.length,
      axisLabel: titleLabel(spec.y || spec.x),
      valueLabel: 'Records',
    };
  }

  if (chartType === 'scatter') {
    const points = buildScatter(preview, { x: spec.x, y: spec.y, filters });
    return {
      shape: 'scatter',
      data: points,
      keys: ['y'],
      reading: readScatter(points, { x: spec.x, y: spec.y }),
      empty: !points.length,
      axisLabel: titleLabel(spec.x),
      valueLabel: titleLabel(spec.y),
    };
  }

  if (COMPOSITION_TYPES.has(chartType)) {
    // Several measures compared as parts of one whole…
    if (spec.measures?.length > 1) {
      const totals = totalsFor(preview, spec.measures, { filters, aggregation: spec.aggregation });
      const parts = totals.map((t) => ({ ...t, label: titleLabel(t.name) }));
      return {
        shape: 'composition',
        data: parts.map((p) => ({ name: p.label, value: p.value })),
        keys: ['value'],
        reading: readComposition(parts, { label: spec.wholeLabel || 'the total', note: spec.note }),
        empty: !parts.some((p) => p.value > 0),
      };
    }
    // …or one measure split across the groups of a category.
    const grouped = aggregateSeries(preview, {
      x: spec.x,
      y: spec.y,
      aggregation: spec.aggregation,
      filters,
      order: 'value_desc',
      limit: spec.limit || 8,
    });
    return {
      shape: 'composition',
      data: grouped.points,
      keys: ['value'],
      reading: readComposition(
        grouped.points.map((p) => ({ ...p, label: p.name })),
        { label: `total ${prettyLabel(spec.y)}`, note: spec.note },
      ),
      empty: !grouped.points.length,
      groupCount: grouped.groupCount,
      truncated: grouped.truncated,
    };
  }

  if (MULTI_TYPES.has(chartType) && spec.measures?.length) {
    const result = aggregateMulti(preview, {
      x: spec.x,
      measures: spec.measures,
      aggregation: spec.aggregation,
      filters,
      order: spec.order === 'name_asc' ? 'name_asc' : 'total_desc',
      limit: spec.limit || 12,
    });
    return {
      shape: chartType,
      data: result.rows,
      keys: result.keys,
      reading: readMulti(result.rows, result.keys, { category: spec.x }),
      empty: !result.rows.length,
      groupCount: result.groupCount,
      truncated: result.groupCount > result.rows.length,
      axisLabel: titleLabel(spec.x),
    };
  }

  // Everything else is one measure across one category.
  const grouped = aggregateSeries(preview, {
    x: spec.x,
    y: spec.y,
    aggregation: spec.aggregation,
    filters,
    order: spec.order || (chartType === 'line' || chartType === 'area' ? 'name_asc' : 'value_desc'),
    limit: spec.limit || 24,
  });

  const timeLike = chartType === 'line' || chartType === 'area';
  return {
    shape: chartType === 'hbar' ? 'hbar' : chartType === 'dot' ? 'dot' : chartType,
    data: grouped.points,
    keys: ['value'],
    reading: timeLike
      ? readTrend(grouped.points, { x: spec.x, y: spec.y })
      : readCategorical(grouped.points, {
          category: spec.x,
          measure: spec.y,
          aggregation: grouped.aggregation,
        }),
    empty: !grouped.points.length,
    groupCount: grouped.groupCount,
    truncated: grouped.truncated,
    aggregation: grouped.aggregation,
    rowsUsed: grouped.rowsUsed,
    axisLabel: titleLabel(spec.x),
    valueLabel: titleLabel(spec.y),
  };
}
