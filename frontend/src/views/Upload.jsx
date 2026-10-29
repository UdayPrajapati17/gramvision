// Upload a CSV or Excel file, and get charts back without configuring anything.
import React, { useMemo, useRef, useState } from 'react';
import ChartCard from '../components/ChartCard.jsx';
import { Empty, PageHead } from '../components/Shell.jsx';
import { autoCharts } from '../lib/topics.js';
import { fileSize, full } from '../lib/format.js';
import { profileDataset } from '../lib/profile.js';

export default function Upload({ onUpload, uploading, uploaded, preview, onNavigate, onCustomize, onError }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  const charts = useMemo(() => (uploaded && preview ? autoCharts(preview, profileDataset(preview), 6) : []), [uploaded, preview]);

  function choose(selected) {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(name)) {
      onError('Choose a .csv, .xlsx or .xls file.');
      return;
    }
    setFile(selected);
  }

  function submit(event) {
    event.preventDefault();
    if (file) onUpload(file);
  }

  return (
    <>
      <PageHead
        title="Upload a file"
        lead="Drop in a CSV or Excel file and GramVision reads its columns, picks sensible axes and draws a first set of charts."
      />

      <div className="upload-layout">
        <form
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onSubmit={submit}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files?.[0]);
          }}
        >
          <h2>{file ? file.name : 'Drag a file here'}</h2>
          <p>
            {file
              ? `${fileSize(file.size)} ready to upload.`
              : 'CSV, XLSX or XLS, up to 20 MB. The first row should hold the column names.'}
          </p>
          <div className="dropzone-actions">
            <button type="button" className="button secondary" onClick={() => input.current?.click()}>
              {file ? 'Choose a different file' : 'Browse your files'}
            </button>
            <button className="button primary" disabled={!file || uploading}>
              {uploading ? 'Reading the file…' : 'Upload and chart it'}
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </form>

        <aside className="panel">
          <div className="panel-head">
            <h2>What happens to your file</h2>
          </div>
          <ol className="steps">
            <li>
              <strong>It stays on this machine.</strong> The file is written to <code>backend/uploads</code> and
              recorded in the SQLite database next to it. Nothing is sent anywhere else.
            </li>
            <li>
              <strong>Every column is profiled.</strong> GramVision works out which columns identify a row, which
              classify it and which measure it — so an id or a column with one repeated value never ends up on an axis.
            </li>
            <li>
              <strong>Charts are drawn and explained.</strong> You get a first set immediately, then the builder for
              anything else you want to see.
            </li>
          </ol>
        </aside>
      </div>

      {uploaded && (
        <section className="panel-flush">
          <div className="panel-head">
            <h2>Charts from {uploaded.name}</h2>
            <p>
              {full(uploaded.rows)} rows and {uploaded.columns} columns, {fileSize(uploaded.size)}. These were chosen
              automatically from the columns in your file.
            </p>
          </div>
          {charts.length ? (
            <div className="chart-grid">
              {charts.map((spec) => (
                <ChartCard key={spec.id} preview={preview} spec={spec} onCustomize={onCustomize} onError={onError} />
              ))}
            </div>
          ) : (
            <Empty
              title="This file has nothing chartable yet"
              action={
                <button type="button" className="button secondary" onClick={() => onNavigate('builder')}>
                  Open the builder anyway
                </button>
              }
            >
              A chart needs at least one column that groups rows and one that holds numbers which vary. Check that the
              first row of your file holds column names.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
