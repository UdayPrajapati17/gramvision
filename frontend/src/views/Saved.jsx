// Charts you named and kept, ready to reopen exactly as they were.
import React from 'react';
import { Empty, PageHead } from '../components/Shell.jsx';
import { titleLabel } from '../lib/format.js';

const TYPE_NAMES = {
  hbar: 'Ranked bars',
  dot: 'Ranked dots',
  bar: 'Column chart',
  line: 'Line chart',
  area: 'Area chart',
  stacked: 'Stacked bars',
  grouped: 'Grouped bars',
  pie: 'Pie chart',
  donut: 'Doughnut chart',
  scatter: 'Scatter plot',
  histogram: 'Histogram',
};

export default function Saved({ charts, onOpen, onDelete, onNavigate }) {
  return (
    <>
      <PageHead
        title="Saved charts"
        lead="Each card remembers its dataset, axes, filters and title. Reopening one puts the builder back exactly where you left it."
      >
        <button type="button" className="button secondary" onClick={() => onNavigate('builder')}>
          Build a new chart
        </button>
      </PageHead>

      {charts.length ? (
        <div className="saved-grid">
          {charts.map((chart) => {
            const config = chart.config || {};
            const axes = config.measures?.length
              ? config.measures.map(titleLabel).join(', ')
              : titleLabel(config.y || '');
            return (
              <article className="saved-card" key={chart.id}>
                <h3>{chart.name}</h3>
                <p className="saved-meta">
                  {TYPE_NAMES[config.chartType] || 'Chart'} on {chart.source_label || 'a dataset'}
                </p>
                <dl className="saved-detail">
                  {config.x && (
                    <div>
                      <dt>Grouped by</dt>
                      <dd>{titleLabel(config.x)}</dd>
                    </div>
                  )}
                  {axes && (
                    <div>
                      <dt>Measuring</dt>
                      <dd>{axes}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Saved</dt>
                    <dd>{new Date(chart.created_at).toLocaleDateString('en-IN')}</dd>
                  </div>
                </dl>
                <div className="saved-actions">
                  <button type="button" className="button primary small" onClick={() => onOpen(chart)}>
                    Reopen
                  </button>
                  <button type="button" className="button quiet small" onClick={() => onDelete(chart)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Nothing saved yet"
          action={
            <button type="button" className="button primary" onClick={() => onNavigate('builder')}>
              Open the chart builder
            </button>
          }
        >
          Build a chart, name it and choose Save. It stays in the SQLite database in your project folder, so it is
          still here after you sign out.
        </Empty>
      )}
    </>
  );
}
