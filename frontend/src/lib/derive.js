// Indicators worked out from columns the file already has.
//
// Nothing here invents data. Each rule only runs when every column it needs is
// present, so an uploaded file that happens to carry the same census fields
// gets the same indicators, and one that does not simply gets fewer charts.
import { toNumber } from './format.js';

const ratio = (a, b, scale = 100) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a / b) * scale : null);

export const DERIVED_RULES = [
  // Education
  {
    name: 'Male_Literacy_Rate_Pct',
    label: 'male literacy rate',
    requires: ['M_LIT', 'TOT_M', 'M_06'],
    compute: (g) => ratio(g('M_LIT'), g('TOT_M') - g('M_06')),
    about: 'Literate males as a share of males aged 7 and over.',
  },
  {
    name: 'Female_Literacy_Rate_Pct',
    label: 'female literacy rate',
    requires: ['F_LIT', 'TOT_F', 'F_06'],
    compute: (g) => ratio(g('F_LIT'), g('TOT_F') - g('F_06')),
    about: 'Literate females as a share of females aged 7 and over.',
  },
  {
    name: 'Literacy_Gender_Gap_Pct',
    label: 'literacy gender gap',
    requires: ['Male_Literacy_Rate_Pct', 'Female_Literacy_Rate_Pct'],
    compute: (g) => g('Male_Literacy_Rate_Pct') - g('Female_Literacy_Rate_Pct'),
    about: 'Male literacy rate minus female literacy rate, in percentage points.',
  },
  {
    name: 'Illiteracy_Rate_Pct',
    label: 'illiteracy rate',
    requires: ['P_ILL', 'TOT_P', 'P_06'],
    compute: (g) => ratio(g('P_ILL'), g('TOT_P') - g('P_06')),
    about: 'Illiterate persons as a share of the population aged 7 and over.',
  },

  // Population and households
  {
    name: 'Avg_Household_Size',
    label: 'average household size',
    requires: ['TOT_P', 'No_HH'],
    compute: (g) => ratio(g('TOT_P'), g('No_HH'), 1),
    about: 'People per household.',
  },
  {
    name: 'Female_Share_Pct',
    label: 'female share of population',
    requires: ['TOT_F', 'TOT_P'],
    compute: (g) => ratio(g('TOT_F'), g('TOT_P')),
    about: 'Females as a share of all people counted.',
  },
  {
    name: 'Child_Share_Pct',
    label: 'children aged 0–6 as a share',
    requires: ['P_06', 'TOT_P'],
    compute: (g) => ratio(g('P_06'), g('TOT_P')),
    about: 'Children aged 0–6 as a share of the population.',
  },
  {
    name: 'SC_Share_Pct',
    label: 'Scheduled Caste share',
    requires: ['P_SC', 'TOT_P'],
    compute: (g) => ratio(g('P_SC'), g('TOT_P')),
    about: 'Scheduled Caste population as a share of the total.',
  },
  {
    name: 'ST_Share_Pct',
    label: 'Scheduled Tribe share',
    requires: ['P_ST', 'TOT_P'],
    compute: (g) => ratio(g('P_ST'), g('TOT_P')),
    about: 'Scheduled Tribe population as a share of the total.',
  },
  {
    name: 'Population_Added_Since_2011',
    label: 'people added since 2011',
    requires: ['TOT_P', 'Baseline_Pop_2011'],
    compute: (g) => g('TOT_P') - g('Baseline_Pop_2011'),
    about: 'Headcount in 2026 minus the 2011 baseline for the same block.',
  },

  // Work
  {
    name: 'Male_Work_Participation_Pct',
    label: 'male work participation',
    requires: ['TOT_WORK_M', 'TOT_M'],
    compute: (g) => ratio(g('TOT_WORK_M'), g('TOT_M')),
    about: 'Working males as a share of all males.',
  },
  {
    name: 'Female_Work_Participation_Pct',
    label: 'female work participation',
    requires: ['TOT_WORK_F', 'TOT_F'],
    compute: (g) => ratio(g('TOT_WORK_F'), g('TOT_F')),
    about: 'Working females as a share of all females.',
  },
  {
    name: 'Marginal_Worker_Share_Pct',
    label: 'marginal share of workers',
    requires: ['MARGWORK_P', 'TOT_WORK_P'],
    compute: (g) => ratio(g('MARGWORK_P'), g('TOT_WORK_P')),
    about: 'Marginal workers — those employed under six months a year — as a share of all workers.',
  },
  {
    name: 'Non_Workers_Per_Worker',
    label: 'non-workers per worker',
    requires: ['NON_WORK_P', 'TOT_WORK_P'],
    compute: (g) => ratio(g('NON_WORK_P'), g('TOT_WORK_P'), 1),
    about: 'How many non-working people each worker supports.',
  },

  // Agriculture, from the agrarian workforce the census records
  {
    name: 'Agricultural_Workers',
    label: 'agricultural workers',
    requires: ['MAIN_CL_P', 'MAIN_AL_P'],
    compute: (g) => g('MAIN_CL_P') + g('MAIN_AL_P'),
    about: 'Cultivators plus agricultural labourers.',
  },
  {
    name: 'Agricultural_Worker_Share_Pct',
    label: 'agricultural share of workers',
    requires: ['Agricultural_Workers', 'TOT_WORK_P'],
    compute: (g) => ratio(g('Agricultural_Workers'), g('TOT_WORK_P')),
    about: 'Agricultural workers as a share of all workers.',
  },
  {
    name: 'Cultivator_Share_Of_Farm_Work_Pct',
    label: 'cultivators within farm work',
    requires: ['MAIN_CL_P', 'Agricultural_Workers'],
    compute: (g) => ratio(g('MAIN_CL_P'), g('Agricultural_Workers')),
    about: 'Cultivators, who farm their own land, as a share of all agricultural workers. The rest are landless labourers.',
  },
  {
    name: 'Agricultural_Workers_Per_1000',
    label: 'agricultural workers per 1,000 people',
    requires: ['Agricultural_Workers', 'TOT_P'],
    compute: (g) => ratio(g('Agricultural_Workers'), g('TOT_P'), 1000),
    about: 'Agricultural workers for every 1,000 residents.',
  },

  // Housing stock and service load
  {
    name: 'Households_Per_1000',
    label: 'households per 1,000 people',
    requires: ['No_HH', 'TOT_P'],
    compute: (g) => ratio(g('No_HH'), g('TOT_P'), 1000),
    about: 'Households for every 1,000 residents — fewer households per 1,000 means larger homes.',
  },
  {
    name: 'Household_Industry_Share_Pct',
    label: 'household-industry share of workers',
    requires: ['MAIN_HH_P', 'TOT_WORK_P'],
    compute: (g) => ratio(g('MAIN_HH_P'), g('TOT_WORK_P')),
    about: 'Workers running an industry from home, as a share of all workers — a marker of workshop housing.',
  },
];

/**
 * Append every indicator this dataset supports, in dependency order.
 * Returns the original preview untouched when nothing can be derived.
 */
export function withDerivedColumns(preview) {
  if (!preview?.columns?.length || !preview.rows?.length) return preview;

  const columns = [...preview.columns];
  const indexOf = new Map(columns.map((name, i) => [name, i]));
  const applied = [];

  for (const rule of DERIVED_RULES) {
    if (indexOf.has(rule.name)) continue;
    if (!rule.requires.every((need) => indexOf.has(need))) continue;
    applied.push(rule);
    indexOf.set(rule.name, columns.length);
    columns.push(rule.name);
  }

  if (!applied.length) return { ...preview, derived: [] };

  const rows = preview.rows.map((row) => {
    const extended = [...row];
    const get = (name) => {
      const index = indexOf.get(name);
      return index === undefined ? NaN : toNumber(extended[index]);
    };
    for (const rule of applied) {
      const value = rule.compute(get);
      extended[indexOf.get(rule.name)] = value === null || !Number.isFinite(value) ? '' : Number(value.toFixed(4));
    }
    return extended;
  });

  return { ...preview, columns, rows, derived: applied.map((r) => ({ name: r.name, about: r.about, label: r.label })) };
}

export const derivedNote = (name) => DERIVED_RULES.find((rule) => rule.name === name)?.about || null;
