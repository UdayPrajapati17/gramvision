// Reading a chart out loud.
//
// Every sentence below is generated from the same numbers the chart draws —
// the highest and lowest groups, the gap between them, the average, how evenly
// the measure is spread and anything unusual. Nothing is hard-coded about any
// particular dataset, so an uploaded file gets the same treatment as the
// bundled census extract.
import { full, isRateColumn, prettyLabel, titleLabel, unitSuffix } from './format.js';

const value = (n, column) => `${full(n)}${unitSuffix(column)}`;

function stats(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / numbers.length;
  const mid = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / numbers.length;
  return { sum, mean, median: mid, std: Math.sqrt(variance), min: sorted[0], max: sorted[sorted.length - 1] };
}

/** The reading under a ranked bar chart: one measure across one set of groups. */
export function readCategorical(points, { category, measure, aggregation = 'sum' } = {}) {
  if (!points?.length) {
    return {
      headline: 'Nothing to compare yet',
      body: 'No rows carry a number for this measure once the current filters are applied. Pick a different measure, or clear a filter.',
    };
  }

  const groupWord = prettyLabel(category) || 'group';
  const measureWord = prettyLabel(measure) || 'the measure';
  const percent = unitSuffix(measure) === '%';
  const numbers = points.map((p) => p.value);
  const { mean, median, std, sum } = stats(numbers);
  const ranked = [...points].sort((a, b) => b.value - a.value);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const verb = aggregation === 'average' ? 'averages' : aggregation === 'count' ? 'counts' : 'totals';

  if (points.length === 1) {
    return {
      headline: `${top.name} is the only group with data`,
      body: `${titleLabel(measure)} ${verb} ${value(top.value, measure)} there. Add more groups, or widen the filter, to compare.`,
    };
  }

  const headline = percent
    ? `${top.name} leads at ${value(top.value, measure)}, ${bottom.name} trails at ${value(bottom.value, measure)}`
    : `${top.name} is highest, ${bottom.name} lowest`;

  const sentences = [];
  sentences.push(
    `Across ${points.length} ${groupWord} groups, ${measureWord} ${verb} highest in ${top.name} at ` +
      `${value(top.value, measure)} and lowest in ${bottom.name} at ${value(bottom.value, measure)}.`,
  );

  if (percent) {
    sentences.push(
      `That is a spread of ${full(top.value - bottom.value, 1)} percentage points, against an average of ` +
        `${value(mean, measure)} and a midpoint of ${value(median, measure)}.`,
    );
  } else if (bottom.value > 0) {
    sentences.push(
      `The leader is ${full(top.value / bottom.value, 1)}× the lowest group, with an average of ` +
        `${value(mean, measure)} and a midpoint of ${value(median, measure)}.`,
    );
  } else {
    sentences.push(
      `The average is ${value(mean, measure)} and the midpoint is ${value(median, measure)}.`,
    );
  }

  // Concentration only makes sense for quantities that add up.
  if (aggregation !== 'average' && sum > 0 && points.length >= 5) {
    const topThree = (ranked.slice(0, 3).reduce((a, p) => a + p.value, 0) / sum) * 100;
    sentences.push(
      topThree > 55
        ? `The three largest groups account for ${full(topThree, 0)}% of the combined total, so the measure is concentrated in a few places.`
        : `The three largest groups hold ${full(topThree, 0)}% of the combined total, so it is spread fairly evenly.`,
    );
  }

  // How tightly the groups cluster, and anything well outside the pack.
  const variation = mean !== 0 ? std / Math.abs(mean) : 0;
  const outliers = ranked.filter((p) => std > 0 && Math.abs(p.value - mean) > 2 * std);
  if (outliers.length && points.length > 3) {
    const named = outliers.slice(0, 2).map((p) => `${p.name} (${value(p.value, measure)})`).join(' and ');
    sentences.push(`${named} ${outliers.length > 1 ? 'sit' : 'sits'} more than two standard deviations from the average — worth checking before drawing conclusions.`);
  } else if (variation < 0.15) {
    sentences.push(`The groups cluster tightly around the average, so differences here are small.`);
  } else if (points.length > 3) {
    const above = points.filter((p) => p.value > mean).length;
    sentences.push(
      above < points.length / 2
        ? `Only ${above} of ${points.length} groups sit above the average, so a handful of large values pull it upward.`
        : `${above} of ${points.length} groups sit above the average, so the distribution leans high.`,
    );
  }

  return { headline, body: sentences.join(' ') };
}

/** The reading under a grouped or stacked chart comparing two or more measures. */
export function readMulti(rows, keys, { category } = {}) {
  if (!rows?.length || !keys?.length) {
    return { headline: 'Nothing to compare yet', body: 'These columns hold no numbers for the current selection.' };
  }
  const groupWord = prettyLabel(category) || 'group';

  // Rates and shares cannot be added together, so they are compared as averages
  // and the difference between them is read in percentage points.
  const rateMode = keys.every((key) => isRateColumn(key));
  if (rateMode) return readRateComparison(rows, keys, groupWord);

  const totals = keys.map((key) => ({ key, total: rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) }));
  totals.sort((a, b) => b.total - a.total);
  const grand = totals.reduce((a, t) => a + t.total, 0) || 1;
  const biggest = totals[0];
  const smallest = totals[totals.length - 1];

  const sentences = [
    `${titleLabel(biggest.key)} is the largest of the ${keys.length} measures shown, at ${full(biggest.total)} ` +
      `or ${full((biggest.total / grand) * 100, 0)}% of their combined total; ${prettyLabel(smallest.key)} is the smallest at ` +
      `${full((smallest.total / grand) * 100, 0)}%.`,
  ];

  // Which group leans hardest toward the leading measure.
  const shares = rows
    .map((row) => {
      const rowTotal = keys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
      return rowTotal > 0 ? { name: row.name, share: ((Number(row[biggest.key]) || 0) / rowTotal) * 100 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.share - a.share);

  if (shares.length > 1) {
    sentences.push(
      `${shares[0].name} leans most heavily on ${prettyLabel(biggest.key)} at ${full(shares[0].share, 0)}% of its own total, ` +
        `while ${shares[shares.length - 1].name} is lowest at ${full(shares[shares.length - 1].share, 0)}% — the clearest difference between these ${groupWord} groups.`,
    );
  }

  return { headline: `${titleLabel(biggest.key)} dominates the mix`, body: sentences.join(' ') };
}

function readRateComparison(rows, keys, groupWord) {
  const averages = keys
    .map((key) => {
      const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
      return { key, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
    })
    .sort((a, b) => b.mean - a.mean);
  const lead = averages[0];
  const trail = averages[averages.length - 1];
  const unit = unitSuffix(lead.key) || '%';

  // Where the distance between the measures is widest and narrowest.
  const spreads = rows
    .map((row) => {
      const values = keys.map((key) => Number(row[key])).filter(Number.isFinite);
      return values.length > 1 ? { name: row.name, spread: Math.max(...values) - Math.min(...values) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.spread - a.spread);

  const sentences = [
    `Averaged across ${rows.length} ${groupWord} groups, ${prettyLabel(lead.key)} runs at ${full(lead.mean, 1)}${unit} ` +
      `against ${full(trail.mean, 1)}${unit} for ${prettyLabel(trail.key)} — a gap of ` +
      `${full(lead.mean - trail.mean, 1)} percentage points.`,
  ];

  if (spreads.length > 1) {
    sentences.push(
      `The gap is widest in ${spreads[0].name} at ${full(spreads[0].spread, 1)} points and narrowest in ` +
        `${spreads[spreads.length - 1].name} at ${full(spreads[spreads.length - 1].spread, 1)} points, so the ` +
        `${spreads[0].spread / Math.max(spreads[spreads.length - 1].spread, 0.01) > 2 ? 'difference is far from uniform across the district' : 'pattern holds fairly steadily across the district'}.`,
    );
  }

  return {
    headline: `${titleLabel(lead.key)} leads by ${full(lead.mean - trail.mean, 1)} points`,
    body: sentences.join(' '),
  };
}

/** The reading under a scatter plot. */
export function readScatter(points, { x, y } = {}) {
  if (!points || points.length < 8) {
    return {
      headline: 'Not enough points to judge a relationship',
      body: 'A scatter plot needs at least a few dozen records before any pattern is meaningful.',
    };
  }
  const n = points.length;
  const meanX = points.reduce((a, p) => a + p.x, 0) / n;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  let covariance = 0;
  let varX = 0;
  let varY = 0;
  for (const p of points) {
    covariance += (p.x - meanX) * (p.y - meanY);
    varX += (p.x - meanX) ** 2;
    varY += (p.y - meanY) ** 2;
  }
  const r = varX && varY ? covariance / Math.sqrt(varX * varY) : 0;
  const size = Math.abs(r);
  const strength =
    size < 0.2 ? 'almost no' : size < 0.4 ? 'a weak' : size < 0.6 ? 'a moderate' : size < 0.8 ? 'a strong' : 'a very strong';
  const direction = r >= 0 ? 'positive' : 'negative';
  const plain =
    size < 0.2
      ? `knowing one tells you very little about the other`
      : r > 0
        ? `places high on ${prettyLabel(x)} tend to be high on ${prettyLabel(y)} as well`
        : `places high on ${prettyLabel(x)} tend to be low on ${prettyLabel(y)}`;

  const headlineWord = strength.replace(/^a /, '').replace(/^almost no$/, 'no clear');
  return {
    headline: `${headlineWord.charAt(0).toUpperCase()}${headlineWord.slice(1)} ${direction === 'negative' ? 'inverse ' : ''}link`,
    body:
      `Across ${full(n)} records, ${prettyLabel(x)} and ${prettyLabel(y)} show ${strength} ${direction} relationship ` +
      `(correlation r = ${r.toFixed(2)}) — ${plain}. Correlation is not cause: a third factor such as settlement size can drive both.`,
  };
}

/** The reading under a histogram. */
export function readHistogram(histogram, { column } = {}) {
  const { bars, values } = histogram || {};
  if (!bars?.length || !values?.length) {
    return { headline: 'Nothing to plot', body: 'This column holds no numbers for the current selection.' };
  }
  const { mean, median, min, max } = stats(values);
  const busiest = [...bars].sort((a, b) => b.value - a.value)[0];
  const skew = mean > median * 1.1 ? 'right' : mean < median * 0.9 ? 'left' : 'balanced';
  const skewNote =
    skew === 'right'
      ? 'A long tail of high values pulls the average above the midpoint, so typical records sit lower than the average suggests.'
      : skew === 'left'
        ? 'A tail of low values drags the average below the midpoint.'
        : 'The average and the midpoint are close, so the distribution is roughly symmetric.';

  return {
    headline: `Most records fall between ${busiest.name}`,
    body:
      `${full(values.length)} records span ${value(min, column)} to ${value(max, column)}. The busiest band is ` +
      `${busiest.name}, holding ${full(busiest.value)} records (${full((busiest.value / values.length) * 100, 0)}% of the total). ` +
      `The average is ${value(mean, column)} and the midpoint ${value(median, column)}. ${skewNote}`,
  };
}

/** The reading under a part-to-whole chart. */
export function readComposition(parts, { label = 'the total', note } = {}) {
  const usable = (parts || []).filter((p) => Number.isFinite(p.value) && p.value > 0);
  if (!usable.length) {
    return { headline: 'Nothing to break down', body: 'None of these components carry a value for the current selection.' };
  }
  const total = usable.reduce((a, p) => a + p.value, 0);
  const ranked = [...usable].sort((a, b) => b.value - a.value);
  const first = ranked[0];
  const last = ranked[ranked.length - 1];
  const firstShare = (first.value / total) * 100;

  const sentences = [
    `${first.label || titleLabel(first.name)} is the largest share of ${label} at ${full(first.value)} ` +
      `(${full(firstShare, 1)}%), and ${last.label || prettyLabel(last.name)} the smallest at ${full(last.value)} ` +
      `(${full((last.value / total) * 100, 1)}%).`,
  ];
  sentences.push(
    firstShare > 60
      ? `One component carries most of the total, so the others move the overall figure very little.`
      : `No single component dominates, so changes in any of them shift the overall figure.`,
  );
  if (note) sentences.push(note);

  return { headline: `${first.label || titleLabel(first.name)} accounts for ${full(firstShare, 0)}%`, body: sentences.join(' ') };
}

/** The reading under a line chart along a time or ordered axis. */
export function readTrend(points, { x, y } = {}) {
  if (!points || points.length < 2) {
    return { headline: 'Not enough points for a trend', body: 'A trend needs at least two positions along the axis.' };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const numbers = points.map((p) => p.value);
  const { mean, max, min } = stats(numbers);
  const peak = points.find((p) => p.value === max);
  const trough = points.find((p) => p.value === min);
  const change = first.value ? ((last.value - first.value) / Math.abs(first.value)) * 100 : null;
  const direction = change === null ? 'moved' : change > 1 ? 'rose' : change < -1 ? 'fell' : 'held steady';

  const sentences = [
    `${titleLabel(y)} ${direction} from ${value(first.value, y)} at ${first.name} to ${value(last.value, y)} at ${last.name}` +
      (change === null ? '.' : `, a change of ${full(change, 1)}%.`),
  ];
  sentences.push(
    `The peak is ${value(max, y)} at ${peak?.name ?? '—'} and the low point ${value(min, y)} at ${trough?.name ?? '—'}, ` +
      `against an average of ${value(mean, y)} across ${points.length} points on ${prettyLabel(x)}.`,
  );

  return { headline: `${titleLabel(y)} ${direction}`, body: sentences.join(' ') };
}

/** A short comparison of two measures that should be read against each other. */
export function readGap(leftTotal, rightTotal, { leftLabel, rightLabel, unit = '' } = {}) {
  const gap = leftTotal - rightTotal;
  const bigger = gap >= 0 ? leftLabel : rightLabel;
  const smaller = gap >= 0 ? rightLabel : leftLabel;
  return (
    `${bigger} exceeds ${smaller} by ${full(Math.abs(gap), 1)}${unit}` +
    (rightTotal ? ` (${full((Math.abs(gap) / Math.max(leftTotal, rightTotal)) * 100, 1)}% of the larger figure).` : '.')
  );
}
