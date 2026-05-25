import React, { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";

const OUTPUT_MAX = 512;
const JPEG_QUALITY = 0.88;

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.src = url;
  });
}

/**
 * Returns a JPEG data URL from the image region defined by pixelCrop (from react-easy-crop).
 */
async function getCroppedJpegDataUrl(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  const maxEdge = Math.max(pixelCrop.width, pixelCrop.height);
  const scale = maxEdge > OUTPUT_MAX ? OUTPUT_MAX / maxEdge : 1;
  const w = Math.round(pixelCrop.width * scale);
  const h = Math.round(pixelCrop.height * scale);

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    w,
    h
  );
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * Square crop modal for profile photos (1:1).
 */
export default function PhotoCropModal({ imageSrc, isDarkMode, onClose, onComplete, busy }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving, busy]);

  const subtle = isDarkMode ? "text-slate-400" : "text-slate-600";

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels || busy || saving) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedJpegDataUrl(imageSrc, croppedAreaPixels);
      await onComplete(dataUrl);
    } catch {
      /* parent shows notice */
    } finally {
      setSaving(false);
    }
  };

  const panel = isDarkMode
    ? "border-white/10 bg-slate-900 text-slate-100"
    : "border-slate-200 bg-white text-slate-900";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close crop"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
      >
        <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
          <h2 id="photo-crop-title" className="font-display text-lg font-bold">
            Crop photo
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || busy}
            className={`rounded-xl px-3 py-1 text-xl leading-none transition-colors disabled:opacity-50 ${
              isDarkMode
                ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            ×
          </button>
        </div>

        <p className={`px-4 pt-3 text-xs ${subtle}`}>
          Drag to reposition, use the slider to zoom. The photo is saved as a square.
        </p>

        <div className="relative mx-4 mt-3 h-72 w-auto overflow-hidden rounded-xl bg-black sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 flex items-center gap-3">
            <span className={`text-xs font-medium uppercase tracking-wider ${subtle}`}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className={`h-2 flex-1 cursor-pointer ${isDarkMode ? "accent-cyan-400" : "accent-teal-600"}`}
              aria-label="Zoom crop"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || busy}
              className={`min-h-[44px] flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                isDarkMode
                  ? "border-slate-600 text-slate-200 hover:bg-slate-800"
                  : "border-slate-300 text-slate-800 hover:bg-slate-50"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || busy || !croppedAreaPixels}
              className="min-h-[44px] flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving || busy ? "Saving…" : "Use photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
