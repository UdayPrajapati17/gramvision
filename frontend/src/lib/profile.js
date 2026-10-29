// Working out what each column in a dataset actually is.
//
// The workspace never assumes it knows a file's columns. It reads the values,
// decides which ones identify a row, which classify it and which measure it,
// and only then offers them as chart axes. That is what stops a chart defaulting
// to a district name that never changes or a record id that is different on
// every row.
import { isRateColumn, toNumber } from './format.js';

const IDENTIFIER_NAME = /(^|_)(id|uid|uuid|key|slno|sl_no|serial|record|index|rowid)(_|$)/i;
const CODE_NAME = /(^|_)(code|pin|pincode|zip|lgd|phone|mobile)(_|$)/i;
const TEMPORAL_NAME = /(^|_)(year|yr|date|month|quarter|period|time)(_|$)/i;
const DIMENSION_NAME =
  /(area|ward|zone|village|taluka|tehsil|block|district|state|region|city|town|locality|name|category|type|class|group|sector|segment|gender|sex|tru|rural|urban|status|level|band|cohort|department|crop|season)/i;
const MEASURE_NAME =
  /(pop|population|total|count|number|num|household|hh|lit|illit|work|employ|job|labour|labor|cultivat|farm|agri|crop|yield|produc|area|hectare|acre|irrigat|school|college|student|enrol|health|clinic|hospital|road|water|sanitation|electric|toilet|facilit|amenity|income|revenue|expenditure|budget|rate|percent|pct|ratio|growth|density|size|value|amount|sc|st)/i;
const HEADLINE_MEASURE = /(^tot_p$|total_pop|^population$|^pop$|^tot_|_total$|^total_)/i;
const STRONG_MEASURE =
  /(population|household|^no_hh$|literacy|worker|employ|production|yield|cultivat|area|enrol|income|revenue)/i;
const SPLIT_MEASURE = /(^|_)(m|f|male|female|boys|girls)(_|$)/i;

function looksLikeYear(values) {
  if (!values.length) return false;
  const inside = values.filter((v) => v >= 1800 && v <= 2200 && Number.isInteger(v)).length;
  return inside / values.length > 0.95;
}

export function profileColumn(columns, rows, name) {
  const index = columns.indexOf(name);
  const raw = rows.map((row) => row[index]);
  const present = raw.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  const total = rows.length || 1;
  const missing = rows.length - present.length;
  const numbers = present.map(toNumber).filter(Number.isFinite);
  const numericShare = present.length ? numbers.length / present.length : 0;
  const isNumeric = numericShare >= 0.9 && numbers.length > 0;
  const distinct = new Set(present.map(String)).size;

  const profile = {
    name,
    index,
    missing,
    distinct,
    total: rows.length,
    isNumeric,
    sampleValues: [...new Set(present.map(String))].slice(0, 12),
  };

  if (isNumeric) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / numbers.length;
    const variance = numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / numbers.length;
    Object.assign(profile, {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      sum,
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      std: Math.sqrt(variance),
    });
  }

  let role;
  if (distinct <= 1) role = 'constant';
  else if (IDENTIFIER_NAME.test(name) && distinct >= total * 0.9) role = 'identifier';
  else if (!isNumeric && distinct >= total * 0.95 && total > 20) role = 'identifier';
  else if (TEMPORAL_NAME.test(name) && (!isNumeric || looksLikeYear(numbers))) role = 'temporal';
  else if (CODE_NAME.test(name) || (isNumeric && IDENTIFIER_NAME.test(name))) role = 'code';
  else if (isNumeric) role = 'measure';
  else role = 'dimension';

  profile.role = role;
  profile.aggregation = role === 'measure' && isRateColumn(name) ? 'average' : 'sum';
  profile.usableAsCategory =
    (role === 'dimension' || role === 'temporal') && distinct > 1 && distinct <= Math.max(60, total * 0.5);
  profile.usableAsMeasure = role === 'measure' && distinct > 1;
  return profile;
}

export function profileDataset(preview) {
  if (!preview?.columns?.length) return [];
  return preview.columns.map((name) => profileColumn(preview.columns, preview.rows || [], name));
}

export function scoreCategory(profile) {
  if (!profile.usableAsCategory) return -1;
  const total = Math.max(profile.total, 1);
  let score = 10;
  if (profile.distinct >= 4 && profile.distinct <= 30) score += 30;
  else if (profile.distinct <= 3) score += 8;
  else if (profile.distinct <= 60) score += 18;
  else score += 4;
  score -= (profile.distinct / total) * 25;
  if (DIMENSION_NAME.test(profile.name)) score += 14;
  if (profile.role === 'temporal') score -= 6;
  score -= (profile.missing / total) * 10;
  return score;
}

export function scoreMeasure(profile) {
  if (!profile.usableAsMeasure) return -1;
  const total = Math.max(profile.total, 1);
  let score = 10;
  if (HEADLINE_MEASURE.test(profile.name)) score += 26;
  else if (STRONG_MEASURE.test(profile.name)) score += 18;
  else if (MEASURE_NAME.test(profile.name)) score += 10;
  if (SPLIT_MEASURE.test(profile.name)) score -= 9;
  if (profile.mean && profile.std) score += Math.min(Math.abs(profile.std / profile.mean), 1.5) * 5;
  score += Math.min(profile.distinct / total, 1) * 4;
  score -= (profile.missing / total) * 12;
  return score;
}

// TOT_P, TOT_M and TOT_F all describe one thing, so suggestions keep only one.
export function measureFamily(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/^(p|m|f|tot|main|marg|non)_/, '')
      .replace(/_(p|m|f|persons?|males?|females?)$/, '') || String(name).toLowerCase()
  );
}

export function pickCategory(profiles) {
  const ranked = [...profiles].sort((a, b) => scoreCategory(b) - scoreCategory(a));
  return ranked.length && scoreCategory(ranked[0]) > 0 ? ranked[0].name : null;
}

export function pickMeasures(profiles, count = 1) {
  const ranked = [...profiles].filter((p) => scoreMeasure(p) > 0).sort((a, b) => scoreMeasure(b) - scoreMeasure(a));
  const chosen = [];
  const families = new Set();
  for (const profile of ranked) {
    const family = measureFamily(profile.name);
    if (families.has(family)) continue;
    families.add(family);
    chosen.push(profile.name);
    if (chosen.length >= count) break;
  }
  for (const profile of ranked) {
    if (chosen.length >= count) break;
    if (!chosen.includes(profile.name)) chosen.push(profile.name);
  }
  return chosen.slice(0, count);
}

export function pickTemporal(profiles) {
  const found = profiles.find((p) => p.role === 'temporal' && p.distinct > 1);
  return found ? found.name : null;
}

export const categoryOptions = (profiles) =>
  [...profiles].filter((p) => p.usableAsCategory).sort((a, b) => scoreCategory(b) - scoreCategory(a));

export const measureOptions = (profiles) =>
  [...profiles].filter((p) => p.usableAsMeasure).sort((a, b) => scoreMeasure(b) - scoreMeasure(a));

// Columns that cannot carry a chart, kept out of the pickers but reported so
// the reason is visible rather than mysterious.
export const unusableColumns = (profiles) =>
  profiles.filter((p) => ['constant', 'identifier', 'code'].includes(p.role));
