// Sign in, register, and the two password-recovery steps.
import React, { useState } from 'react';
import { api } from '../lib/api.js';

const HEADINGS = {
  login: 'Welcome back',
  register: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Set a new password',
};

const BLURBS = {
  login: 'Your datasets, saved charts and settings are waiting where you left them.',
  register: 'One account keeps your uploads and saved visualizations together on this machine.',
  forgot: 'Enter the email on your account and we will send a six-digit code.',
  reset: 'Enter the code from your email along with the password you want to use.',
};

// A field of enumeration blocks — the unit this workspace is built on.
function BlockField() {
  const cells = Array.from({ length: 108 }, (_, i) => i);
  const lit = new Set([7, 8, 19, 20, 31, 44, 45, 56, 68, 69, 70, 81, 93, 94]);
  return (
    <div className="block-field" aria-hidden="true">
      {cells.map((cell) => (
        <span key={cell} className={lit.has(cell) ? 'lit' : ''} />
      ))}
    </div>
  );
}

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('info');
  const [busy, setBusy] = useState(false);

  function go(next) {
    setMode(next);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'login' || mode === 'register') {
        const body = mode === 'login' ? { email, password } : { name, email, password };
        const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
        onLogin(result);
        return;
      }
      if (mode === 'forgot') {
        const result = await api(`/api/auth/forgot-password?email=${encodeURIComponent(email)}`, { method: 'POST' });
        setMode('reset');
        setTone('info');
        setMessage(result.message || 'If that account exists, a code is on its way. Check your spam folder too.');
        return;
      }
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password, purpose: 'reset' }),
      });
      setMode('login');
      setPassword('');
      setCode('');
      setTone('good');
      setMessage('Password changed. Sign in with the new one.');
    } catch (error) {
      setTone('bad');
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-side">
        <div className="auth-brand">
          <span className="mark">GV</span>
          GramVision
        </div>
        <div className="auth-pitch">
          <h1>Read Surat block by block.</h1>
          <p>
            Two thousand enumeration blocks across ten municipal zones, charted the moment you sign in — with the
            reading written underneath every graph.
          </p>
        </div>
        <BlockField />
        <p className="auth-foot-note">District and village data analysis, running entirely on your own machine.</p>
      </section>

      <section className="auth-main">
        <div className="auth-card">
          <h2>{HEADINGS[mode]}</h2>
          <p className="auth-blurb">{BLURBS[mode]}</p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Your name
                <input required maxLength="120" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vimal Prajapati" />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {['login', 'register', 'reset'].includes(mode) && (
              <label>
                {mode === 'reset' ? 'New password' : 'Password'}
                <input
                  type="password"
                  minLength="8"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            {mode === 'reset' && (
              <label>
                Six-digit code from your email
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                />
              </label>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy
                ? 'Working…'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'forgot'
                      ? 'Send the code'
                      : 'Change password'}
            </button>
          </form>

          {message && <div className={`banner ${tone}`}>{message}</div>}

          {mode === 'login' ? (
            <div className="auth-switch">
              <button type="button" className="link" onClick={() => go('forgot')}>
                Forgot your password?
              </button>
              <button type="button" className="link" onClick={() => go('register')}>
                Create an account
              </button>
            </div>
          ) : (
            <button type="button" className="link back" onClick={() => go('login')}>
              Back to sign in
            </button>
          )}

          <p className="auth-small">
            Passwords are stored as one-way hashes. Reset codes need SMTP details in <code>backend/.env</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
