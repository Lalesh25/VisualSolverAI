import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import PhotoCropModal from "./PhotoCropModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function initialsFromUser(user) {
  const label = (user?.name || user?.email || "?").trim();
  const parts = label.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPlanLabel(slug) {
  if (slug === "pro_monthly") return "Pro — Monthly";
  if (slug === "pro_annual") return "Pro — Annual";
  return null;
}

function formatPeriodEnd(iso) {
  if (!iso) return null;
  try {
    let s = String(iso).trim();
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
    if (!hasTz && /^\d{4}-\d{2}-\d{2}/.test(s)) {
      s = s.includes("T") ? s : s.replace(" ", "T");
      if (!/[zZ]$/.test(s)) s += "Z";
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  } catch {
    return null;
  }
}

export function ProfileAvatarButton({ user, isDarkMode, onClick }) {
  const initials = initialsFromUser(user);
  const ring = isDarkMode ? "ring-2 ring-white/20" : "ring-2 ring-slate-300/80";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open profile"
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 ${ring} ${
        isDarkMode
          ? "bg-gradient-to-br from-cyan-600 to-teal-700 text-white"
          : "bg-gradient-to-br from-teal-500 to-cyan-600 text-white"
      }`}
    >
      {user?.profile_photo ? (
        <img src={user.profile_photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </button>
  );
}

export default function ProfilePanel({ open, onClose, isDarkMode, panelClass }) {
  const { token, user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setCurrentPassword("");
      setNewPassword("");
      setNotice(null);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !cropImageSrc) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, cropImageSrc]);

  useEffect(() => {
    return () => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    };
  }, [cropImageSrc]);

  const closeCrop = useCallback(() => {
    setCropImageSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  if (!open) return null;

  const subtle = isDarkMode ? "text-slate-400" : "text-slate-600";
  const inputCls = `mt-1 w-full rounded-xl border px-3 py-2 text-sm ${
    isDarkMode
      ? "border-white/10 bg-slate-800/80 text-slate-100 placeholder:text-slate-500"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
  }`;

  const authHeaders = () =>
    token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  const showNotice = (text, isError) => {
    setNotice({ text, isError: !!isError });
  };

  const uploadPhotoDataUrl = async (dataUrl) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      showNotice("Could not process image.", true);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/me/photo`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ photo_data_url: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(typeof data.detail === "string" ? data.detail : "Could not update photo", true);
        return;
      }
      closeCrop();
      await refreshUser();
      showNotice("Photo updated.", false);
    } catch {
      showNotice("Network error.", true);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveName = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d.map((x) => x.msg || JSON.stringify(x)).join(" ")
              : "Could not update profile";
        showNotice(msg, true);
        return;
      }
      await refreshUser();
      showNotice("Profile updated.", false);
    } catch {
      showNotice("Network error.", true);
    } finally {
      setBusy(false);
    }
  };

  const handlePickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setCropImageSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleRemovePhoto = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/me/photo`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ photo_data_url: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showNotice(typeof data.detail === "string" ? data.detail : "Could not remove photo", true);
        return;
      }
      await refreshUser();
      showNotice("Photo removed.", false);
    } catch {
      showNotice("Network error.", true);
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      showNotice("New password must be at least 6 characters.", true);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(typeof data.detail === "string" ? data.detail : "Could not change password", true);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      showNotice("Password changed.", false);
    } catch {
      showNotice("Network error.", true);
    } finally {
      setBusy(false);
    }
  };

  const passwordUser = user?.password_user !== false;
  const isPro = user?.is_pro === true;
  const planLabel = formatPlanLabel(user?.subscription_plan);
  const periodEnd = formatPeriodEnd(user?.subscription_current_period_end);

  const initials = initialsFromUser(user);

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          aria-label="Close profile"
          onClick={onClose}
        />
        <div
          className={`relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 ${panelClass}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-panel-title"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2
              id="profile-panel-title"
              className={`font-display text-xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}
            >
              Profile
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-3 py-1 text-lg leading-none transition-colors ${
                isDarkMode
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              ×
            </button>
          </div>

          {user && (
            <div className="flex flex-wrap items-center gap-4">
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold ring-2 ${
                  isDarkMode ? "ring-cyan-500/40 bg-gradient-to-br from-cyan-600 to-teal-700 text-white" : "ring-teal-400/50 bg-gradient-to-br from-teal-500 to-cyan-600 text-white"
                }`}
              >
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {(user.name || "").trim() || "Your name"}
                </p>
                <p className={`text-sm ${subtle} break-all mt-0.5`}>{user.email}</p>
              </div>
            </div>
          )}

          <div
            className={`mt-5 rounded-2xl border px-4 py-3 ${
              isDarkMode ? "border-white/10 bg-slate-800/40" : "border-slate-200 bg-slate-50/90"
            }`}
          >
            <p className={`text-xs font-bold uppercase tracking-widest ${subtle}`}>Account</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  isPro
                    ? isDarkMode
                      ? "border border-amber-400/50 bg-amber-500/15 text-amber-100"
                      : "border border-amber-500/60 bg-amber-100 text-amber-950"
                    : isDarkMode
                      ? "border border-slate-600 bg-slate-800/80 text-slate-300"
                      : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {isPro ? "Pro" : "Free"}
              </span>
              {isPro && planLabel ? (
                <span className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {planLabel}
                </span>
              ) : null}
            </div>
            {isPro ? (
              <p className={`mt-2 text-sm leading-relaxed ${subtle}`}>
                {periodEnd ? (
                  <>
                    <span className="font-medium text-inherit">Current billing period ends: </span>
                    {periodEnd}
                  </>
                ) : (
                  "Renewal date will appear here after checkout (or your next billing sync). If you subscribed before this update, complete one renewal to refresh it."
                )}
              </p>
            ) : (
              <p className={`mt-2 text-sm ${subtle}`}>
                Upgrade to Pro for unlimited solves, steps, visual diagrams, and more.
              </p>
            )}
          </div>

          {notice && (
            <p
              className={`mt-3 text-sm ${notice.isError ? "text-red-500" : isDarkMode ? "text-teal-300" : "text-teal-700"}`}
            >
              {notice.text}
            </p>
          )}

          <label className={`mt-5 block text-xs font-semibold uppercase tracking-wider ${subtle}`}>
            Display name
          </label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            autoComplete="name"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveName}
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              isDarkMode
                ? "bg-cyan-600 text-white hover:bg-cyan-500"
                : "bg-teal-600 text-white hover:bg-teal-500"
            }`}
          >
            Save name
          </button>

          <div className={`mt-6 border-t pt-5 ${isDarkMode ? "border-white/10" : "border-slate-200"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${subtle}`}>Profile photo</p>
            <p className={`mt-1 text-xs ${subtle}`}>Choose a photo, then crop to a square before uploading.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label
                className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isDarkMode
                    ? "border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                    : "border-teal-600/40 text-teal-900 hover:bg-teal-50"
                } ${busy ? "pointer-events-none opacity-50" : ""}`}
              >
                Choose photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePickPhoto} disabled={busy} />
              </label>
              {user?.profile_photo && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRemovePhoto}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    isDarkMode
                      ? "border-slate-600 text-slate-300 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {passwordUser && (
            <div className={`mt-6 border-t pt-5 ${isDarkMode ? "border-white/10" : "border-slate-200"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${subtle}`}>Change password</p>
              <label className={`mt-3 block text-xs font-medium ${subtle}`}>Current password</label>
              <input
                type="password"
                className={inputCls}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <label className={`mt-2 block text-xs font-medium ${subtle}`}>New password</label>
              <input
                type="password"
                className={inputCls}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleChangePassword}
                className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  isDarkMode
                    ? "border border-white/15 bg-slate-800/80 text-slate-100 hover:bg-slate-800"
                    : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Update password
              </button>
            </div>
          )}
        </div>
      </div>

      {cropImageSrc ? (
        <PhotoCropModal
          imageSrc={cropImageSrc}
          isDarkMode={isDarkMode}
          onClose={closeCrop}
          onComplete={uploadPhotoDataUrl}
          busy={busy}
        />
      ) : null}
    </>
  );
}
