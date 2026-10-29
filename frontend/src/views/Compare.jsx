// Two datasets, column by column, with the size and direction of each difference.
import React, { useState } from 'react';
import { Empty, PageHead } from '../components/Shell.jsx';
import { full, titleLabel } from '../lib/format.js';
import { STATUS } from '../lib/palette.js';

export default function Compare({ sources, onCompare, result, comparing }) {
  const [left, setLeft] = useState(sources[0]?.key || '');
  const [right, setRight] = useState(sources[1]?.key || '');

  return (
    <>
      <PageHead
        title="Compare datasets"
        lead="Line up two datasets on the columns they share. Built-in data can be compared without copying it into your library."
      />

      <form
        className="panel compare-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCompare(left, right);
        }}
      >
        <div className="control-pair">
          <label>
            First dataset
            <select value={left} onChange={(event) => setLeft(event.target.value)} required>
              <option value="">Choose a dataset</option>
              {sources.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Second dataset
            <select value={right} onChange={(event) => setRight(event.target.value)} required>
              <option value="">Choose a dataset</option>
              {sources.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary" disabled={!left || !right || left === right || comparing}>
          {comparing ? 'Comparing…' : 'Compare them'}
        </button>
        {left && left === right && <p className="hint">Pick two different datasets.</p>}
      </form>

      {result && (
        <section className="panel">
          <div className="panel-head">
            <h2>
              {result.dataset_a.name} against {result.dataset_b.name}
            </h2>
            <p>{result.message}</p>
          </div>

          <dl className="figure-row">
            <div>
              <dt>{result.dataset_a.name}</dt>
              <dd>{full(result.dataset_a.rows)}</dd>
              <p>rows, {result.dataset_a.columns} columns</p>
            </div>
            <div>
              <dt>{result.dataset_b.name}</dt>
              <dd>{full(result.dataset_b.rows)}</dd>
              <p>rows, {result.dataset_b.columns} columns</p>
            </div>
            <div>
              <dt>Shared numeric columns</dt>
              <dd>{result.common_numeric_columns.length}</dd>
              <p>compared below</p>
            </div>
          </dl>

          {result.common_numeric_columns.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th className="numeric">{result.dataset_a.name} average</th>
                    <th className="numeric">{result.dataset_b.name} average</th>
                    <th className="numeric">Difference</th>
                    <th className="numeric">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {result.common_numeric_columns.map((row) => (
                    <tr key={row.column}>
                      <td>{titleLabel(row.column)}</td>
                      <td className="numeric">{full(row.dataset_a_mean)}</td>
                      <td className="numeric">{full(row.dataset_b_mean)}</td>
                      <td className="numeric">{full(row.difference)}</td>
                      <td
                        className="numeric"
                        style={{ color: row.percent_change > 0 ? STATUS.good : row.percent_change < 0 ? STATUS.critical : undefined }}
                      >
                        {row.percent_change === null || row.percent_change === undefined
                          ? '—'
                          : `${row.percent_change > 0 ? '+' : ''}${full(row.percent_change, 1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="These two share no numeric columns">
              A comparison needs at least one column with the same name holding numbers in both files.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
