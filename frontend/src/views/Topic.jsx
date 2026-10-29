// A subject dashboard: every chart the current dataset can support for one topic.
import React, { useMemo } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import { Empty, PageHead, SourceNote } from '../components/Shell.jsx';
import { buildTopicCharts, gapApplies, topicById } from '../lib/topics.js';

export default function Topic({ topicId, preview, source, onCustomize, onError, onNavigate }) {
  const topic = topicById(topicId);
  const result = useMemo(() => buildTopicCharts(preview, topicId), [preview, topicId]);

  if (!topic) return null;

  if (!preview) {
    return (
      <>
        <PageHead title={topic.title} lead={topic.lead} />
        <Empty title="Loading the dataset">One moment while the selected dataset is read.</Empty>
      </>
    );
  }

  return (
    <>
      <PageHead title={topic.title} lead={topic.lead}>
        <button type="button" className="button secondary" onClick={() => onNavigate('builder')}>
          Build your own chart
        </button>
      </PageHead>

      <SourceNote source={source} preview={preview} />

      {!result.fallback && gapApplies(topic, preview.columns) && (
        <div className="callout">
          <h4>What this file does and does not carry</h4>
          <p>{topic.gap.explanation}</p>
          <p className="callout-list">
            Columns that would be charted here if present: {topic.gap.missing.join(', ')}.
          </p>
        </div>
      )}

      {result.fallback && (
        <div className="callout">
          <h4>No {topic.label.toLowerCase()} columns in this dataset</h4>
          <p>
            {source?.label || 'This dataset'} holds no columns this page recognises, so the charts below were chosen
            from the strongest groupings and measures it does contain. Switch back to the built-in Surat dataset in the
            top bar for the full {topic.label.toLowerCase()} view.
          </p>
        </div>
      )}

      {result.charts.length ? (
        <div className="chart-grid">
          {result.charts.map((spec) => (
            <ChartCard key={spec.id} preview={preview} spec={spec} onCustomize={onCustomize} onError={onError} />
          ))}
        </div>
      ) : (
        <Empty title="Nothing to chart in this dataset">
          No column in {source?.label || 'this file'} can act as a grouping, and none holds numbers that vary. Upload a
          file with at least one text column and one numeric column.
        </Empty>
      )}
    </>
  );
}
