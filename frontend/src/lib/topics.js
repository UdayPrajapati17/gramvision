// The five subject dashboards, and the rules that decide what each one can show.
//
// A topic never assumes a column exists. Every chart declares the columns it
// needs; the ones a dataset can support are built, the rest are left out and
// reported, so nothing is ever drawn from values the file does not contain.
import { pickCategory, pickMeasures, pickTemporal, profileDataset } from './profile.js';
import { titleLabel } from './format.js';

// Preferred grouping columns, widest first: zones read better than 112 wards.
const GROUP_PREFERENCE = [
  'SMC_Zone_Name',
  'TRU',
  'Area_Name',
  'Ward_Code',
  'District_Name',
];

export function groupColumn(columns, profiles) {
  const found = GROUP_PREFERENCE.find((name) => columns.includes(name));
  if (found) return found;
  return pickCategory(profiles);
}

export function fineGroupColumn(columns, profiles) {
  if (columns.includes('Area_Name')) return 'Area_Name';
  if (columns.includes('Ward_Code')) return 'Ward_Code';
  return pickCategory(profiles);
}

const has = (columns, ...names) => names.every((name) => columns.includes(name));
const findAll = (columns, pattern) => columns.filter((name) => pattern.test(name));

// Columns that make a topic's own subject directly chartable. When a dataset has
// them the topic charts them; when it does not, the page says so rather than
// inventing values.
const CROP_COLUMNS = /(crop|yield|production|tonne|hectare|acre|irrigat|sown|harvest|cultivated)/i;
const FACILITY_COLUMNS =
  /(road|water|sanitation|electric|toilet|facilit|amenity|hospital|clinic|connectivity|school|drainage|streetlight)/i;

/** True when the topic's own subject columns are missing from this dataset. */
export function gapApplies(topic, columns = []) {
  if (!topic?.gap) return false;
  if (!topic.gap.satisfiedBy) return true;
  return !columns.some((column) => topic.gap.satisfiedBy.test(column));
}

/* ------------------------------------------------------------------ *
 * Topic definitions                                                    *
 * ------------------------------------------------------------------ */

export const TOPICS = [
  {
    id: 'population',
    label: 'Population',
    title: 'Population and demographics',
    lead: 'How many people live where, how the sexes balance out, and where the district has grown since the last count.',
    match: /(pop|household|hh|sex_ratio|male|female|growth|age|sc|st)/i,
    build: ({ columns, group, fine }) => {
      const charts = [];
      if (has(columns, 'TOT_P')) {
        charts.push({
          id: 'pop-by-zone',
          chartType: 'hbar',
          x: group,
          y: 'TOT_P',
          aggregation: 'sum',
          limit: 14,
          title: `Population by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'Total people counted, added up across every enumeration block.',
        });
      }
      if (has(columns, 'TOT_M', 'TOT_F')) {
        charts.push({
          id: 'pop-sex-split',
          chartType: 'stacked',
          x: group,
          measures: ['TOT_M', 'TOT_F'],
          aggregation: 'sum',
          limit: 12,
          title: 'Men and women in each zone',
          subtitle: 'The two halves of the headcount, stacked so the total stays readable.',
        });
      }
      if (has(columns, 'Sex_Ratio')) {
        charts.push({
          id: 'sex-ratio',
          chartType: 'dot',
          x: group,
          y: 'Sex_Ratio',
          aggregation: 'average',
          limit: 14,
          reference: { value: 1000, label: 'Parity' },
          title: 'Sex ratio',
          subtitle: 'Women per 1,000 men. The marked line is parity.',
        });
      }
      if (has(columns, 'Growth_2011_to_2026_Pct')) {
        charts.push({
          id: 'growth',
          chartType: 'hbar',
          x: group,
          y: 'Growth_2011_to_2026_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'Growth since the 2011 baseline',
          subtitle: 'Average percentage change in each block since 2011.',
        });
      }
      if (has(columns, 'Avg_Household_Size')) {
        charts.push({
          id: 'household-size',
          chartType: 'dot',
          x: group,
          y: 'Avg_Household_Size',
          aggregation: 'average',
          limit: 14,
          title: 'People per household',
          subtitle: 'Population divided by the number of households in the same block.',
        });
      }
      if (has(columns, 'SC_Share_Pct', 'ST_Share_Pct')) {
        charts.push({
          id: 'social-groups',
          chartType: 'grouped',
          x: group,
          measures: ['SC_Share_Pct', 'ST_Share_Pct'],
          aggregation: 'average',
          limit: 12,
          title: 'Scheduled Caste and Scheduled Tribe share',
          subtitle: 'Each as a percentage of the population in the same zone.',
        });
      }
      if (has(columns, 'TOT_P') && fine) {
        charts.push({
          id: 'pop-distribution',
          chartType: 'histogram',
          y: 'TOT_P',
          x: fine,
          title: 'How block sizes are distributed',
          subtitle: 'Every enumeration block sorted into bands by the number of people it holds.',
        });
      }
      return charts;
    },
  },

  {
    id: 'education',
    label: 'Education',
    title: 'Education and literacy',
    lead: 'Who can read and write, where the gap between men and women is widest, and how literacy varies block by block.',
    match: /(lit|illit|educat|school|enrol|student|college)/i,
    build: ({ columns, group, fine }) => {
      const charts = [];
      const rate = ['Effective_Literacy_Rate_Pct', 'literacy_percent', 'Literacy_Rate'].find((c) => columns.includes(c));
      if (rate) {
        charts.push({
          id: 'literacy-rate',
          chartType: 'dot',
          x: group,
          y: rate,
          aggregation: 'average',
          limit: 14,
          title: `Literacy rate by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'Average effective literacy rate, counting only people aged 7 and over.',
        });
      }
      if (has(columns, 'Male_Literacy_Rate_Pct', 'Female_Literacy_Rate_Pct')) {
        charts.push({
          id: 'literacy-gender',
          chartType: 'grouped',
          x: group,
          measures: ['Male_Literacy_Rate_Pct', 'Female_Literacy_Rate_Pct'],
          aggregation: 'average',
          limit: 12,
          title: 'Male and female literacy, side by side',
          subtitle: 'Both calculated on the population aged 7 and over.',
        });
      }
      if (has(columns, 'Literacy_Gender_Gap_Pct')) {
        charts.push({
          id: 'literacy-gap',
          chartType: 'hbar',
          x: group,
          y: 'Literacy_Gender_Gap_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'Where the literacy gap is widest',
          subtitle: 'Male literacy rate minus female literacy rate, in percentage points.',
        });
      }
      if (has(columns, 'P_LIT', 'P_ILL')) {
        charts.push({
          id: 'literate-split',
          chartType: 'stacked',
          x: columns.includes('TRU') ? 'TRU' : group,
          measures: ['P_LIT', 'P_ILL'],
          aggregation: 'sum',
          limit: 12,
          title: 'Literate and illiterate people',
          subtitle: 'Headcounts, not rates, so the size of each group is visible.',
        });
      }
      if (rate && has(columns, 'Work_Participation_Rate_Pct')) {
        charts.push({
          id: 'literacy-work',
          chartType: 'scatter',
          x: rate,
          y: 'Work_Participation_Rate_Pct',
          title: 'Literacy against work participation',
          subtitle: 'One point per enumeration block.',
        });
      }
      if (rate) {
        charts.push({
          id: 'literacy-spread',
          chartType: 'histogram',
          y: rate,
          x: fine,
          title: 'Spread of literacy across blocks',
          subtitle: 'How many enumeration blocks fall into each literacy band.',
        });
      }
      return charts;
    },
  },

  {
    id: 'occupation',
    label: 'Occupation',
    title: 'Occupation and workforce',
    lead: 'How many people work, what kind of work the census records, and how much of it is seasonal rather than year-round.',
    match: /(work|employ|job|labour|labor|occupation|worker)/i,
    build: ({ columns, group, fine }) => {
      const charts = [];
      // Largest category first, so the brand colour carries the bulk of each bar
      // and the bright hues fall on the small slices that need picking out.
      const categories = ['MAIN_OT_P', 'MAIN_HH_P', 'MAIN_AL_P', 'MAIN_CL_P'].filter((c) => columns.includes(c));
      if (categories.length >= 2) {
        charts.push({
          id: 'work-mix',
          chartType: 'stacked',
          x: group,
          measures: categories,
          aggregation: 'sum',
          limit: 12,
          title: 'What main workers do',
          subtitle: 'Cultivators, agricultural labourers, household industry and all other work.',
        });
        charts.push({
          id: 'work-mix-share',
          chartType: 'donut',
          measures: categories,
          aggregation: 'sum',
          wholeLabel: 'all main workers in the district',
          title: 'The district-wide mix of main work',
          subtitle: 'Every main worker in the file, grouped by the four census categories.',
        });
      }
      if (has(columns, 'Work_Participation_Rate_Pct')) {
        charts.push({
          id: 'wpr',
          chartType: 'dot',
          x: group,
          y: 'Work_Participation_Rate_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'Work participation rate',
          subtitle: 'Workers as a share of the whole population, averaged across blocks.',
        });
      }
      if (has(columns, 'Male_Work_Participation_Pct', 'Female_Work_Participation_Pct')) {
        charts.push({
          id: 'wpr-gender',
          chartType: 'grouped',
          x: group,
          measures: ['Male_Work_Participation_Pct', 'Female_Work_Participation_Pct'],
          aggregation: 'average',
          limit: 12,
          title: 'Work participation by sex',
          subtitle: 'Working men as a share of all men, and working women as a share of all women.',
        });
      }
      if (has(columns, 'MAINWORK_P', 'MARGWORK_P', 'NON_WORK_P')) {
        charts.push({
          id: 'work-status',
          chartType: 'stacked',
          x: columns.includes('TRU') ? 'TRU' : group,
          measures: ['NON_WORK_P', 'MAINWORK_P', 'MARGWORK_P'],
          aggregation: 'sum',
          limit: 12,
          title: 'Main workers, marginal workers and non-workers',
          subtitle: 'Marginal work means fewer than six months of employment in the year.',
        });
      }
      if (has(columns, 'Marginal_Worker_Share_Pct')) {
        charts.push({
          id: 'marginal-share',
          chartType: 'dot',
          x: group,
          y: 'Marginal_Worker_Share_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'How much work is seasonal',
          subtitle: 'Marginal workers as a share of all workers.',
        });
      }
      return charts;
    },
  },

  {
    id: 'agriculture',
    label: 'Agriculture',
    title: 'Agriculture',
    lead: 'The farming economy as the census records it: who cultivates their own land, who works someone else’s, and where farm work still holds.',
    match: /(agri|farm|crop|cultivat|yield|irrigat|hectare|acre|harvest|soil|sow)/i,
    // Crop and land-area columns are used when the dataset carries them.
    build: ({ columns, group, fine }) => {
      const charts = [];
      const cropColumns = findAll(columns, CROP_COLUMNS);

      // A dataset with real crop or land-area columns leads with those.
      cropColumns.slice(0, 4).forEach((column, index) => {
        charts.push({
          id: `crop-${index}`,
          chartType: 'hbar',
          x: group,
          y: column,
          limit: 14,
          title: `${titleLabel(column)} by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'Read straight from the crop and land columns in your dataset.',
        });
      });

      if (has(columns, 'Agricultural_Workers')) {
        charts.push({
          id: 'agri-workers',
          chartType: 'hbar',
          x: group,
          y: 'Agricultural_Workers',
          aggregation: 'sum',
          limit: 14,
          title: `Agricultural workers by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'Cultivators and agricultural labourers added together.',
        });
      }
      if (has(columns, 'Agricultural_Worker_Share_Pct')) {
        charts.push({
          id: 'agri-share',
          chartType: 'hbar',
          x: group,
          y: 'Agricultural_Worker_Share_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'How much of the workforce still farms',
          subtitle: 'Agricultural workers as a share of all workers, averaged across blocks.',
        });
      }
      if (has(columns, 'MAIN_CL_P', 'MAIN_AL_P')) {
        charts.push({
          id: 'cultivators-labourers',
          chartType: 'grouped',
          // Grouped by settlement type: one peri-urban zone holds most of the
          // district's farm work, so a zone-level chart leaves nine bars flat.
          x: columns.includes('TRU') ? 'TRU' : group,
          measures: ['MAIN_AL_P', 'MAIN_CL_P'],
          aggregation: 'sum',
          limit: 12,
          title: 'Cultivators against agricultural labourers',
          subtitle: 'Cultivators farm land they hold; labourers are paid to work other people’s fields.',
        });
      }
      if (has(columns, 'Agricultural_Worker_Share_Pct') && columns.includes('TRU')) {
        charts.push({
          id: 'agri-rural-urban',
          chartType: 'bar',
          x: 'TRU',
          y: 'Agricultural_Worker_Share_Pct',
          aggregation: 'average',
          limit: 6,
          title: 'Farm dependency, rural against urban',
          subtitle: 'Average agricultural share of workers in rural and urban blocks.',
        });
      }
      if (has(columns, 'Cultivator_Share_Of_Farm_Work_Pct')) {
        charts.push({
          id: 'land-holding',
          chartType: 'dot',
          x: group,
          y: 'Cultivator_Share_Of_Farm_Work_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'Land-holding farmers within farm work',
          subtitle: 'Cultivators as a share of all agricultural workers. A low figure means mostly landless labour.',
        });
      }
      if (has(columns, 'Agricultural_Worker_Share_Pct', 'Effective_Literacy_Rate_Pct')) {
        charts.push({
          id: 'agri-literacy',
          chartType: 'scatter',
          x: 'Agricultural_Worker_Share_Pct',
          y: 'Effective_Literacy_Rate_Pct',
          title: 'Farm dependency against literacy',
          subtitle: 'One point per enumeration block.',
        });
      }

      return charts;
    },
    gap: {
      satisfiedBy: CROP_COLUMNS,
      missing: ['cultivated area', 'crop production', 'irrigated area', 'yield per hectare'],
      explanation:
        'A Primary Census Abstract counts people, not fields, so this file carries no crop, land-area or irrigation columns. These charts use the agricultural workforce it does record. Upload a dataset with crop or land-area columns and this page will chart those instead.',
    },
  },

  {
    id: 'infrastructure',
    label: 'Infrastructure',
    title: 'Housing and service demand',
    lead: 'Where households cluster, how crowded homes are, and which zones are adding people fastest — the pressure side of planning roads, water and schools.',
    match: /(road|water|sanitation|electric|toilet|facility|facilities|amenity|hospital|clinic|school|connectivity|household|hh)/i,
    build: ({ columns, group, fine }) => {
      const charts = [];
      const facilityColumns = findAll(columns, FACILITY_COLUMNS);

      // Real amenity columns, where a dataset has them, come first.
      facilityColumns.slice(0, 4).forEach((column, index) => {
        charts.push({
          id: `facility-${index}`,
          chartType: 'hbar',
          x: group,
          y: column,
          limit: 14,
          title: `${titleLabel(column)} by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'Read straight from the infrastructure columns in your dataset.',
        });
      });

      if (has(columns, 'No_HH')) {
        charts.push({
          id: 'households',
          chartType: 'hbar',
          x: group,
          y: 'No_HH',
          aggregation: 'sum',
          limit: 14,
          title: `Households by ${titleLabel(group).toLowerCase()}`,
          subtitle: 'The number of separate homes a service has to reach.',
        });
      }
      if (has(columns, 'Avg_Household_Size')) {
        charts.push({
          id: 'crowding',
          chartType: 'dot',
          x: group,
          y: 'Avg_Household_Size',
          aggregation: 'average',
          limit: 14,
          title: 'How crowded homes are',
          subtitle: 'People per household. Larger homes put more load on each water and power connection.',
        });
      }
      if (has(columns, 'Population_Added_Since_2011')) {
        charts.push({
          id: 'added-people',
          chartType: 'hbar',
          x: group,
          y: 'Population_Added_Since_2011',
          aggregation: 'sum',
          limit: 14,
          title: 'People added since 2011',
          subtitle: 'New residents each zone has to serve, compared with the last census baseline.',
        });
      }
      if (has(columns, 'No_HH') && columns.includes('TRU')) {
        charts.push({
          id: 'households-tru',
          chartType: 'bar',
          x: 'TRU',
          y: 'No_HH',
          aggregation: 'sum',
          limit: 6,
          title: 'Rural and urban households',
          subtitle: 'Where the district’s housing stock sits.',
        });
      }
      if (has(columns, 'Household_Industry_Share_Pct')) {
        charts.push({
          id: 'home-industry',
          chartType: 'dot',
          x: group,
          y: 'Household_Industry_Share_Pct',
          aggregation: 'average',
          limit: 14,
          title: 'Workshops inside homes',
          subtitle:
            'Household-industry workers as a share of all workers — these homes draw power and water like small units.',
        });
      }
      if (has(columns, 'No_HH', 'TOT_P')) {
        charts.push({
          id: 'hh-vs-pop',
          chartType: 'scatter',
          x: 'No_HH',
          y: 'TOT_P',
          title: 'Households against population',
          subtitle: 'One point per enumeration block. Points above the main band are larger-than-average homes.',
        });
      }

      return charts;
    },
    gap: {
      satisfiedBy: FACILITY_COLUMNS,
      missing: ['road length or connectivity', 'piped water coverage', 'sanitation access', 'electricity access', 'school and clinic counts'],
      explanation:
        'A Primary Census Abstract records households and people, not the assets that serve them, so this file carries no road, water, sanitation or facility columns. These charts use housing stock and growth, which is where service demand comes from. Upload a dataset with amenity columns and this page will chart those instead.',
    },
  },
];

export const topicById = (id) => TOPICS.find((topic) => topic.id === id);

/**
 * Build the chart list for one topic against whatever dataset is loaded.
 * Falls back to automatically chosen charts when a topic finds nothing it knows.
 */
export function buildTopicCharts(preview, topicId) {
  const topic = topicById(topicId);
  if (!topic || !preview?.columns?.length) return { charts: [], fallback: false, topic };

  const profiles = profileDataset(preview);
  const columns = preview.columns;
  const group = groupColumn(columns, profiles);
  const fine = fineGroupColumn(columns, profiles);
  const charts = topic.build({ columns, profiles, group, fine }) || [];

  if (charts.length) return { charts, fallback: false, topic, group, profiles };

  // Nothing matched: chart what this dataset does hold, and say so.
  return { charts: autoCharts(preview, profiles), fallback: true, topic, group, profiles };
}

/**
 * Charts chosen purely from the shape of the data — used after an upload, and
 * whenever a topic finds no columns it recognises.
 */
export function autoCharts(preview, profiles = null, max = 6) {
  const columnProfiles = profiles || profileDataset(preview);
  const columns = preview?.columns || [];
  const category = pickCategory(columnProfiles);
  const measures = pickMeasures(columnProfiles, 4);
  const temporal = pickTemporal(columnProfiles);
  const charts = [];

  if (category && measures[0]) {
    charts.push({
      id: 'auto-rank',
      chartType: 'hbar',
      x: category,
      y: measures[0],
      limit: 14,
      title: `${titleLabel(measures[0])} by ${titleLabel(category).toLowerCase()}`,
      subtitle: 'The strongest pairing of a grouping column and a numeric measure in this file.',
    });
  }
  if (temporal && measures[0]) {
    charts.push({
      id: 'auto-trend',
      chartType: 'line',
      x: temporal,
      y: measures[0],
      order: 'name_asc',
      limit: 40,
      title: `${titleLabel(measures[0])} over ${titleLabel(temporal).toLowerCase()}`,
      subtitle: 'Values ordered along the time column found in this file.',
    });
  }
  if (category && measures.length > 1) {
    charts.push({
      id: 'auto-grouped',
      chartType: 'grouped',
      x: category,
      measures: measures.slice(0, 3),
      limit: 10,
      title: 'The main measures side by side',
      subtitle: 'The three most informative numeric columns, compared across the same groups.',
    });
  }
  if (measures.length > 1) {
    charts.push({
      id: 'auto-scatter',
      chartType: 'scatter',
      x: measures[0],
      y: measures[1],
      title: `${titleLabel(measures[0])} against ${titleLabel(measures[1])}`,
      subtitle: 'One point per row, to test whether the two move together.',
    });
  }
  if (measures[0]) {
    charts.push({
      id: 'auto-hist',
      chartType: 'histogram',
      y: measures[0],
      x: category,
      title: `Spread of ${titleLabel(measures[0]).toLowerCase()}`,
      subtitle: 'How the rows are distributed across the range of this measure.',
    });
  }
  const secondCategory = columnProfiles.find((p) => p.usableAsCategory && p.name !== category && p.distinct <= 12);
  if (secondCategory && measures[0]) {
    charts.push({
      id: 'auto-second',
      chartType: 'bar',
      x: secondCategory.name,
      y: measures[0],
      limit: 12,
      title: `${titleLabel(measures[0])} by ${titleLabel(secondCategory.name).toLowerCase()}`,
      subtitle: 'A second way of cutting the same measure.',
    });
  }
  return charts.slice(0, max);
}
