// Turning raw column keys and numbers into something a reader recognises.

// Census abbreviations, spelled out. Anything not listed falls back to a tidy
// title-cased version of the column name, so uploaded files read sensibly too.
const CENSUS_NAMES = {
  tot_p: 'total population',
  tot_m: 'male population',
  tot_f: 'female population',
  p_06: 'children aged 0–6',
  m_06: 'boys aged 0–6',
  f_06: 'girls aged 0–6',
  p_sc: 'Scheduled Caste population',
  m_sc: 'Scheduled Caste males',
  f_sc: 'Scheduled Caste females',
  p_st: 'Scheduled Tribe population',
  m_st: 'Scheduled Tribe males',
  f_st: 'Scheduled Tribe females',
  p_lit: 'literate persons',
  m_lit: 'literate males',
  f_lit: 'literate females',
  p_ill: 'illiterate persons',
  m_ill: 'illiterate males',
  f_ill: 'illiterate females',
  no_hh: 'households',
  tot_work_p: 'total workers',
  tot_work_m: 'male workers',
  tot_work_f: 'female workers',
  mainwork_p: 'main workers',
  mainwork_m: 'main workers, male',
  mainwork_f: 'main workers, female',
  margwork_p: 'marginal workers',
  margwork_m: 'marginal workers, male',
  margwork_f: 'marginal workers, female',
  non_work_p: 'non-workers',
  non_work_m: 'non-working males',
  non_work_f: 'non-working females',
  main_cl_p: 'cultivators',
  main_al_p: 'agricultural labourers',
  main_hh_p: 'household-industry workers',
  main_ot_p: 'other workers',
  sex_ratio: 'sex ratio',
  child_sex_ratio_06: 'child sex ratio',
  effective_literacy_rate_pct: 'effective literacy rate',
  work_participation_rate_pct: 'work participation rate',
  growth_2011_to_2026_pct: 'growth since 2011',
  baseline_pop_2011: 'population in 2011',
  smc_zone_name: 'municipal zone',
  smc_zone_code: 'zone code',
  ward_code: 'ward',
  area_name: 'area',
  enumeration_block: 'enumeration block',
  tru: 'rural or urban',
  district_name: 'district',
  state_name: 'state',
  census_year: 'census year',

  // Indicators GramVision works out from the columns above.
  male_literacy_rate_pct: 'male literacy rate',
  female_literacy_rate_pct: 'female literacy rate',
  literacy_gender_gap_pct: 'literacy gender gap',
  illiteracy_rate_pct: 'illiteracy rate',
  avg_household_size: 'average household size',
  female_share_pct: 'female share of population',
  child_share_pct: 'share aged 0–6',
  sc_share_pct: 'Scheduled Caste share',
  st_share_pct: 'Scheduled Tribe share',
  population_added_since_2011: 'people added since 2011',
  male_work_participation_pct: 'male work participation',
  female_work_participation_pct: 'female work participation',
  marginal_worker_share_pct: 'marginal share of workers',
  non_workers_per_worker: 'non-workers per worker',
  agricultural_workers: 'agricultural workers',
  agricultural_worker_share_pct: 'agricultural share of workers',
  cultivator_share_of_farm_work_pct: 'cultivators within farm work',
  agricultural_workers_per_1000: 'agricultural workers per 1,000 people',
  households_per_1000: 'households per 1,000 people',
  household_industry_share_pct: 'household-industry share of workers',
};

export function prettyLabel(column) {
  if (!column) return '';
  const key = String(column).toLowerCase();
  if (CENSUS_NAMES[key]) return CENSUS_NAMES[key];
  // A trailing _pct says what the unit is, not what the column measures, and
  // the unit is printed beside every value anyway.
  return String(column)
    .replace(/_(pct|percent|percentage)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function titleLabel(column) {
  const text = prettyLabel(column);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isRateColumn(column) {
  return /(pct|percent|percentage|rate|ratio|index|share|density|avg|average|mean|median|per_capita|per_1000|score|size)/i.test(
    String(column),
  );
}

export function unitSuffix(column) {
  const name = String(column).toLowerCase();
  if (/(pct|percent|percentage)$/.test(name) || /_pct$/.test(name)) return '%';
  if (/rate_pct/.test(name)) return '%';
  return '';
}

// 1,284 · 12.9K · 3.4M — used on axes and stat tiles where space is tight.
export function compact(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString('en-IN');
  return n.toFixed(abs < 10 ? 2 : 1);
}

// One unit for a whole axis, chosen from its largest value, so ticks never read
// "85K, 1.7L, 2.5L" with the unit changing halfway along.
export function axisFormatter(maxAbs = 0) {
  const size = Math.abs(maxAbs);
  const [divisor, suffix] =
    size >= 1_00_00_000 ? [1_00_00_000, 'Cr'] : size >= 1_00_000 ? [1_00_000, 'L'] : size >= 1000 ? [1000, 'K'] : [1, ''];
  return (value) => {
    if (value === 0) return '0';
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const scaled = Number(value) / divisor;
    if (divisor === 1) {
      return Number.isInteger(scaled) ? scaled.toLocaleString('en-IN') : scaled.toFixed(Math.abs(scaled) < 10 ? 2 : 1);
    }
    const text = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '');
    return `${text}${suffix}`;
  };
}

// Full precision, grouped the Indian way, for tooltips and written readings.
export function full(value, decimals) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (decimals !== undefined) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (Number.isInteger(n)) return n.toLocaleString('en-IN');
  return n.toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) < 10 ? 2 : 1 });
}

export function withUnit(value, column) {
  return `${full(value)}${unitSuffix(column)}`;
}

export function truncate(text, length = 22) {
  const value = String(text ?? '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function toNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const text = String(raw).trim();
  if (text === '') return NaN;
  const cleaned = text.replace(/[,\s]/g, '').replace(/^[₹$€£]/, '').replace(/%$/, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
