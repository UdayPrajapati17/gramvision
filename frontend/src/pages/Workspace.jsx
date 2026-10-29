// The signed-in workspace: loads a dataset, keeps one chart specification, and
// hands both to whichever view is open.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, API_BASE } from '../lib/api.js';
import { Banner, PageHead, Sidebar, TopBar } from '../components/Shell.jsx';
import { withDerivedColumns } from '../lib/derive.js';
import { titleLabel } from '../lib/format.js';
import { autoTitle } from '../lib/chartData.js';
import { pickCategory, pickMeasures, profileDataset } from '../lib/profile.js';
import { allSources, DEFAULT_SOURCE, describeSource, isBuiltin, sourceId, sourcePaths } from '../lib/sources.js';
import Builder from '../views/Builder.jsx';
import Compare from '../views/Compare.jsx';
import Datasets from '../views/Datasets.jsx';
import Overview from '../views/Overview.jsx';
import Practice from '../views/Practice.jsx';
import Profile from '../views/Profile.jsx';
import Saved from '../views/Saved.jsx';
import Topic from '../views/Topic.jsx';
import Upload from '../views/Upload.jsx';

const TOPIC_PAGES = ['population', 'education', 'occupation', 'agriculture', 'infrastructure'];

function defaultSpec(preview) {
  const profiles = profileDataset(preview);
  const x = pickCategory(profiles);
  const [y] = pickMeasures(profiles, 1);
  const spec = {
    chartType: 'hbar',
    x: x || preview?.columns?.[0] || '',
    y: y || '',
    measures: pickMeasures(profiles, 2),
    aggregation: undefined,
    filters: [{}, {}],
    order: 'value_desc',
    limit: 14,
    bins: 9,
    titleTouched: false,
  };
  return { ...spec, title: y ? autoTitle(spec) : 'New chart' };
}

export default function Workspace({ onSignOut }) {
  const [page, setPage] = useState('overview');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('info');
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [builtins, setBuiltins] = useState([]);
  const [savedCharts, setSavedCharts] = useState([]);

  const [sourceKey, setSourceKey] = useState(DEFAULT_SOURCE);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loadingSource, setLoadingSource] = useState(true);

  const [spec, setSpec] = useState({ chartType: 'hbar', filters: [{}, {}], limit: 14, order: 'value_desc', bins: 9 });
  const pendingSpec = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);

  const [profileName, setProfileName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const notify = useCallback((text, nextTone = 'info') => {
    setTone(nextTone);
    setMessage(text);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [datasetList, me, charts, builtinList] = await Promise.all([
        api('/api/datasets'),
        api('/api/auth/me'),
        api('/api/datasets/saved-charts/list'),
        api('/api/builtin'),
      ]);
      setDatasets(datasetList);
      setProfile(me);
      setProfileName((current) => current || me.name || '');
      setSavedCharts(charts);
      setBuiltins(builtinList);
    } catch (error) {
      notify(error.message, 'bad');
    }
  }, [notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load whichever dataset the top bar points at, and add derived indicators.
  useEffect(() => {
    let cancelled = false;
    const paths = sourcePaths(sourceKey);
    setLoadingSource(true);
    (async () => {
      try {
        const [rawPreview, summary] = await Promise.all([api(paths.preview), api(paths.analysis)]);
        if (cancelled) return;
        const enriched = withDerivedColumns(rawPreview);
        setPreview(enriched);
        setAnalysis(summary);
        if (pendingSpec.current) {
          setSpec(pendingSpec.current);
          pendingSpec.current = null;
        } else {
          setSpec(defaultSpec(enriched));
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          notify(error.message, 'bad');
        }
      } finally {
        if (!cancelled) setLoadingSource(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceKey, notify]);

  const sources = useMemo(() => allSources(builtins, datasets), [builtins, datasets]);
  const source = useMemo(() => describeSource(sourceKey, builtins, datasets), [sourceKey, builtins, datasets]);

  function navigate(next) {
    setPage(next);
    setMessage('');
  }

  function customizeFromCard(cardSpec) {
    setSpec({
      // Keep the curated title on arrival; let it follow the chart once edited.
      titleTouched: false,
      chartType: cardSpec.chartType || 'hbar',
      x: cardSpec.x || '',
      y: cardSpec.y || '',
      measures: cardSpec.measures || [],
      aggregation: cardSpec.aggregation,
      filters: cardSpec.filters || [{}, {}],
      order: cardSpec.order || 'value_desc',
      limit: cardSpec.limit || 14,
      bins: cardSpec.bins || 9,
      reference: cardSpec.reference,
      title: cardSpec.title || '',
    });
    navigate('builder');
  }

  async function uploadFile(file) {
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api('/api/datasets', { method: 'POST', body: form });
      await refresh();
      setUploaded(result.dataset);
      setSourceKey(`dataset:${result.dataset.id}`);
      notify(`${result.dataset.name} is ready. Charts below were generated from its columns.`, 'good');
    } catch (error) {
      notify(error.message, 'bad');
    } finally {
      setUploading(false);
    }
  }

  async function importBuiltin() {
    setImporting(true);
    try {
      const result = await api('/api/datasets/synthetic/surat/default', { method: 'POST' });
      await refresh();
      notify(
        result.already_imported
          ? 'A copy is already in your library, so nothing new was added.'
          : 'A copy was added to your library. The charts keep using the built-in file either way.',
        'good',
      );
    } catch (error) {
      notify(error.message, 'bad');
    } finally {
      setImporting(false);
    }
  }

  async function generatePractice({ count, kind, level }) {
    setBusy(true);
    try {
      const result = await api(
        `/api/datasets/synthetic/surat?count=${count}&category=${kind}&geographic_level=${level}&seed=410`,
        { method: 'POST' },
      );
      await refresh();
      setSourceKey(`dataset:${result.dataset.id}`);
      notify(result.provenance, 'warn');
      navigate('builder');
    } catch (error) {
      notify(error.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function saveChart() {
    setSaving(true);
    try {
      const body = {
        name: spec.title?.trim() || 'Saved chart',
        config: spec,
        source_label: source?.label,
        ...(isBuiltin(sourceKey) ? { source_key: sourceKey } : { dataset_id: Number(sourceId(sourceKey)) }),
      };
      await api('/api/datasets/saved-charts', { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      notify('Chart saved. It is on the Saved charts page whenever you come back.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    } finally {
      setSaving(false);
    }
  }

  function reopenChart(chart) {
    const key = chart.source_key || `dataset:${chart.dataset_id}`;
    pendingSpec.current = { filters: [{}, {}], ...chart.config, titleTouched: true, title: chart.config?.title || chart.name };
    if (key === sourceKey) {
      setSpec(pendingSpec.current);
      pendingSpec.current = null;
    } else {
      setSourceKey(key);
    }
    navigate('builder');
  }

  async function deleteChart(chart) {
    if (!window.confirm(`Delete the saved chart “${chart.name}”?`)) return;
    try {
      await api(`/api/datasets/saved-charts/${chart.id}`, { method: 'DELETE' });
      await refresh();
      notify('Saved chart deleted.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  async function renameDataset(dataset) {
    const name = window.prompt('New name for this dataset', dataset.name);
    if (!name?.trim()) return;
    try {
      await api(`/api/datasets/${dataset.id}?name=${encodeURIComponent(name.trim())}`, { method: 'PATCH' });
      await refresh();
      notify('Dataset renamed.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  async function deleteDataset(dataset) {
    if (!window.confirm(`Delete “${dataset.name}” and its stored file? This cannot be undone.`)) return;
    try {
      await api(`/api/datasets/${dataset.id}`, { method: 'DELETE' });
      if (sourceKey === `dataset:${dataset.id}`) setSourceKey(DEFAULT_SOURCE);
      if (uploaded?.id === dataset.id) setUploaded(null);
      await refresh();
      notify('Dataset deleted, along with any charts saved against it.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  async function download(key, kind) {
    const paths = sourcePaths(key);
    const url = `${API_BASE}${kind === 'pdf' ? paths.pdf : kind === 'excel' ? paths.excel : paths.csv}`;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('gv_token')}` } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'That download could not be prepared.');
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stem = `gramvision-${sourceId(key)}`;
      link.href = href;
      link.download = kind === 'pdf' ? `${stem}-report.pdf` : kind === 'excel' ? `${stem}.xlsx` : `${stem}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  async function compare(left, right) {
    setComparing(true);
    setComparison(null);
    try {
      const result = await api(
        `/api/datasets/compare?dataset_a=${encodeURIComponent(toReference(left))}&dataset_b=${encodeURIComponent(toReference(right))}`,
      );
      setComparison(result);
    } catch (error) {
      notify(error.message, 'bad');
    } finally {
      setComparing(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name: profileName }) });
      await refresh();
      notify('Name updated.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      if (!codeSent) {
        const result = await api('/api/auth/change-password/request-otp', {
          method: 'POST',
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        setCodeSent(true);
        notify(result.message || 'Check your email for the code.', 'info');
        return;
      }
      const result = await api('/api/auth/change-password/confirm', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, code: changeCode }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setChangeCode('');
      setCodeSent(false);
      notify(result.message || 'Password changed. Sign in again.', 'good');
    } catch (error) {
      notify(error.message, 'bad');
    }
  }

  const sharedChartProps = {
    preview,
    source,
    onCustomize: customizeFromCard,
    onError: (text) => notify(text, 'bad'),
    onNavigate: navigate,
  };

  return (
    <div className="shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        datasetCount={datasets.length}
        savedCount={savedCharts.length}
        onSignOut={onSignOut}
      />
      <div className="main">
        <TopBar
          page={page}
          sources={sources}
          sourceKey={sourceKey}
          onSourceChange={setSourceKey}
          profile={profile}
          onProfile={() => navigate('profile')}
          busy={loadingSource}
        />
        <div className="page">
          <Banner tone={tone} onDismiss={() => setMessage('')}>
            {message}
          </Banner>

          {page === 'overview' && (
            <Overview
              preview={preview}
              source={source}
              profile={profile}
              datasets={datasets}
              savedCharts={savedCharts}
              onNavigate={navigate}
              onOpenSaved={reopenChart}
            />
          )}

          {TOPIC_PAGES.includes(page) && <Topic key={page} topicId={page} {...sharedChartProps} />}

          {page === 'builder' && (
            <Builder
              preview={preview}
              source={source}
              spec={spec}
              onSpecChange={setSpec}
              onSave={saveChart}
              onError={(text) => notify(text, 'bad')}
              saving={saving}
            />
          )}

          {page === 'upload' && (
            <Upload
              onUpload={uploadFile}
              uploading={uploading}
              uploaded={uploaded}
              preview={uploaded && sourceKey === `dataset:${uploaded.id}` ? preview : null}
              onNavigate={navigate}
              onCustomize={customizeFromCard}
              onError={(text) => notify(text, 'bad')}
            />
          )}

          {page === 'datasets' && (
            <Datasets
              datasets={datasets}
              builtins={builtins}
              sourceKey={sourceKey}
              onSelectSource={setSourceKey}
              onRename={renameDataset}
              onDelete={deleteDataset}
              onDownload={download}
              onNavigate={navigate}
              onImportBuiltin={importBuiltin}
              importing={importing}
            />
          )}

          {page === 'compare' && (
            <Compare sources={sources} onCompare={compare} result={comparison} comparing={comparing} />
          )}

          {page === 'saved' && (
            <Saved charts={savedCharts} onOpen={reopenChart} onDelete={deleteChart} onNavigate={navigate} />
          )}

          {page === 'practice' && <Practice onGenerate={generatePractice} busy={busy} />}

          {page === 'profile' && (
            <Profile
              profile={profile}
              profileName={profileName}
              onProfileName={setProfileName}
              onSaveProfile={saveProfile}
              currentPassword={currentPassword}
              onCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              onNewPassword={setNewPassword}
              changeCode={changeCode}
              onChangeCode={setChangeCode}
              codeSent={codeSent}
              onChangePassword={changePassword}
              datasets={datasets}
              savedCharts={savedCharts}
            />
          )}

          <footer className="page-foot">
            <span>GramVision, district and village data analysis</span>
            <span>
              {analysis ? `${analysis.rows.toLocaleString('en-IN')} rows profiled in the current dataset` : 'Reading dataset…'}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

// The API takes a dataset id or a built-in key; the UI uses one key format for both.
function toReference(key) {
  return isBuiltin(key) ? key : sourceId(key);
}

export { PageHead };
