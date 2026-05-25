/** Backend base URL (no trailing slash). Set VITE_API_URL on Vercel to your Render https URL. */
const raw = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').trim();
export const API_BASE = raw.replace(/\/+$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** True when production build points at the same host as the static site (common misconfig). */
export function isApiSameAsFrontend() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  try {
    return new URL(API_BASE).host === window.location.host;
  } catch {
    return false;
  }
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      const hint = isApiSameAsFrontend()
        ? 'VITE_API_URL is pointing at your Vercel site. Set it to your Render URL (https://….onrender.com) and redeploy.'
        : `Wrong API URL or backend route missing. Expected backend at ${API_BASE} — open ${API_BASE}/docs in a browser to verify.`;
      throw new Error(hint);
    }
    if (data && typeof data.detail === 'string') throw new Error(data.detail);
    if (data && Array.isArray(data.detail)) {
      throw new Error(
        data.detail.map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x))).join(' ')
      );
    }
    throw new Error(response.statusText || 'Request failed');
  }

  return data;
}
