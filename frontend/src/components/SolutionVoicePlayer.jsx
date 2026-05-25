import React, { useCallback, useEffect, useState } from "react";

const RATE_MIN = 0.5;
const RATE_MAX = 2;
const PRESETS = [
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

/**
 * Reads plain-text solution aloud with adjustable playback speed (Web Speech API).
 */
export default function SolutionVoicePlayer({ text, isDarkMode }) {
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState("idle"); // idle | playing | paused
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const startSpeaking = useCallback(
    (speechRate) => {
      const t = (text || "").trim();
      if (!t || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const r = Math.min(RATE_MAX, Math.max(RATE_MIN, speechRate));
      const u = new SpeechSynthesisUtterance(t);
      u.rate = r;
      u.onend = () => setStatus("idle");
      u.onerror = () => setStatus("idle");
      window.speechSynthesis.speak(u);
      setStatus("playing");
    },
    [text]
  );

  useEffect(() => {
    stop();
  }, [text, stop]);

  const togglePlay = useCallback(() => {
    if (!supported) return;
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
      return;
    }
    if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    startSpeaking(rate);
  }, [supported, status, startSpeaking, rate]);

  const applyRate = useCallback(
    (nextRate) => {
      const r = Math.min(RATE_MAX, Math.max(RATE_MIN, nextRate));
      setRate(r);
      if (status === "playing" || status === "paused") {
        window.speechSynthesis.cancel();
        startSpeaking(r);
      }
    },
    [status, startSpeaking]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) {
    return (
      <div
        className={`rounded-t-2xl border px-4 py-3 text-sm ${
          isDarkMode
            ? "border-white/10 bg-slate-900/95 text-slate-400"
            : "border-slate-200 bg-white/95 text-slate-600"
        }`}
      >
        Voice playback is not supported in this browser.
      </div>
    );
  }

  const subtle = isDarkMode ? "text-slate-400" : "text-slate-600";
  const btnBase =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px]";

  return (
    <div
      className={`rounded-t-2xl border shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl ${
        isDarkMode
          ? "border-white/10 bg-slate-900/95 text-slate-100"
          : "border-slate-200/90 bg-white/95 text-slate-900"
      }`}
      role="region"
      aria-label="Voice explanation"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${subtle}`}>
            Voice
          </span>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!(text || "").trim()}
            className={`${btnBase} text-white ${
              (text || "").trim()
                ? "bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-95"
                : "cursor-not-allowed bg-slate-500 opacity-50"
            }`}
          >
            {status === "playing" ? "Pause" : status === "paused" ? "Resume" : "Play"}
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={status === "idle"}
            className={`${btnBase} border ${
              status === "idle"
                ? isDarkMode
                  ? "border-slate-700 text-slate-500 cursor-not-allowed"
                  : "border-slate-200 text-slate-400 cursor-not-allowed"
                : isDarkMode
                  ? "border-slate-500 text-slate-200 hover:bg-slate-800"
                  : "border-slate-300 text-slate-800 hover:bg-slate-50"
            }`}
          >
            Stop
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-medium ${subtle}`}>Speed</span>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                isDarkMode ? "text-cyan-300" : "text-teal-700"
              }`}
            >
              {rate.toFixed(2)}×
            </span>
          </div>
          <input
            type="range"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.05}
            value={rate}
            onChange={(e) => applyRate(Number(e.target.value))}
            className={`h-2 w-full cursor-pointer ${
              isDarkMode ? "accent-cyan-400" : "accent-teal-600"
            }`}
            aria-label="Speech speed"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyRate(p.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  Math.abs(rate - p.value) < 0.01
                    ? isDarkMode
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/50"
                      : "bg-teal-100 text-teal-900 ring-1 ring-teal-400/60"
                    : isDarkMode
                      ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
