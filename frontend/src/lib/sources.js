// One way of addressing data, whether it ships with the project or you uploaded it.
//
// A source key is either "builtin:<slug>" or "dataset:<id>". The built-in key
// reads the bundled file directly, so the default Surat charts need no upload
// and no copy of the dataset is created in anyone's library.
export const DEFAULT_SOURCE = 'builtin:surat';

export const isBuiltin = (key) => String(key || '').startsWith('builtin:');

export function sourceId(key) {
  return String(key || '').split(':')[1] || '';
}

export function sourcePaths(key) {
  const id = sourceId(key);
  const base = isBuiltin(key) ? `/api/builtin/${id}` : `/api/datasets/${id}`;
  return {
    base,
    preview: `${base}/preview`,
    analysis: `${base}/analysis`,
    aggregate: `${base}/aggregate`,
    csv: `${base}/download`,
    excel: `${base}/download-excel`,
    pdf: `${base}/report.pdf`,
  };
}

export function datasetKey(dataset) {
  return dataset?.builtin ? dataset.key || `builtin:${dataset.slug}` : `dataset:${dataset.id}`;
}

export function describeSource(key, builtins = [], datasets = []) {
  if (isBuiltin(key)) {
    const slug = sourceId(key);
    const found = builtins.find((item) => item.slug === slug);
    return found
      ? { ...found, key, label: found.short_name || found.name, builtin: true }
      : { key, label: 'Built-in dataset', builtin: true, rows: 0, columns: 0 };
  }
  const id = Number(sourceId(key));
  const found = datasets.find((item) => item.id === id);
  return found
    ? { ...found, key, label: found.name, builtin: false }
    : { key, label: 'Dataset', builtin: false, rows: 0, columns: 0 };
}

export function allSources(builtins = [], datasets = []) {
  return [
    ...builtins.map((item) => ({
      key: item.key || `builtin:${item.slug}`,
      label: item.short_name || item.name,
      detail: `${(item.rows || 0).toLocaleString('en-IN')} rows, bundled with the project`,
      builtin: true,
    })),
    ...datasets.map((item) => ({
      key: `dataset:${item.id}`,
      label: item.name,
      detail: `${(item.rows || 0).toLocaleString('en-IN')} rows, ${item.provenance || 'uploaded by you'}`,
      builtin: false,
    })),
  ];
}
