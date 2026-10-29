// A chart, what it means, and the numbers behind it.
//
// The written reading is not decoration: it is produced from the same values
// the chart draws, and it is the reason the card exists. Every card also offers
// the plain table, so no value is reachable only by hovering.
import React, { useMemo, useRef, useState } from 'react';
import Chart from './Chart.jsx';
import { buildChartData } from '../lib/chartData.js';
import { chartRowsForExport, exportChartPng, exportRowsCsv, slug } from '../lib/exportChart.js';
import { full, titleLabel } from '../lib/format.js';
import { derivedNote } from '../lib/derive.js';

export default function ChartCard({ preview, spec, onCustomize, onError, compact: isCompact = false }) {
  const frame = useRef(null);
  const [showTable, setShowTable] = useState(false);
  const result = useMemo(() => buildChartData(preview, spec), [preview, spec]);

  // Only explain a derived indicator when the card has no subtitle already saying it.
  const measureNote = spec.subtitle ? null : derivedNote(spec.y) || derivedNote(spec.measures?.[0]);
  const exportName = slug(spec.title || spec.y || 'chart');
  const tableColumns = result.keys?.length > 1 ? result.keys : [spec.y || 'value'];

  function savePng() {
    try {
      exportChartPng(frame.current, `gramvision-${exportName}.png`, spec.title || '');
    } catch (error) {
      onError?.(error.message);
    }
  }

  function saveCsv() {
    const rows = chartRowsForExport(result.data, result.keys?.length > 1 ? result.keys : ['value']);
    exportRowsCsv(rows, Object.keys(rows[0] || { Category: '', value: '' }), `gramvision-${exportName}.csv`);
  }

  return (
    <figure className={`chart-card${isCompact ? ' chart-card-compact' : ''}`}>
      <figcaption className="chart-card-head">
        <div>
          <h3>{spec.title || titleLabel(spec.y)}</h3>
          {spec.subtitle && <p>{spec.subtitle}</p>}
        </div>
        <div className="chart-card-tools">
          <button type="button" onClick={() => setShowTable((open) => !open)} aria-pressed={showTable}>
            {showTable ? 'Chart' : 'Table'}
          </button>
          <button type="button" onClick={savePng}>
            PNG
          </button>
          <button type="button" onClick={saveCsv}>
            CSV
          </button>
          {onCustomize && (
            <button type="button" className="chart-tool-accent" onClick={() => onCustomize(spec)}>
              Customize
            </button>
          )}
        </div>
      </figcaption>

      <div ref={frame} className="chart-card-body">
        {showTable ? (
          <div className="chart-table-wrap">
            <table className="chart-table">
              <thead>
                <tr>
                  <th>{result.axisLabel || titleLabel(spec.x) || 'Category'}</th>
                  {tableColumns.map((column) => (
                    <th key={column} className="numeric">
                      {titleLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.slice(0, 60).map((row, index) => (
                  <tr key={`${row.name}-${index}`}>
                    <td>{row.name ?? `${full(row.x)}`}</td>
                    {tableColumns.map((column) => (
                      <td key={column} className="numeric">
                        {full(row[column] ?? row.value ?? row.y)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Chart shape={result.shape} data={result.data} keys={result.keys} spec={spec} />
        )}
      </div>

      {(result.truncated || measureNote) && (
        <p className="chart-card-note">
          {result.truncated &&
            `Showing the top ${result.data.length} of ${result.groupCount} groups, ranked by value. `}
          {measureNote}
        </p>
      )}

      <div className="reading">
        <p className="reading-headline">{result.reading.headline}</p>
        <p className="reading-body">{result.reading.body}</p>
      </div>
    </figure>
  );
}
