// Generated practice data, clearly labelled so it is never mistaken for real figures.
import React, { useState } from 'react';
import { PageHead } from '../components/Shell.jsx';

const COUNTS = [30, 100, 250, 500, 1000, 5000, 10000];
const KINDS = [
  { id: 'mixed', label: 'A mix of indicators' },
  { id: 'education', label: 'Education columns only' },
  { id: 'occupation', label: 'Occupation columns only' },
  { id: 'population', label: 'Population columns only' },
  { id: 'agriculture', label: 'Agriculture columns only' },
  { id: 'infrastructure', label: 'Infrastructure columns only' },
];
const LEVELS = [
  { id: 'mixed', label: 'A mix of area types' },
  { id: 'taluka', label: 'Taluka-style areas' },
  { id: 'village', label: 'Village-style areas' },
  { id: 'ward', label: 'Municipal ward-style areas' },
];

export default function Practice({ onGenerate, busy }) {
  const [count, setCount] = useState(100);
  const [kind, setKind] = useState('mixed');
  const [level, setLevel] = useState('mixed');

  return (
    <>
      <PageHead
        title="Practice data"
        lead="Made-up records for trying out charts and exports when you do not want to work on real figures."
      />

      <div className="callout warn">
        <h4>These numbers are invented</h4>
        <p>
          Every value on this page is generated locally for practice. Area names are illustrative and do not match any
          real administrative boundary. Generated files are labelled as such wherever they appear, including in the PDF
          export, so they cannot be confused with the census data.
        </p>
      </div>

      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate({ count, kind, level });
        }}
      >
        <div className="panel-head">
          <h2>Make a practice file</h2>
          <p>Each one is saved to your library as a separate dataset. Nothing you already have is changed.</p>
        </div>
        <div className="control-trio">
          <label>
            How many rows
            <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {COUNTS.map((value) => (
                <option key={value} value={value}>
                  {value.toLocaleString('en-IN')} rows
                </option>
              ))}
            </select>
          </label>
          <label>
            Which columns
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {KINDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Area labels
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              {LEVELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary" disabled={busy}>
          {busy ? 'Generating…' : 'Generate and save'}
        </button>
      </form>
    </>
  );
}
