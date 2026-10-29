// The frame every view sits inside: navigation rail, top bar and source switcher.
import React from 'react';
import { full } from '../lib/format.js';

export const NAV_GROUPS = [
  {
    heading: 'Surat dashboards',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'population', label: 'Population' },
      { id: 'education', label: 'Education' },
      { id: 'occupation', label: 'Occupation' },
      { id: 'agriculture', label: 'Agriculture' },
      { id: 'infrastructure', label: 'Infrastructure' },
    ],
  },
  {
    heading: 'Build and keep',
    items: [
      { id: 'builder', label: 'Chart builder' },
      { id: 'saved', label: 'Saved charts' },
      { id: 'compare', label: 'Compare datasets' },
    ],
  },
  {
    heading: 'Your data',
    items: [
      { id: 'upload', label: 'Upload a file' },
      { id: 'datasets', label: 'My datasets' },
      { id: 'practice', label: 'Practice data' },
      { id: 'profile', label: 'Account' },
    ],
  },
];

const LABELS = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items).map((item) => [item.id, item.label]));

export function Sidebar({ page, onNavigate, datasetCount, savedCount, onSignOut }) {
  return (
    <aside className="rail">
      <div className="rail-brand">
        <span className="mark">GV</span>
        <span>
          GramVision
          <small>District data workspace</small>
        </span>
      </div>

      <nav className="rail-nav">
        {NAV_GROUPS.map((group) => (
          <div className="rail-group" key={group.heading}>
            <p className="rail-heading">{group.heading}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rail-item${page === item.id ? ' current' : ''}`}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
                {item.id === 'datasets' && datasetCount > 0 && <span className="rail-count">{datasetCount}</span>}
                {item.id === 'saved' && savedCount > 0 && <span className="rail-count">{savedCount}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-foot">
        <p className="rail-storage">
          <span className="dot" />
          Stored on this machine
        </p>
        <button type="button" className="rail-item quiet" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function TopBar({ page, sources, sourceKey, onSourceChange, profile, onProfile, busy }) {
  return (
    <header className="topbar">
      <div className="topbar-where">
        <span>GramVision</span>
        <span className="sep">/</span>
        <strong>{LABELS[page] || 'Workspace'}</strong>
      </div>

      <div className="topbar-tools">
        <label className="source-switch">
          <span>Charting</span>
          <select value={sourceKey} onChange={(event) => onSourceChange(event.target.value)} disabled={busy}>
            {sources.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
                {source.builtin ? ' — built in' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="account-chip" onClick={onProfile}>
          <span className="avatar">{profile?.name?.[0]?.toUpperCase() || 'U'}</span>
          <span className="account-name">{profile?.name || 'Account'}</span>
        </button>
      </div>
    </header>
  );
}

export function PageHead({ title, lead, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}

export function SourceNote({ source, preview }) {
  if (!source) return null;
  return (
    <p className="source-note">
      {source.builtin ? 'Built-in dataset' : 'Your upload'}: <strong>{source.label}</strong>,{' '}
      {full(preview?.total_rows || source.rows || 0)} rows and {preview?.columns?.length || source.columns || 0} columns
      {preview?.truncated ? `, charted from the first ${full(preview.rows.length)}` : ''}.
    </p>
  );
}

export function Banner({ tone = 'info', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`banner ${tone}`}>
      <span>{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
