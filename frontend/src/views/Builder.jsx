// The chart builder: every axis, filter and format control in one place.
import React, { useMemo, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import { Empty, PageHead, SourceNote } from '../components/Shell.jsx';
import { distinctValues } from '../lib/aggregate.js';
import { autoTitle } from '../lib/chartData.js';
import { full, titleLabel } from '../lib/format.js';
import { categoryOptions, measureOptions, profileDataset, unusableColumns } from '../lib/profile.js';

const CHART_TYPES = [
  { id: 'hbar', label: 'Ranked bars (horizontal)', multi: false },
  { id: 'dot', label: 'Ranked dots (no zero baseline)', multi: false },
  { id: 'bar', label: 'Column chart (vertical)', multi: false },
  { id: 'line', label: 'Line chart', multi: false },
  { id: 'area', label: 'Area chart', multi: false },
  { id: 'stacked', label: 'Stacked bars', multi: true },
  { id: 'grouped', label: 'Grouped bars', multi: true },
  { id: 'donut', label: 'Doughnut chart', multi: 'either' },
  { id: 'pie', label: 'Pie chart', multi: 'either' },
  { id: 'scatter', label: 'Scatter plot', multi: false, numericX: true },
  { id: 'histogram', label: 'Histogram', multi: false, noX: true },
];

const WHY_UNUSABLE = {
  constant: 'the same value in every row',
  identifier: 'a different value in every row',
  code: 'a reference code, not a measurement',
};

export default function Builder({ preview, source, spec, onSpecChange, onSave, onError, saving }) {
  const [showColumns, setShowColumns] = useState(false);
  const profiles = useMemo(() => profileDataset(preview), [preview]);
  const categories = useMemo(() => categoryOptions(profiles), [profiles]);
  const measures = useMemo(() => measureOptions(profiles), [profiles]);
  const unusable = useMemo(() => unusableColumns(profiles), [profiles]);

  if (!preview) {
    return (
      <>
        <PageHead title="Chart builder" />
        <Empty title="Loading the dataset">Pick a dataset in the top bar to start building.</Empty>
      </>
    );
  }

  const type = CHART_TYPES.find((item) => item.id === spec.chartType) || CHART_TYPES[0];
  const isMulti = type.multi === true || (type.multi === 'either' && (spec.measures?.length || 0) > 1);
  // The title follows the chart until you write your own, then it stays put.
  function set(patch) {
    const next = { ...spec, ...patch };
    if (!next.titleTouched) next.title = autoTitle(next);
    onSpecChange(next);
  }

  // A scatter plot needs numbers on both axes; everything else needs a grouping
  // column. Switching type moves the horizontal axis to a column that fits.
  function setChartType(next) {
    const target = CHART_TYPES.find((item) => item.id === next);
    const patch = { chartType: next };
    const names = (list) => list.map((item) => item.name);
    if (target?.numericX && !names(measures).includes(spec.x)) {
      patch.x = measures.find((m) => m.name !== spec.y)?.name || measures[0]?.name || spec.x;
    } else if (!target?.numericX && !target?.noX && !names(categories).includes(spec.x)) {
      patch.x = categories[0]?.name || spec.x;
    }
    if ((target?.multi === true || target?.multi === 'either') && (spec.measures?.length || 0) < 2) {
      patch.measures = measures.slice(0, 2).map((m) => m.name);
    }
    set(patch);
  }

  function toggleMeasure(name) {
    const current = spec.measures || [];
    const next = current.includes(name) ? current.filter((m) => m !== name) : [...current, name].slice(0, 6);
    set({ measures: next });
  }

  function setFilter(slot, patch) {
    const filters = [...(spec.filters || [{}, {}])];
    filters[slot] = { ...(filters[slot] || {}), ...patch };
    set({ filters });
  }

  const filters = spec.filters || [];

  return (
    <>
      <PageHead
        title="Chart builder"
        lead="Choose what goes on each axis, how values are combined, and what to filter. The reading underneath updates with the chart."
      >
        <button type="button" className="button primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save this chart'}
        </button>
      </PageHead>

      <SourceNote source={source} preview={preview} />

      <div className="builder">
        <form className="controls" onSubmit={(event) => event.preventDefault()}>
          <h2>Chart settings</h2>

          <label>
            Chart type
            <select value={spec.chartType} onChange={(event) => setChartType(event.target.value)}>
              {CHART_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Chart title
            <input
              value={spec.title || ''}
              maxLength={120}
              placeholder="Name this chart"
              onChange={(event) => onSpecChange({ ...spec, title: event.target.value, titleTouched: true })}
            />
          </label>

          {!type.noX && (
            <label>
              {type.numericX ? 'Horizontal axis (numeric)' : 'Group by (horizontal axis)'}
              <select value={spec.x || ''} onChange={(event) => set({ x: event.target.value })}>
                {(type.numericX ? measures : categories).map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {titleLabel(profile.name)} — {profile.distinct} values
                  </option>
                ))}
              </select>
            </label>
          )}

          {isMulti ? (
            <fieldset className="measure-set">
              <legend>Measures to compare</legend>
              <div className="measure-list">
                {measures.slice(0, 24).map((profile) => (
                  <label key={profile.name} className="check">
                    <input
                      type="checkbox"
                      checked={(spec.measures || []).includes(profile.name)}
                      onChange={() => toggleMeasure(profile.name)}
                    />
                    {titleLabel(profile.name)}
                  </label>
                ))}
              </div>
              <p className="hint">Pick two to six. The first six are drawn; anything beyond that is left out.</p>
            </fieldset>
          ) : (
            <label>
              {type.id === 'histogram' ? 'Measure to distribute' : 'Measure (vertical axis)'}
              <select value={spec.y || ''} onChange={(event) => set({ y: event.target.value })}>
                {measures.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {titleLabel(profile.name)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {type.id !== 'scatter' && type.id !== 'histogram' && (
            <label>
              Combine values by
              <select value={spec.aggregation || ''} onChange={(event) => set({ aggregation: event.target.value || undefined })}>
                <option value="">Chosen automatically</option>
                <option value="sum">Adding them up</option>
                <option value="average">Averaging them</option>
                <option value="count">Counting records</option>
              </select>
            </label>
          )}

          {!['scatter', 'histogram'].includes(type.id) && (
            <div className="control-pair">
              <label>
                Order
                <select value={spec.order || 'value_desc'} onChange={(event) => set({ order: event.target.value })}>
                  <option value="value_desc">Largest first</option>
                  <option value="value_asc">Smallest first</option>
                  <option value="name_asc">Name, A to Z</option>
                  <option value="name_desc">Name, Z to A</option>
                </select>
              </label>
              <label>
                Show at most
                <select value={spec.limit || 14} onChange={(event) => set({ limit: Number(event.target.value) })}>
                  {[8, 12, 14, 20, 30, 50, 120].map((value) => (
                    <option key={value} value={value}>
                      {value} groups
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {type.id === 'histogram' && (
            <label>
              Number of bands
              <select value={spec.bins || 9} onChange={(event) => set({ bins: Number(event.target.value) })}>
                {[5, 7, 9, 12, 16, 20].map((value) => (
                  <option key={value} value={value}>
                    {value} bands
                  </option>
                ))}
              </select>
            </label>
          )}

          <fieldset className="filter-set">
            <legend>Filters</legend>
            {[0, 1].map((slot) => (
              <div className="control-pair" key={slot}>
                <label>
                  Column
                  <select
                    value={filters[slot]?.column || ''}
                    onChange={(event) => setFilter(slot, { column: event.target.value, value: '' })}
                  >
                    <option value="">No filter</option>
                    {profiles
                      .filter((profile) => profile.distinct > 1 && profile.distinct <= 200 && profile.role !== 'identifier')
                      .map((profile) => (
                        <option key={profile.name} value={profile.name}>
                          {titleLabel(profile.name)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Keep only
                  <select
                    value={filters[slot]?.value || ''}
                    disabled={!filters[slot]?.column}
                    onChange={(event) => setFilter(slot, { value: event.target.value })}
                  >
                    <option value="">Every value</option>
                    {filters[slot]?.column &&
                      distinctValues(preview, filters[slot].column).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            ))}
          </fieldset>

          <button type="button" className="link" onClick={() => setShowColumns((open) => !open)}>
            {showColumns ? 'Hide' : 'Show'} how these columns were sorted
          </button>

          {showColumns && (
            <div className="column-guide">
              <p>
                <strong>{categories.length}</strong> columns can group data and <strong>{measures.length}</strong> hold
                measurements that vary.
              </p>
              {unusable.length > 0 && (
                <>
                  <p className="hint">Kept out of the axis lists:</p>
                  <ul>
                    {unusable.slice(0, 10).map((profile) => (
                      <li key={profile.name}>
                        <code>{profile.name}</code> — {WHY_UNUSABLE[profile.role]}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </form>

        <div className="builder-canvas">
          <ChartCard
            preview={preview}
            spec={{ ...spec, title: spec.title || titleLabel(spec.y || spec.measures?.[0] || 'Chart') }}
            onError={onError}
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>The rows behind this chart</h2>
          <p>
            First 12 of {full(preview.total_rows || preview.rows.length)} records in {source?.label || 'this dataset'}.
          </p>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {preview.columns.slice(0, 14).map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 12).map((row, index) => (
                <tr key={index}>
                  {row.slice(0, 14).map((cell, cellIndex) => (
                    <td key={cellIndex}>{String(cell).slice(0, 48)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export { CHART_TYPES };
