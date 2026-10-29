// Account details, password changes, and where the workspace keeps its files.
import React from 'react';
import { PageHead } from '../components/Shell.jsx';
import { full } from '../lib/format.js';

export default function Profile({
  profile,
  profileName,
  onProfileName,
  onSaveProfile,
  currentPassword,
  onCurrentPassword,
  newPassword,
  onNewPassword,
  changeCode,
  onChangeCode,
  codeSent,
  onChangePassword,
  datasets,
  savedCharts,
}) {
  return (
    <>
      <PageHead title="Account" lead="Your details, your password, and where everything is stored on this machine." />

      <div className="split-columns">
        <section className="panel">
          <div className="account-head">
            <span className="avatar large">{profile?.name?.[0]?.toUpperCase() || 'U'}</span>
            <div>
              <h2>{profile?.name}</h2>
              <p>{profile?.email}</p>
              <small>
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '—'}
              </small>
            </div>
          </div>

          <form className="stack-form" onSubmit={onSaveProfile}>
            <label>
              Display name
              <input value={profileName} maxLength="120" required onChange={(event) => onProfileName(event.target.value)} />
            </label>
            <label>
              Email address
              <input value={profile?.email || ''} disabled />
              <small>Changing an email address needs verification, which is not built yet.</small>
            </label>
            <button className="button primary">Save name</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Change your password</h2>
            <p>A six-digit code is emailed to you before the change is applied.</p>
          </div>
          <form className="stack-form" onSubmit={onChangePassword}>
            <label>
              Current password
              <input
                type="password"
                minLength="8"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => onCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                minLength="8"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => onNewPassword(event.target.value)}
              />
            </label>
            {codeSent && (
              <label>
                Code from your email
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  required
                  value={changeCode}
                  onChange={(event) => onChangeCode(event.target.value)}
                />
              </label>
            )}
            <button className="button primary">{codeSent ? 'Check the code and change it' : 'Send the code'}</button>
            <p className="hint">
              Email needs SMTP details in <code>backend/.env</code>. Without them, use Forgot password on the sign-in
              screen only after setting those up.
            </p>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Where your work is kept</h2>
          <p>Everything stays in the project folder. Nothing is uploaded anywhere.</p>
        </div>
        <dl className="figure-row">
          <div>
            <dt>Database</dt>
            <dd className="small-figure">backend/gramvision.db</dd>
            <p>accounts, dataset records and saved charts</p>
          </div>
          <div>
            <dt>Uploaded files</dt>
            <dd className="small-figure">backend/uploads/</dd>
            <p>{datasets.length} file{datasets.length === 1 ? '' : 's'}</p>
          </div>
          <div>
            <dt>Saved charts</dt>
            <dd>{full(savedCharts.length)}</dd>
            <p>reopen them from the Saved charts page</p>
          </div>
        </dl>
        <p className="hint">
          To back up, stop the backend and copy <code>backend/gramvision.db</code> and <code>backend/uploads/</code>{' '}
          together. Restoring one without the other leaves dataset records pointing at files that are not there.
        </p>
      </section>
    </>
  );
}
