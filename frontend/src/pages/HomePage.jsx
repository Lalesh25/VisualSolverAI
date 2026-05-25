import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatModelOutput } from '../utils/formatModelOutput';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function previewText(text, max = 220) {
  const t = (text || '').trim();
  if (t.length <= max) return { short: t, more: false };
  return { short: `${t.slice(0, max)}…`, more: true };
}

export default function HomePage() {
  const { token, logout, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/history/submissions?limit=80`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const d = data.detail;
        setError(typeof d === 'string' ? d : 'Could not load history');
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    load();
  }, [load]);

  const openImageModal = async (id) => {
    if (!token) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`${API_BASE}/history/submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        setDetail({ error: 'Could not load this solve.' });
        return;
      }
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail({ error: 'Network error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-brand-night text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'linear-gradient(125deg, #070b14 0%, #0c1a2e 40%, #0a1628 100%), radial-gradient(ellipse 80% 60% at 20% 10%, rgba(20, 184, 166, 0.18) 0%, transparent 55%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              VisualSolver AI
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-transparent sm:text-3xl">
              Your solves
            </h1>
            {user?.email && (
              <p className="mt-1 text-sm text-slate-400">{user.email}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Site home
            </Link>
            <Link
              to="/canvas"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Open workspace
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
              }}
              className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </header>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-center text-sm text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-6 py-12 text-center backdrop-blur-xl">
            <p className="text-slate-300">No solves yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Draw a problem in the workspace — it will show up here with the answer.
            </p>
            <Link
              to="/canvas"
              className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
            >
              Go to workspace
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-4">
            {items.map((row) => {
              const id = row._id;
              const formatted = formatModelOutput(row.result || '');
              const { short, more } = previewText(formatted);
              const isOpen = expanded[id];
              return (
                <li
                  key={id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 pb-3">
                    <span className="text-xs text-slate-500">{formatWhen(row.timestamp)}</span>
                    <div className="flex gap-2">
                      {row.show_steps && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                          Steps
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openImageModal(id)}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                      >
                        View sketch
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-slate-200">
                    {isOpen ? (
                      <pre className="whitespace-pre-wrap font-sans text-[13px] text-slate-200">
                        {formatted}
                      </pre>
                    ) : (
                      <p className="text-[13px] text-slate-300">{short}</p>
                    )}
                    {(more || formatted.length > 220) && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(id)}
                        className="mt-2 text-xs font-semibold text-teal-400 hover:text-teal-300"
                      >
                        {isOpen ? 'Show less' : 'Show full answer'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => {
              setDetail(null);
              setDetailLoading(false);
            }}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="flex justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-white">Sketch</h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailLoading(false);
                }}
                className="text-2xl leading-none text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            {detailLoading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              </div>
            )}
            {!detailLoading && detail?.error && (
              <p className="mt-4 text-rose-300">{detail.error}</p>
            )}
            {!detailLoading && detail && !detail.error && detail.image_data_url && (
              <img
                src={detail.image_data_url}
                alt="Problem sketch"
                className="mt-4 w-full rounded-xl border border-white/10"
              />
            )}
            {!detailLoading && detail && !detail.error && detail.result && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Answer
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-200">
                  {formatModelOutput(detail.result || '')}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
