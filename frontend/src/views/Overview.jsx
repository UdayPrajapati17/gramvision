// The landing view: the headline figure, what the file holds, and where to go next.
import React, { useMemo } from 'react';
import { PageHead, Empty } from '../components/Shell.jsx';
import { buildHeadline } from '../lib/headline.js';
import { compact, full, titleLabel, unitSuffix } from '../lib/format.js';
import { seriesColor } from '../lib/palette.js';
import { TOPICS } from '../lib/topics.js';

const TOPIC_BLURB = {
  population: 'Headcount, sex ratio, household size and growth since 2011.',
  education: 'Literacy rates, the gap between men and women, and how it varies by block.',
  occupation: 'Work participation, the mix of main work, and how much is seasonal.',
  agriculture: 'Cultivators, agricultural labourers and where farm work still holds.',
  infrastructure: 'Household stock, crowding and where new demand is appearing.',
};

export default function Overview({ preview, source, profile, datasets, savedCharts, onNavigate, onOpenSaved }) {
  const headline = useMemo(() => buildHeadline(preview), [preview]);
  const firstName = profile?.name?.split(' ')[0];

  if (!preview) {
    return (
      <>
        <PageHead title="Overview" />
        <Empty title="Loading your data">Fetching the dataset currently selected in the top bar.</Empty>
      </>
    );
  }

  const splitTotal = headline?.split?.parts.reduce((sum, part) => sum + part.value, 0) || 0;

  return (
    <>
      <PageHead
        title={firstName ? `Good to see you, ${firstName}.` : 'Your workspace'}
        lead={`Charts are drawn from ${source?.label || 'the selected dataset'} the moment this page loads. Nothing to upload first.`}
      >
        <button type="button" className="button primary" onClick={() => onNavigate('builder')}>
          Open the chart builder
        </button>
      </PageHead>

      {headline && (
        <section className="hero">
          <div className="hero-figure">
            <p className="hero-label">
              {headline.hero.label} {headline.hero.aggregated === 'average' ? 'on average' : 'counted'}
            </p>
            <p className="hero-value">
              {full(headline.hero.value)}
              <span className="hero-unit">{unitSuffix(headline.hero.column)}</span>
            </p>
            <p className="hero-sub">
              Across {full(headline.records)} records
              {headline.groupColumn ? ` in ${headline.groupCount} ${titleLabel(headline.groupColumn).toLowerCase()} groups` : ''},
              with {headline.columnCount} columns available to chart.
            </p>

            {headline.split && splitTotal > 0 && (
              <div className="split">
                <div className="split-bar">
                  {headline.split.parts.map((part, index) => (
                    <span
                      key={part.name}
                      style={{ width: `${(part.value / splitTotal) * 100}%`, background: seriesColor(index) }}
                      title={`${part.name}: ${full(part.value)}`}
                    />
                  ))}
                </div>
                <ul className="split-key">
                  {headline.split.parts.map((part, index) => (
                    <li key={part.name}>
                      <span className="chart-legend-dot" style={{ background: seriesColor(index) }} />
                      {part.name}
                      <b>{full((part.value / splitTotal) * 100, 1)}%</b>
                    </li>
                  ))}
                </ul>
                <p className="split-reading">
                  {headline.split.parts[0].name} holds{' '}
                  {full((headline.split.parts[0].value / splitTotal) * 100, 1)}% of the{' '}
                  {headline.hero.label.toLowerCase()}, at {full(headline.split.parts[0].value)} against{' '}
                  {full(headline.split.parts[headline.split.parts.length - 1].value)} in{' '}
                  {headline.split.parts[headline.split.parts.length - 1].name}.
                </p>
              </div>
            )}
          </div>

          <dl className="hero-figures">
            {headline.figures.map((figure) => (
              <div key={figure.column}>
                <dt>{figure.label}</dt>
                <dd>
                  {compact(figure.value)}
                  <span>{unitSuffix(figure.column)}</span>
                </dd>
                <p>{figure.aggregated === 'average' ? 'average across records' : 'added across records'}</p>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Five readings of this district</h2>
          <p>Each page charts the relevant columns and writes out what the numbers say underneath.</p>
        </div>
        <div className="topic-grid">
          {TOPICS.map((topic) => (
            <button key={topic.id} type="button" className="topic-tile" onClick={() => onNavigate(topic.id)}>
              <h3>{topic.label}</h3>
              <p>{TOPIC_BLURB[topic.id]}</p>
              <span className="topic-open">Open</span>
            </button>
          ))}
        </div>
      </section>

      <div className="split-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Your datasets</h2>
            <button type="button" className="link" onClick={() => onNavigate('datasets')}>
              See all
            </button>
          </div>
          {datasets.length ? (
            <ul className="row-list">
              {datasets.slice(0, 5).map((dataset) => (
                <li key={dataset.id}>
                  <div>
                    <strong>{dataset.name}</strong>
                    <small>
                      {full(dataset.rows)} rows, {dataset.columns} columns
                    </small>
                  </div>
                  <button type="button" className="link" onClick={() => onNavigate('datasets')}>
                    Manage
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing uploaded yet">
              The Surat census file is already loaded and charted. Upload a CSV or Excel file to chart your own data
              the same way.
            </Empty>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Saved charts</h2>
            <button type="button" className="link" onClick={() => onNavigate('saved')}>
              See all
            </button>
          </div>
          {savedCharts.length ? (
            <ul className="row-list">
              {savedCharts.slice(0, 5).map((chart) => (
                <li key={chart.id}>
                  <div>
                    <strong>{chart.name}</strong>
                    <small>
                      {chart.config?.chartType || 'bar'} chart on {chart.source_label || 'a dataset'}
                    </small>
                  </div>
                  <button type="button" className="link" onClick={() => onOpenSaved(chart)}>
                    Reopen
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No saved charts yet">
              Build a chart, give it a name and save it. It will reopen exactly as you left it, next time you sign in.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
