// Everything saved to this account, plus the datasets that ship with the project.
import React from 'react';
import { Empty, PageHead } from '../components/Shell.jsx';
import { fileSize, full } from '../lib/format.js';

export default function Datasets({
  datasets,
  builtins,
  sourceKey,
  onSelectSource,
  onRename,
  onDelete,
  onDownload,
  onNavigate,
  onImportBuiltin,
  importing,
}) {
  return (
    <>
      <PageHead
        title="My datasets"
        lead="Files you uploaded, stored in the project folder on this machine. Open one to make it the dataset every chart page uses."
      >
        <button type="button" className="button primary" onClick={() => onNavigate('upload')}>
          Upload a file
        </button>
      </PageHead>

      <section className="panel">
        <div className="panel-head">
          <h2>Bundled with the project</h2>
          <p>Available to chart straight away. No upload, and no copy is added to your library.</p>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Size</th>
                <th>Shape</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {builtins.map((item) => {
                const key = item.key || `builtin:${item.slug}`;
                return (
                  <tr key={key} className={sourceKey === key ? 'current-row' : ''}>
                    <td>
                      <button type="button" className="row-title" onClick={() => onSelectSource(key)}>
                        {item.name}
                      </button>
                      <small>{item.description}</small>
                    </td>
                    <td>{fileSize(item.size)}</td>
                    <td className="numeric">
                      {full(item.rows)} × {item.columns}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => onSelectSource(key)}>
                          {sourceKey === key ? 'In use' : 'Use this'}
                        </button>
                        <button type="button" onClick={() => onDownload(key, 'csv')}>
                          CSV
                        </button>
                        <button type="button" onClick={() => onDownload(key, 'excel')}>
                          Excel
                        </button>
                        <button type="button" onClick={() => onDownload(key, 'pdf')}>
                          PDF
                        </button>
                        <button type="button" onClick={onImportBuiltin} disabled={importing}>
                          Copy to my library
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Copying is optional — only do it if you want to rename, delete or edit your own version. Charting works
          without a copy.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Your uploads</h2>
          <p>
            {datasets.length} file{datasets.length === 1 ? '' : 's'},{' '}
            {full(datasets.reduce((sum, d) => sum + (d.rows || 0), 0))} rows in total.
          </p>
        </div>
        {datasets.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Format</th>
                  <th>Shape</th>
                  <th>Added</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => {
                  const key = `dataset:${dataset.id}`;
                  return (
                    <tr key={dataset.id} className={sourceKey === key ? 'current-row' : ''}>
                      <td>
                        <button type="button" className="row-title" onClick={() => onSelectSource(key)}>
                          {dataset.name}
                        </button>
                        <small>{dataset.provenance || 'Uploaded by you'}</small>
                      </td>
                      <td>
                        <span className="pill">{dataset.format.toUpperCase()}</span>
                      </td>
                      <td className="numeric">
                        {full(dataset.rows)} × {dataset.columns}
                      </td>
                      <td>{new Date(dataset.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => onSelectSource(key)}>
                            {sourceKey === key ? 'In use' : 'Use this'}
                          </button>
                          <button type="button" onClick={() => onRename(dataset)}>
                            Rename
                          </button>
                          <button type="button" onClick={() => onDownload(key, 'csv')}>
                            CSV
                          </button>
                          <button type="button" onClick={() => onDownload(key, 'excel')}>
                            Excel
                          </button>
                          <button type="button" onClick={() => onDownload(key, 'pdf')}>
                            PDF
                          </button>
                          <button type="button" className="danger" onClick={() => onDelete(dataset)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No uploads yet"
            action={
              <button type="button" className="button primary" onClick={() => onNavigate('upload')}>
                Upload your first file
              </button>
            }
          >
            Your uploads live alongside the bundled census file and work exactly the same way.
          </Empty>
        )}
      </section>
    </>
  );
}
