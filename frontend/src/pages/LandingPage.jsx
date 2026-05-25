import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPageContent } from './AuthPage';

const FEATURES = [
  {
    title: 'Draw or upload',
    body: 'Sketch problems on the canvas or drop in a photo of your notes. Optimized preprocessing helps the model read your handwriting.',
    icon: '✏️',
  },
  {
    title: 'AI-powered solving',
    body: 'Gemini reads the image, understands the task, and returns a clear answer—math, science, and more.',
    icon: '⚡',
  },
  {
    title: 'Step-by-step (Pro)',
    body: 'Optional numbered reasoning so you learn the path to the answer, not just the final number.',
    icon: '📋',
  },
  {
    title: 'Visual diagrams (Pro)',
    body: 'Optional flow-style Mermaid diagrams that summarize how the solution fits together.',
    icon: '🔮',
  },
  {
    title: 'Listen & export',
    body: 'Voice read-out with speed control, PDF download, and a history of your past solves.',
    icon: '🔊',
  },
];

export default function LandingPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'signup'
  const closeAuthModal = useCallback(() => setAuthModal(null), []);

  useEffect(() => {
    if (authModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [authModal]);

  return (
    <div className="min-h-screen bg-brand-night text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background:
            'linear-gradient(125deg, #070b14 0%, #0c1a2e 40%, #0a1628 100%), radial-gradient(ellipse 80% 60% at 20% 10%, rgba(20, 184, 166, 0.2) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 30%, rgba(251, 191, 36, 0.08) 0%, transparent 45%)',
        }}
      />
      <div className="pointer-events-none fixed -top-24 -left-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-96 w-96 rounded-full bg-teal-600/15 blur-[110px]" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-brand-night/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-lg font-extrabold tracking-tight text-white">
            VisualSolver<span className="text-cyan-400"> AI</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-300">
            <a href="#problem" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">
              Why us
            </a>
            <a href="#features" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">
              Features
            </a>
            <a href="#pricing" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">
              Pricing
            </a>
            {!loading && isAuthenticated ? (
              <>
                <Link
                  to="/home"
                  className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-4 py-2 text-slate-100 hover:bg-slate-700"
                >
                  Your solves
                </Link>
                <Link
                  to="/canvas"
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 font-semibold text-white shadow-glow hover:opacity-95"
                >
                  Workspace
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAuthModal('login')}
                  className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-4 py-2 text-slate-100 hover:bg-slate-700"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal('signup')}
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 font-semibold text-white shadow-glow hover:opacity-95"
                >
                  Sign up
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400/90">Problem → solution</p>
            <h1 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              Turn sketches &amp; photos into{' '}
              <span className="bg-gradient-to-r from-teal-300 via-cyan-200 to-teal-100 bg-clip-text text-transparent">
                solved work
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              VisualSolver AI reads what you draw or upload, solves it with clear explanations, and helps you learn
              faster—whether you are practicing for exams or checking homework.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {!loading && isAuthenticated ? (
                <Link
                  to="/canvas"
                  className="min-h-[48px] rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400 px-8 py-3 text-base font-bold text-white shadow-glow hover:opacity-95"
                >
                  Open workspace
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthModal('signup')}
                    className="min-h-[48px] rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400 px-8 py-3 text-base font-bold text-white shadow-glow hover:opacity-95"
                  >
                    Get started free
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal('login')}
                    className="min-h-[48px] rounded-2xl border border-white/15 bg-white/5 px-8 py-3 text-base font-semibold text-slate-100 backdrop-blur hover:bg-white/10"
                  >
                    Log in
                  </button>
                </>
              )}
              <a
                href="#features"
                className="min-h-[48px] rounded-2xl px-6 py-3 text-base font-semibold text-cyan-300/90 hover:text-white"
              >
                See features ↓
              </a>
            </div>
          </div>
        </section>

        {/* Problem / solution */}
        <section id="problem" className="scroll-mt-24 border-t border-white/5 bg-slate-950/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">What problem we solve</h2>
                <p className="mt-4 text-slate-400 leading-relaxed">
                  Typed math tools are clunky for real homework: your work is on paper, a whiteboard, or a tablet. Getting
                  a trustworthy answer without retyping everything wastes time. VisualSolver AI is built for{' '}
                  <strong className="font-semibold text-slate-200">visual input</strong>—so the path from your sketch to
                  a solution stays short.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-8 shadow-xl">
                <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400">What you can do</h3>
                <ul className="mt-4 space-y-3 text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span>
                    Capture a problem exactly as you wrote it—no LaTeX required from you.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span>
                    Get concise answers on the free tier; unlock deep steps and diagrams on Pro.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span>
                    Revisit past solves in your account and export or listen along.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-bold text-white sm:text-4xl">Features</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
              Everything in one workspace, tuned for students and self-learners.
            </p>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-lg transition hover:border-teal-500/30 hover:bg-slate-900/60"
                >
                  <span className="text-3xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 border-t border-white/5 bg-slate-950/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-bold text-white sm:text-4xl">Pricing</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
              Start free, upgrade when you want unlimited power.
            </p>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Starter</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-white">Free</p>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Limited solves per day
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Draw &amp; upload
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Final answer focus
                  </li>
                </ul>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => setAuthModal('signup')}
                    className="mt-8 w-full rounded-xl border border-slate-600 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Create free account
                  </button>
                )}
              </div>
              <div className="relative flex flex-col rounded-2xl border-2 border-teal-400/50 bg-gradient-to-b from-teal-950/80 to-slate-950 p-8 shadow-glow md:-translate-y-1">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950">
                  Popular
                </span>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-400/90">Pro</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-white">
                  ₹3,000<span className="text-base font-semibold text-slate-400">/mo</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Unlimited solves
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Step-by-step reasoning
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Visual diagrams &amp; PDF
                  </li>
                </ul>
                {isAuthenticated ? (
                  <Link
                    to="/canvas#subscription-section"
                    className="mt-8 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 py-3 text-sm font-bold text-white hover:opacity-95"
                  >
                    Upgrade in workspace
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthModal('signup')}
                    className="mt-8 w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 py-3 text-sm font-bold text-white hover:opacity-95"
                  >
                    Sign up to subscribe
                  </button>
                )}
              </div>
              <div className="flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pro annual</p>
                <p className="mt-2 font-display text-3xl font-extrabold text-white">
                  ₹30,000<span className="text-base font-semibold text-slate-400">/yr</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Effective ₹2,500/mo — best for regular use</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-amber-400">✓</span> Everything in Pro
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400">✓</span> Save vs monthly
                  </li>
                </ul>
                {isAuthenticated ? (
                  <Link
                    to="/canvas#subscription-section"
                    className="mt-8 flex w-full items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                  >
                    Upgrade in workspace
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthModal('signup')}
                    className="mt-8 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                  >
                    Get started
                  </button>
                )}
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-slate-500">
              Subscriptions are completed inside the app workspace via Razorpay after you sign in.
            </p>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Ready to solve visually?</h2>
            <p className="mt-3 text-slate-400">Sign in, open the canvas, and send your first problem in seconds.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {!loading && isAuthenticated ? (
                <Link
                  to="/canvas"
                  className="rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 px-8 py-3 font-bold text-white hover:opacity-95"
                >
                  Go to workspace
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthModal('signup')}
                    className="rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 px-8 py-3 font-bold text-white hover:opacity-95"
                  >
                    Sign up free
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal('login')}
                    className="rounded-2xl border border-white/15 px-8 py-3 font-semibold text-slate-200 hover:bg-white/5"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-600">
          © VisualSolver AI · Draw. Solve. Learn.
          {user?.email ? (
            <span className="block mt-2 text-slate-500">
              Signed in as {user.email} ·{' '}
              <Link to="/home" className="text-cyan-500 hover:underline">
                Dashboard
              </Link>
            </span>
          ) : null}
        </footer>
      </main>

      {/* Auth modal — same form as /login */}
      {authModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            aria-label="Close"
            onClick={closeAuthModal}
          />
          <div className="relative z-10 max-h-[min(100dvh-2rem,900px)] w-full max-w-md overflow-y-auto py-4">
            <AuthPageContent
              key={authModal}
              embedded
              initialIsLogin={authModal === 'login'}
              onClose={closeAuthModal}
              redirectTo="/home"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
