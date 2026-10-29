// API client: attaches the bearer token and explains failures in plain language.
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const OFFLINE =
  `Cannot reach the GramVision backend at ${API_BASE}. ` +
  'Start it in a second Terminal tab with: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000';

export async function api(path, options = {}) {
  const token = localStorage.getItem('gv_token');
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(OFFLINE);
  }

  if (response.status === 401 && token) {
    localStorage.removeItem('gv_token');
    window.location.reload();
    throw new Error('Your session expired. Sign in again.');
  }

  if (!response.ok) {
    let detail = `That request failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
      else if (Array.isArray(payload.detail)) detail = payload.detail.map((item) => item.msg).join('; ');
    } catch {
      /* keep the status-code message */
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}
