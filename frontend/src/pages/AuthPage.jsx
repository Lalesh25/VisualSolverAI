import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function parseApiError(data) {
  if (!data) return 'Something went wrong';
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x)))
      .join(' ');
  }
  return 'Something went wrong';
}

/**
 * @param {object} props
 * @param {boolean} [props.embedded] - Modal/card only (no full-page background)
 * @param {() => void} [props.onClose] - Called after successful auth (and parent may unmount modal)
 * @param {boolean} [props.initialIsLogin] - Start on sign-in vs register
 * @param {string} [props.redirectTo] - Where to navigate after success (full page mode)
 */
export function AuthPageContent({
  embedded = false,
  onClose,
  initialIsLogin = true,
  redirectTo = '/home',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    setIsLogin(initialIsLogin);
  }, [initialIsLogin]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
      onClose?.();
    }
  }, [authLoading, isAuthenticated, navigate, onClose, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin ? { email, password } : { email, password, name };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(parseApiError(data));
      }

      await login(data.access_token, data);
      navigate(redirectTo, { replace: true });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(parseApiError(data));
      }
      await login(data.access_token, data);
      navigate(redirectTo, { replace: true });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div
      className={`relative w-full max-w-md perspective-dramatic ${embedded ? 'mx-auto' : ''}`}
    >
      {embedded && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-1 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/90 text-xl leading-none text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      )}
      <div
        className="preserve-3d animate-tilt-enter motion-reduce:animate-none rounded-3xl p-[1px] bg-gradient-to-br from-cyan-400/50 via-teal-500/25 to-amber-400/40 shadow-3d-lg"
        style={{ animationDelay: '0.05s' }}
      >
        <div className="rounded-[22px] bg-slate-950/85 backdrop-blur-2xl border border-white/10 px-8 py-10 shadow-inner preserve-3d">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 shadow-glow mb-5 transform transition-transform hover:scale-105 hover:rotate-3 duration-300">
              <span className="text-3xl drop-shadow-lg" aria-hidden>
                🧠
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-transparent">
              VisualSolver AI
            </h1>
            <p className="mt-2 text-sm text-slate-400 font-medium">
              {isLogin ? 'Sign in to your workspace' : 'Create your account'}
            </p>
          </div>

          {googleClientId && (
            <div className="space-y-5 mb-8">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5 p-1 shadow-3d-sm hover:shadow-glow transition-shadow duration-500">
                <div className="flex justify-center w-full [&>div]:w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in was cancelled or failed')}
                    theme="filled_black"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    width="100%"
                  />
                </div>
              </div>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700/80" />
                </div>
                <div className="relative flex justify-center text-xs font-medium uppercase tracking-widest">
                  <span className="bg-slate-950/90 px-3 text-slate-500">or email</span>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-600 input-glow transition-all"
                  placeholder="Ada Lovelace"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-600 input-glow transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-600 input-glow transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-center text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-3d w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400 text-white text-[15px] tracking-wide"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait…
                </span>
              ) : isLogin ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm text-cyan-400/90 hover:text-amber-300 font-medium transition-colors duration-200"
            >
              {isLogin ? 'Need an account? Register' : 'Already registered? Sign in'}
            </button>
          </form>
        </div>
      </div>
      {!embedded && (
        <p className="mt-8 text-center text-xs text-slate-600">
          Draw. Solve. Learn — with depth.
        </p>
      )}
    </div>
  );

  if (embedded) {
    return card;
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand-night flex items-center justify-center py-14 px-4 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 animate-mesh-shift"
        style={{
          background:
            'linear-gradient(125deg, #070b14 0%, #0c1a2e 40%, #0a1628 100%), radial-gradient(ellipse 80% 60% at 20% 10%, rgba(20, 184, 166, 0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 85% 20%, rgba(251, 191, 36, 0.12) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 50% 100%, rgba(34, 211, 238, 0.1) 0%, transparent 45%)',
          backgroundSize: '200% 200%',
        }}
      />
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-cyan-500/25 blur-[100px] animate-float-y" />
      <div className="pointer-events-none absolute top-1/3 -right-16 h-80 w-80 rounded-full bg-amber-400/15 blur-[110px] animate-float-y-delay" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-teal-500/20 blur-[90px] animate-pulse-ring" />

      <div className="relative z-10 w-full flex justify-center">{card}</div>
    </div>
  );
}

export default function AuthPage() {
  return <AuthPageContent />;
}
