// Chart colour, fixed by role rather than picked per chart.
//
// The eight categorical hues were validated as an ordered set against a white
// chart surface: every neighbouring pair stays apart under protanopia,
// deuteranopia and tritanopia as well as for full-colour vision. Slots are
// assigned in order and never cycled — a ninth series folds into "Other".

export const BRAND = '#0f9b83';

export const SERIES = [
  '#0f9b83', // teal — the brand, and the single-series default
  '#eb6834', // orange
  '#2a78d6', // blue
  '#eda100', // amber
  '#e87ba4', // magenta
  '#008300', // green
  '#6250d6', // violet
  '#e34948', // red
];

// Charts where every pair is seen at once (pie, scatter) stay inside the first
// three slots, which clear the separation floors for all pairs rather than
// neighbouring ones only.
export const ALL_PAIRS_LIMIT = 3;

export const CHART_INK = {
  surface: '#ffffff',
  grid: '#e7edea',
  axis: '#c3d2cd',
  tick: '#7b8f88',
  label: '#334b43',
  strong: '#102a24',
};

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export function seriesColor(index) {
  return SERIES[index % SERIES.length];
}

// A 10% wash of the series hue, for area fills.
export function wash(hex, alpha = 0.12) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
