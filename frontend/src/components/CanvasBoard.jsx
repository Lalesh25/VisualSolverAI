import React, { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ProfilePanel, { ProfileAvatarButton } from "./ProfilePanel";
import MermaidBlock from "./MermaidBlock";
import SolutionVoicePlayer from "./SolutionVoicePlayer";
import { formatModelOutput, wrapTextLines } from "../utils/formatModelOutput";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/** Matches UI font (Source Sans 3) for answer/error text drawn on canvas */
const CANVAS_TEXT_FONT =
  '500 24px "Source Sans 3", system-ui, sans-serif';

/** One column width for every block — keeps header, tools, canvas, actions aligned */
const SHELL = "w-full max-w-5xl mx-auto px-4 sm:px-6";

/** Name for welcome line: profile name, else capitalized email local-part (e.g. king@ → King). */
function displayWelcomeName(user) {
  const n = (user?.name || "").trim();
  if (n) return n;
  const local = (user?.email || "").split("@")[0] || "";
  if (!local) return "";
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

const MSG_UPGRADE_UPLOAD = "Upgrade to Pro first to upload images.";
const MSG_UPGRADE_STEPS = "Upgrade to Pro first for step-by-step solutions.";
const MSG_UPGRADE_VISUAL = "Upgrade to Pro first for visual explanations.";

const CanvasPage = () => {
  const { token, logout, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [showSteps, setShowSteps] = useState(false);
  const [showVisualExplanation, setShowVisualExplanation] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [result, setResult] = useState("");
  const [fullSolution, setFullSolution] = useState(""); // Store full solution for PDF
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState("black");
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(14);
  /** Size sliders hidden until user clicks a color (pen) or Eraser */
  const [showSizePanel, setShowSizePanel] = useState(false);
  /** Which size control to show: pen after color click, eraser after eraser click */
  const [sizePanelMode, setSizePanelMode] = useState("brush");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [stepsText, setStepsText] = useState("");
  const [visualExplanation, setVisualExplanation] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const isPro = user?.is_pro === true;

  useEffect(() => {
    if (!isPro) {
      setShowSteps(false);
      setShowVisualExplanation(false);
      setUploadedFile(null);
    }
  }, [isPro]);

  const authHeaders = () =>
    token ? { Authorization: `Bearer ${token}` } : {};

  const handleUnauthorized = () => {
    logout();
    navigate("/", { replace: true });
  };

  /** Paints the answer on the main canvas with word wrap for long lines. */
  const paintAnswerOnCanvas = (directAnswer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = isDarkMode ? "#374151" : "white";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isDarkMode ? "#f3f4f6" : "#1f2937";
    ctx.font = CANVAS_TEXT_FONT;
    ctx.textAlign = "center";
    const maxW = Math.max(48, w - 48);
    const lines = wrapTextLines(ctx, directAnswer, maxW);
    const lineHeight = 30;
    const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * lineHeight);
    });
  };

  // --- Keep canvas drawing buffer in sync with CSS size (crisp lines) ---
  const syncCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    // Size via CSS (Tailwind) -> measure resulting layout size
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Match drawing buffer to CSS size * DPR
    const needResize =
      canvas.width !== Math.floor(displayWidth * dpr) ||
      canvas.height !== Math.floor(displayHeight * dpr);

    if (needResize) {
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);

      const ctx = canvas.getContext("2d");
      // Scale so 1 unit = 1 CSS pixel
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Reset to white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, displayWidth, displayHeight);
    }
  };

  useEffect(() => {
    syncCanvasSize();
    const onResize = () => syncCanvasSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Repaint bg when theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }, [isDarkMode]);

  const startDrawing = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.strokeStyle = isEraser ? "white" : selectedColor;
    ctx.lineWidth = isEraser ? eraserSize : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setResult("");
    setUploadedFile(null);
    setVisualExplanation("");
  };

  // --- Image preprocessing for better OCR ---
  const enhanceCanvasImage = (canvas) => {
    const offCanvas = document.createElement("canvas");
    const scale = 2;
    offCanvas.width = canvas.width * scale;
    offCanvas.height = canvas.height * scale;
    const offCtx = offCanvas.getContext("2d");

    offCtx.fillStyle = "white";
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.scale(scale, scale);
    offCtx.drawImage(canvas, 0, 0);

    const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const val = avg < 210 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
    offCtx.putImageData(imgData, 0, 0);
    return offCanvas;
  };

  const getAnswer = async () => {
    if (!isPro && showSteps) {
      window.alert(MSG_UPGRADE_STEPS);
      return;
    }
    if (!isPro && showVisualExplanation) {
      window.alert(MSG_UPGRADE_VISUAL);
      return;
    }

    const canvas = canvasRef.current;

    // ensure canvas buffer is synced before export
    syncCanvasSize();

    const enhancedCanvas = enhanceCanvasImage(canvas);
    const blob = await new Promise((resolve) =>
      enhancedCanvas.toBlob(resolve, "image/png")
    );

    if (!blob) {
      alert("No drawing found!");
      return;
    }

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("show_steps", showSteps);
    formData.append("visual_explanation", showVisualExplanation);
    formData.append("source", "canvas");

    setLoading(true);
    setResult("");
    setVisualExplanation("");

    try {
      const res = await fetch(`${API_BASE}/process_image`, {
        method: "POST",
        body: formData,
        headers: authHeaders(),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        const d = errData.detail;
        window.alert(typeof d === "string" ? d : MSG_UPGRADE_STEPS);
        return;
      }
      if (!res.ok) throw new Error("Failed to reach backend");

      const data = await res.json();
      const raw =
        data.solution || data.error || "No result found.";
      const fullAnswer = formatModelOutput(raw);
      const ve = typeof data.visual_explanation === "string" ? data.visual_explanation : "";

      let directAnswer = fullAnswer;
      let steps = "";

      if (showSteps) {
        const stepIndex = fullAnswer.search(/\bstep\s*\d+/i);
        if (stepIndex !== -1) {
          if (stepIndex > 0) {
            directAnswer = fullAnswer.substring(0, stepIndex).trim();
            steps = fullAnswer.substring(stepIndex);
          } else {
            steps = fullAnswer;
            directAnswer = "See steps below";
          }
        }
      }

      // Store full solution for PDF download
      setFullSolution(fullAnswer);

      paintAnswerOnCanvas(directAnswer);

      setResult(directAnswer);
      setVisualExplanation(ve);

      if ((showSteps && steps) || ve) {
        setStepsText(steps);
        setShowModal(true);
      }
    } catch (err) {
      console.error(err);
      const errorMsg = "Error connecting to backend. Check if it's running.";
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = isDarkMode ? "#374151" : "white";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.fillStyle = "#ef4444";
      ctx.font = CANVAS_TEXT_FONT;
      ctx.textAlign = "center";
      ctx.fillText(errorMsg, canvas.clientWidth / 2, canvas.clientHeight / 2);
      setResult(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const submitUploadedImage = async () => {
    if (!isPro) {
      window.alert(MSG_UPGRADE_UPLOAD);
      return;
    }
    if (!uploadedFile) {
      alert("Please select an image to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadedFile);
    formData.append("show_steps", showSteps);
    formData.append("visual_explanation", showVisualExplanation);
    formData.append("source", "upload");

    setLoading(true);
    setResult("");
    setVisualExplanation("");

    try {
      const res = await fetch(`${API_BASE}/process_image`, {
        method: "POST",
        body: formData,
        headers: authHeaders(),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        const d = errData.detail;
        window.alert(typeof d === "string" ? d : MSG_UPGRADE_UPLOAD);
        return;
      }
      if (!res.ok) throw new Error("Failed to reach backend");

      const data = await res.json();
      const raw =
        data.solution || data.error || "No result found.";
      const fullAnswer = formatModelOutput(raw);
      const ve = typeof data.visual_explanation === "string" ? data.visual_explanation : "";

      let directAnswer = fullAnswer;
      let steps = "";

      if (showSteps) {
        const stepIndex = fullAnswer.search(/\bstep\s*\d+/i);
        if (stepIndex !== -1) {
          if (stepIndex > 0) {
            directAnswer = fullAnswer.substring(0, stepIndex).trim();
            steps = fullAnswer.substring(stepIndex);
          } else {
            steps = fullAnswer;
            directAnswer = "See steps below";
          }
        }
      }

      // Store full solution for PDF download
      setFullSolution(fullAnswer);

      paintAnswerOnCanvas(directAnswer);

      setResult(directAnswer);
      setVisualExplanation(ve);

      if ((showSteps && steps) || ve) {
        setStepsText(steps);
        setShowModal(true);
      }
    } catch (err) {
      console.error(err);
      const errorMsg = "Error connecting to backend. Check if it's running.";
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = isDarkMode ? "#374151" : "white";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.fillStyle = "#ef4444";
      ctx.font = CANVAS_TEXT_FONT;
      ctx.textAlign = "center";
      ctx.fillText(errorMsg, canvas.clientWidth / 2, canvas.clientHeight / 2);
      setResult(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- Download solution as PDF ---
  const downloadPDF = async () => {
    if (!fullSolution) {
      alert("No solution to download!");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("solution", fullSolution);
      formData.append("filename", "visualsolver-solution");

      const res = await fetch(`${API_BASE}/download_pdf`, {
        method: "POST",
        body: formData,
        headers: authHeaders(),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error("Failed to generate PDF");

      // Create blob and download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "visualsolver-solution.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF. Please try again.");
    }
  };

  const panel = isDarkMode
    ? "rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
    : "rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(15,23,42,0.08)]";

  const subtle = isDarkMode ? "text-slate-400" : "text-slate-600";

  const scrollToSubscription = () => {
    document.getElementById("subscription-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load Razorpay"));
      document.body.appendChild(s);
    });

  const handlePlanClick = async (planId) => {
    if (planId === "free") {
      window.alert("You're on the Free plan. Upgrade anytime from here.");
      return;
    }

    if (!token) {
      window.alert("Please sign in to subscribe.");
      return;
    }

    setSubscribeLoading(planId);
    try {
      await loadRazorpayScript();
      const res = await fetch(`${API_BASE}/payments/razorpay/create-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((x) => (typeof x === "string" ? x : x.msg || JSON.stringify(x))).join(" ")
              : "Could not start checkout";
        window.alert(msg);
        return;
      }

      const { subscription_id, key_id } = data;
      const options = {
        key: key_id,
        subscription_id,
        name: "VisualSolver AI",
        description: planId === "pro_monthly" ? "Pro — Monthly" : "Pro — Annual",
        prefill: {
          email: user?.email || "",
          name: (user?.name || "").trim(),
        },
        theme: { color: isDarkMode ? "#0891b2" : "#0d9488" },
        async handler(response) {
          const payId = response?.razorpay_payment_id;
          const subId = response?.razorpay_subscription_id;
          const sig = response?.razorpay_signature;
          if (!payId || !subId || !sig) {
            window.alert("Missing payment confirmation from Razorpay. Please contact support.");
            return;
          }
          try {
            const confirmRes = await fetch(`${API_BASE}/payments/razorpay/confirm-subscription`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
              },
              body: JSON.stringify({
                razorpay_subscription_id: subId,
                razorpay_payment_id: payId,
                razorpay_signature: sig,
              }),
            });
            const confirmData = await confirmRes.json().catch(() => ({}));
            if (!confirmRes.ok) {
              const detail = confirmData.detail;
              const msg =
                typeof detail === "string"
                  ? detail
                  : Array.isArray(detail)
                    ? detail.map((x) => (typeof x === "string" ? x : x.msg || JSON.stringify(x))).join(" ")
                    : "Could not confirm subscription";
              window.alert(msg);
              return;
            }
            await refreshUser();
            window.alert("You're on Pro now. Thank you!");
          } catch (err) {
            console.error(err);
            window.alert("Could not confirm payment. Please try again or contact support.");
          }
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        const desc = response?.error?.description || "Payment failed";
        window.alert(desc);
      });
      rzp.open();
    } catch (e) {
      console.error(e);
      window.alert(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubscribeLoading(null);
    }
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col w-full overflow-x-hidden font-sans transition-colors duration-500 ${
        isDarkMode
          ? "bg-brand-night text-slate-100"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Background — same mood as login, calmer than before */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDarkMode
            ? "bg-[linear-gradient(145deg,#070b14_0%,#0c1528_45%,#0a1220_100%)]"
            : "bg-[linear-gradient(165deg,#f8fafc_0%,#ecfeff_40%,#f0fdfa_100%)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute -top-40 right-0 h-72 w-72 rounded-full blur-[100px] opacity-60 ${
          isDarkMode ? "bg-cyan-500/15" : "bg-teal-300/35"
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full blur-[90px] opacity-50 ${
          isDarkMode ? "bg-teal-600/10" : "bg-sky-200/40"
        }`}
      />

      <div
        className={`relative z-10 flex flex-col flex-1 pt-6 sm:pt-8 ${
          fullSolution ? "pb-40 sm:pb-36" : "pb-4 sm:pb-6"
        }`}
      >
        <div className={`${SHELL} flex flex-col gap-6 flex-1`}>
          {/* Top bar + hero — same width as everything below */}
          <header className="space-y-8">
            <div className={`${panel} px-4 py-3 sm:px-5 sm:py-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={`text-sm ${subtle}`}>
                  {user?.email ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        <span className="text-slate-500">Welcome </span>
                        <span className={isDarkMode ? "text-cyan-300 font-medium" : "text-teal-800 font-semibold"}>
                          {displayWelcomeName(user)}
                        </span>
                      </span>
                      {isPro && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isDarkMode
                              ? "border border-amber-400/50 bg-amber-500/15 text-amber-100"
                              : "border border-amber-500/60 bg-amber-100 text-amber-950"
                          }`}
                        >
                          Pro user
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="opacity-0 select-none" aria-hidden>
                      .
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Link
                    to="/home"
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      isDarkMode
                        ? "border border-slate-600/80 bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                        : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    Home
                  </Link>
                  {!isPro && (
                    <button
                      type="button"
                      onClick={scrollToSubscription}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        isDarkMode
                          ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                          : "border border-teal-600/40 bg-teal-50 text-teal-900 hover:bg-teal-100"
                      }`}
                    >
                      Subscription
                    </button>
                  )}
                  <ProfileAvatarButton
                    user={user}
                    isDarkMode={isDarkMode}
                    onClick={() => setShowProfile(true)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate("/", { replace: true });
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      isDarkMode
                        ? "border border-slate-600/80 bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                        : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    Sign out
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`rounded-xl px-3 py-2 text-lg leading-none transition-colors ${
                      isDarkMode
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        : "border border-slate-300 bg-slate-900 text-amber-200 hover:bg-slate-800"
                    }`}
                    title={isDarkMode ? "Light mode" : "Dark mode"}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center px-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${subtle} mb-2`}>
                Workspace
              </p>
              <h1
                className={`font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight ${
                  isDarkMode
                    ? "bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-transparent"
                    : "bg-gradient-to-r from-teal-800 via-cyan-800 to-slate-800 bg-clip-text text-transparent"
                }`}
              >
                VisualSolver AI
              </h1>
              <p className={`mt-3 text-sm sm:text-base max-w-lg mx-auto leading-relaxed ${subtle}`}>
                Draw or upload a problem. We read the sketch and return the solution.
              </p>
            </div>
          </header>

          {/* Tools */}
          <section className={`${panel} p-4 sm:p-5`}>
            <h2 className={`text-xs font-bold uppercase tracking-widest mb-4 ${subtle}`}>
              Brushes & import
            </h2>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {["black", "red", "blue", "green", "yellow", "purple"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color);
                      setIsEraser(false);
                      setSizePanelMode("brush");
                      setShowSizePanel(true);
                      requestAnimationFrame(() =>
                        document.getElementById("brush-size-slider")?.focus()
                      );
                    }}
                    className={`h-9 w-9 rounded-full border-2 transition-transform duration-200 hover:scale-105 ${
                      selectedColor === color && !isEraser
                        ? isDarkMode
                          ? "border-cyan-400 ring-2 ring-cyan-500/50 scale-110"
                          : "border-slate-900 ring-2 ring-teal-500/40 scale-110"
                        : isDarkMode
                          ? "border-slate-600 hover:border-slate-400"
                          : "border-slate-300 hover:border-slate-500"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsEraser((v) => {
                      const next = !v;
                      if (next) {
                        setSizePanelMode("eraser");
                        setShowSizePanel(true);
                        requestAnimationFrame(() =>
                          document.getElementById("eraser-size-slider")?.focus()
                        );
                      } else {
                        setShowSizePanel(false);
                      }
                      return next;
                    });
                  }}
                  className={`ml-1 rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                    isEraser
                      ? isDarkMode
                        ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                        : "border-amber-400 bg-amber-50 text-amber-900"
                      : isDarkMode
                        ? "border-slate-600 bg-slate-800/50 text-slate-200 hover:border-slate-500"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  Eraser
                </button>
              </div>

              {/* Pen / eraser size — only after clicking a color or Eraser */}
              {showSizePanel && (
                <div className="animate-modal-in space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-medium ${subtle}`}>
                      {sizePanelMode === "brush"
                        ? "Adjust pen thickness"
                        : "Adjust eraser thickness"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSizePanel(false)}
                      className={`text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors ${
                        isDarkMode
                          ? "text-slate-400 hover:text-white hover:bg-slate-800"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      Done
                    </button>
                  </div>

                  {sizePanelMode === "brush" && (
                    <div
                      className={`rounded-xl px-3 py-3 max-w-md mx-auto ${
                        isDarkMode
                          ? "bg-cyan-500/10 ring-2 ring-cyan-400/40"
                          : "bg-teal-50 ring-2 ring-teal-400/50"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isDarkMode ? "text-cyan-200/90" : "text-teal-800"
                          }`}
                        >
                          Pen size
                        </span>
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            isDarkMode ? "text-cyan-300" : "text-teal-700"
                          }`}
                        >
                          {brushSize}px
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] ${subtle}`}>Thin</span>
                        <input
                          id="brush-size-slider"
                          type="range"
                          min={1}
                          max={40}
                          step={1}
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className={`h-2 flex-1 cursor-pointer accent-teal-500 ${
                            isDarkMode ? "accent-cyan-400" : "accent-teal-600"
                          }`}
                          aria-label="Pen stroke width"
                        />
                        <span className={`text-[10px] ${subtle}`}>Thick</span>
                      </div>
                      <div className="mt-2 flex justify-center">
                        <div
                          className="rounded-full border-2 border-white/30 shadow-md"
                          style={{
                            width: Math.min(brushSize * 2, 72),
                            height: Math.min(brushSize * 2, 72),
                            backgroundColor: selectedColor,
                          }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}

                  {sizePanelMode === "eraser" && (
                    <div
                      className={`rounded-xl px-3 py-3 max-w-md mx-auto ${
                        isDarkMode
                          ? "bg-amber-500/10 ring-2 ring-amber-400/45"
                          : "bg-amber-50 ring-2 ring-amber-300/70"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isDarkMode ? "text-amber-200/90" : "text-amber-900"
                          }`}
                        >
                          Eraser size
                        </span>
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            isDarkMode ? "text-amber-200" : "text-amber-800"
                          }`}
                        >
                          {eraserSize}px
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] ${subtle}`}>Small</span>
                        <input
                          id="eraser-size-slider"
                          type="range"
                          min={4}
                          max={72}
                          step={1}
                          value={eraserSize}
                          onChange={(e) => setEraserSize(Number(e.target.value))}
                          className={`h-2 flex-1 cursor-pointer ${
                            isDarkMode ? "accent-amber-400" : "accent-amber-600"
                          }`}
                          aria-label="Eraser width"
                        />
                        <span className={`text-[10px] ${subtle}`}>Large</span>
                      </div>
                      <div className="mt-2 flex justify-center">
                        <div
                          className="rounded-full border-2 border-dashed border-slate-400/60 bg-white shadow-inner"
                          style={{
                            width: Math.min(eraserSize * 2, 96),
                            height: Math.min(eraserSize * 2, 96),
                          }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t ${
                  isDarkMode ? "border-slate-700/80" : "border-slate-200"
                }`}
              >
                <div className="relative w-full sm:flex-1 min-w-0">
                  {!isPro && (
                    <button
                      type="button"
                      className="absolute inset-0 z-10 rounded-lg cursor-not-allowed"
                      onClick={() => window.alert(MSG_UPGRADE_UPLOAD)}
                      aria-label="Upgrade required to upload images"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!isPro}
                    onChange={(e) => {
                      if (!isPro) {
                        e.target.value = "";
                        return;
                      }
                      setUploadedFile(e.target.files?.[0] ?? null);
                    }}
                    className={`w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold ${
                      isDarkMode
                        ? "text-slate-400 file:bg-slate-800 file:text-cyan-200"
                        : "text-slate-600 file:bg-teal-50 file:text-teal-900"
                    } ${!isPro ? "opacity-60" : ""}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={submitUploadedImage}
                  disabled={loading || !uploadedFile || !isPro}
                  className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-45 disabled:cursor-not-allowed ${
                    loading || !uploadedFile || !isPro
                      ? "bg-slate-500"
                      : "bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-95"
                  }`}
                >
                  {loading ? "…" : "Submit image"}
                </button>
              </div>
            </div>
          </section>

          {/* Canvas — full width of column, no 90vw */}
          <section className={`${panel} p-2 sm:p-3`}>
            <canvas
              ref={canvasRef}
              className={`block w-full h-[min(58vh,520px)] rounded-xl transition-colors ${
                isEraser ? "cursor-grab" : "cursor-crosshair"
              } ${isDarkMode ? "bg-slate-100" : "bg-white"}`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </section>

          {/* Actions */}
          <section className={`${panel} p-5 sm:p-6`}>
            <div
              className={`pb-6 mb-6 border-b border-dashed ${
                isDarkMode ? "border-slate-600/50" : "border-slate-300/80"
              }`}
            >
              <p className={`text-center text-xs font-bold uppercase tracking-widest mb-3 ${subtle}`}>
                Pro options
              </p>
              <div className="flex flex-row flex-wrap items-stretch justify-center gap-3">
                {/* Step-by-step — modern toggle row */}
                <label
                  className={`group flex min-w-[min(100%,17rem)] flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition-all duration-200 sm:min-w-0 sm:max-w-[calc(50%-0.375rem)] sm:flex-1 ${
                    showSteps && isPro
                      ? isDarkMode
                        ? "border-cyan-500/50 bg-cyan-500/10 ring-2 ring-cyan-400/25"
                        : "border-teal-400/70 bg-teal-50 ring-2 ring-teal-300/40"
                      : isDarkMode
                        ? "border-white/10 bg-slate-800/40 hover:border-slate-500/50 hover:bg-slate-800/70"
                        : "border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white"
                  } ${!isPro ? "cursor-not-allowed opacity-70" : "active:scale-[0.99]"}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isPro) {
                      window.alert(MSG_UPGRADE_STEPS);
                      return;
                    }
                    setShowSteps((v) => !v);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSteps}
                    readOnly
                    tabIndex={-1}
                    className="peer sr-only"
                    aria-label="Include step-by-step reasoning"
                  />
                  <div
                    className={`peer-checked:[&>div]:translate-x-[22px] relative flex h-8 w-[3.25rem] shrink-0 items-center rounded-full border p-0.5 shadow-inner transition-colors duration-200 ${
                      isDarkMode
                        ? "border-slate-500/60 bg-slate-900/80 peer-checked:border-teal-400/50 peer-checked:bg-gradient-to-r peer-checked:from-teal-500 peer-checked:to-emerald-500"
                        : "border-slate-300/80 bg-slate-200/90 peer-checked:border-teal-400/60 peer-checked:bg-gradient-to-r peer-checked:from-teal-500 peer-checked:to-emerald-500"
                    } ${!isPro ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`pointer-events-none h-6 w-6 rounded-full shadow-md ring-1 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
                        isDarkMode ? "bg-slate-100 ring-white/10" : "bg-white ring-black/5"
                      }`}
                    />
                  </div>
                  <span className="min-w-0 flex-1 text-left">
                    <span
                      className={`block text-sm font-semibold leading-tight ${
                        isDarkMode ? "text-slate-100" : "text-slate-800"
                      }`}
                    >
                      Step-by-step
                    </span>
                    <span className={`mt-0.5 block text-[11px] font-medium leading-snug ${subtle}`}>
                      Full reasoning in the solution
                    </span>
                    {!isPro && (
                      <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wider ${subtle}`}>
                        Pro
                      </span>
                    )}
                  </span>
                </label>

                {/* Visual diagram — modern toggle row */}
                <label
                  className={`group flex min-w-[min(100%,17rem)] flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition-all duration-200 sm:min-w-0 sm:max-w-[calc(50%-0.375rem)] sm:flex-1 ${
                    showVisualExplanation && isPro
                      ? isDarkMode
                        ? "border-violet-500/45 bg-violet-500/10 ring-2 ring-violet-400/25"
                        : "border-violet-400/70 bg-violet-50 ring-2 ring-violet-200/50"
                      : isDarkMode
                        ? "border-white/10 bg-slate-800/40 hover:border-slate-500/50 hover:bg-slate-800/70"
                        : "border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white"
                  } ${!isPro ? "cursor-not-allowed opacity-70" : "active:scale-[0.99]"}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isPro) {
                      window.alert(MSG_UPGRADE_VISUAL);
                      return;
                    }
                    setShowVisualExplanation((v) => !v);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showVisualExplanation}
                    readOnly
                    tabIndex={-1}
                    className="peer sr-only"
                    aria-label="Add visual explanation diagram"
                  />
                  <div
                    className={`peer-checked:[&>div]:translate-x-[22px] relative flex h-8 w-[3.25rem] shrink-0 items-center rounded-full border p-0.5 shadow-inner transition-colors duration-200 ${
                      isDarkMode
                        ? "border-slate-500/60 bg-slate-900/80 peer-checked:border-violet-400/50 peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-fuchsia-500"
                        : "border-slate-300/80 bg-slate-200/90 peer-checked:border-violet-400/60 peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-fuchsia-500"
                    } ${!isPro ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`pointer-events-none h-6 w-6 rounded-full shadow-md ring-1 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
                        isDarkMode ? "bg-slate-100 ring-white/10" : "bg-white ring-black/5"
                      }`}
                    />
                  </div>
                  <span className="min-w-0 flex-1 text-left">
                    <span
                      className={`block text-sm font-semibold leading-tight ${
                        isDarkMode ? "text-slate-100" : "text-slate-800"
                      }`}
                    >
                      Visual diagram
                    </span>
                    <span className={`mt-0.5 block text-[11px] font-medium leading-snug ${subtle}`}>
                      Flow-style explanation chart
                    </span>
                    {!isPro && (
                      <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wider ${subtle}`}>
                        Pro
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={getAnswer}
                disabled={loading}
                className={`min-h-[44px] flex-1 sm:flex-none rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity sm:min-w-[140px] ${
                  loading ? "bg-orange-500/70 cursor-wait" : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-95"
                }`}
              >
                {loading ? "Solving…" : "Get answer"}
              </button>
              <button
                type="button"
                onClick={downloadPDF}
                disabled={!fullSolution || loading}
                className={`min-h-[44px] flex-1 sm:flex-none rounded-xl border-2 px-6 py-3 text-sm font-semibold transition-colors sm:min-w-[140px] ${
                  !fullSolution || loading
                    ? isDarkMode
                      ? "border-slate-700 text-slate-500 cursor-not-allowed"
                      : "border-slate-200 text-slate-400 cursor-not-allowed"
                    : isDarkMode
                      ? "border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                      : "border-teal-600/40 text-teal-800 hover:bg-teal-50"
                }`}
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className={`min-h-[44px] flex-1 sm:flex-none rounded-xl px-6 py-3 text-sm font-semibold transition-colors sm:min-w-[120px] ${
                  isDarkMode
                    ? "bg-rose-950/50 text-rose-200 border border-rose-500/30 hover:bg-rose-950"
                    : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                }`}
              >
                Clear
              </button>
            </div>
          </section>

          {/* Subscription plans — hidden for Pro users */}
          {!isPro && (
          <section
            id="subscription-section"
            className={`${panel} scroll-mt-24 p-6 sm:p-8`}
          >
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2
                className={`font-display text-2xl sm:text-3xl font-bold ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Subscription
              </h2>
              <p className={`mt-2 text-sm sm:text-base ${subtle}`}>
                Pick a plan that fits how you solve. You can change or cancel anytime.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3 items-stretch">
              {/* Free */}
              <div
                className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${
                  isDarkMode
                    ? "border-slate-600/60 bg-slate-950/40"
                    : "border-slate-200 bg-white/80"
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-widest ${subtle}`}>Starter</p>
                <p className={`mt-3 font-display text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  Free
                </p>
                <p className={`mt-1 text-sm ${subtle}`}>For trying the solver</p>
                <ul className={`mt-5 space-y-2.5 text-sm flex-1 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> Up to 5 solves per day
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> Canvas draw &amp; upload
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> Final answer only
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => handlePlanClick("free")}
                  className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                    isDarkMode
                      ? "border border-slate-500 text-slate-200 hover:bg-slate-800"
                      : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  Current plan
                </button>
              </div>

              {/* Pro — ₹3,000/month */}
              <div
                className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 md:-translate-y-1 md:shadow-xl ${
                  isDarkMode
                    ? "border-cyan-400/50 bg-gradient-to-b from-cyan-950/80 to-slate-950 shadow-glow"
                    : "border-teal-400/60 bg-gradient-to-b from-teal-50 to-white shadow-lg ring-2 ring-teal-400/30"
                }`}
              >
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isDarkMode ? "bg-cyan-500 text-slate-950" : "bg-teal-600 text-white"
                  }`}
                >
                  Popular
                </span>
                <p className={`text-xs font-bold uppercase tracking-widest ${subtle}`}>Pro</p>
                <p className={`mt-3 font-display text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  ₹3,000
                  <span className={`text-base font-semibold ${subtle}`}>/month</span>
                </p>
                <p className={`mt-1 text-sm ${subtle}`}>Full power for students &amp; creators</p>
                <ul className={`mt-5 space-y-2.5 text-sm flex-1 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Unlimited solves
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Step-by-step reasoning
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> Visual explanation diagrams
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-400">✓</span> PDF export &amp; priority speed
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={subscribeLoading === "pro_monthly"}
                  onClick={() => handlePlanClick("pro_monthly")}
                  className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isDarkMode
                      ? "bg-gradient-to-r from-cyan-500 to-teal-400"
                      : "bg-gradient-to-r from-teal-600 to-cyan-600"
                  }`}
                >
                  {subscribeLoading === "pro_monthly" ? "Opening…" : "Subscribe"}
                </button>
              </div>

              {/* Annual — third card */}
              <div
                className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${
                  isDarkMode
                    ? "border-slate-600/60 bg-slate-950/40"
                    : "border-slate-200 bg-white/80"
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-widest ${subtle}`}>Pro Annual</p>
                <p className={`mt-3 font-display text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  ₹30,000
                  <span className={`text-base font-semibold ${subtle}`}>/year</span>
                </p>
                <p className={`mt-1 text-sm ${subtle}`}>Save vs monthly — ₹2,500/mo effective</p>
                <ul className={`mt-5 space-y-2.5 text-sm flex-1 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> Everything in Pro
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> 2 months free vs monthly
                  </li>
                  <li className="flex gap-2">
                    <span className="text-teal-500">✓</span> Best for regular use
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={subscribeLoading === "pro_annual"}
                  onClick={() => handlePlanClick("pro_annual")}
                  className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isDarkMode
                      ? "border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                      : "border border-amber-500/50 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  }`}
                >
                  {subscribeLoading === "pro_annual" ? "Opening…" : "Subscribe yearly"}
                </button>
              </div>
            </div>
          </section>
          )}
        </div>
      </div>

      <footer
        className={`relative z-10 ${SHELL} mt-auto pt-4 pb-6 text-center text-xs ${subtle}`}
      >
        © Made by L@lesh · VisualSolver AI
      </footer>

      <ProfilePanel
        open={showProfile}
        onClose={() => setShowProfile(false)}
        isDarkMode={isDarkMode}
        panelClass={panel}
      />

      {fullSolution ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center">
          <div className={`pointer-events-auto ${SHELL}`}>
            <SolutionVoicePlayer text={fullSolution} isDarkMode={isDarkMode} />
          </div>
        </div>
      ) : null}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div
            className={`${SHELL} max-h-[85vh] overflow-y-auto rounded-2xl border p-6 animate-modal-in ${
              isDarkMode
                ? "border-white/10 bg-slate-900 text-slate-100"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-2xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
                {stepsText && visualExplanation
                  ? "Solution & visual guide"
                  : visualExplanation
                    ? "Visual explanation"
                    : "Step-by-step solution"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`text-2xl leading-none w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isDarkMode
                    ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                ×
              </button>
            </div>
            {stepsText ? (
              <>
                <h3
                  className={`text-xs font-bold uppercase tracking-widest mb-2 ${subtle}`}
                >
                  Steps
                </h3>
                <div className="whitespace-pre-wrap text-left text-sm leading-relaxed opacity-95 mb-8">
                  {stepsText}
                </div>
              </>
            ) : null}
            {visualExplanation ? (
              <>
                <h3
                  className={`text-xs font-bold uppercase tracking-widest mb-1 ${subtle}`}
                >
                  Diagram
                </h3>
                <p className={`text-xs mb-2 ${subtle}`}>
                  Flow of the reasoning — generated from your solution.
                </p>
                <div
                  className={`rounded-xl border px-3 py-2 ${
                    isDarkMode ? "border-white/10 bg-slate-950/60" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <MermaidBlock chart={visualExplanation} isDark={isDarkMode} />
                </div>
              </>
            ) : null}
            {!stepsText && !visualExplanation ? (
              <p className={`text-sm ${subtle}`}>No extra details to show.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasPage;

