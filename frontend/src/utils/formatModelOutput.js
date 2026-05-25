/**
 * Normalizes LLM output for display: plain text, readable math symbols,
 * without Markdown fences, bold markers, or raw LaTeX delimiters.
 */
export function formatModelOutput(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.normalize("NFKC");
  s = s.replace(/[\u200b\u200c\u200d\ufeff]/g, "");
  s = s.replace(/```[\w]*\r?\n?/g, "");
  s = s.replace(/```/g, "");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\$\$([^$]+)\$\$/g, "$1");
  s = s.replace(/\$([^$\n]+)\$/g, "$1");
  s = s.replace(/\\\(|\\\)/g, "");
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  s = s.replace(/\\text\{([^}]+)\}/g, "$1");
  const latexSym = [
    [/\\times/g, "×"],
    [/\\cdot/g, "·"],
    [/\\div/g, "÷"],
    [/\\pm/g, "±"],
    [/\\mp/g, "∓"],
    [/\\leq/g, "≤"],
    [/\\geq/g, "≥"],
    [/\\neq/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\infty/g, "∞"],
    [/\\pi/g, "π"],
    [/\\theta/g, "θ"],
    [/\\alpha/g, "α"],
    [/\\beta/g, "β"],
    [/\\sum/g, "Σ"],
    [/\\,/g, " "],
  ];
  for (const [re, ch] of latexSym) s = s.replace(re, ch);
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\[ ,;]/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]+$/gm, "");
  return s.trim();
}

/**
 * Wraps text to fit canvas width; returns lines for fillText.
 */
export function wrapTextLines(ctx, text, maxWidth) {
  if (!text) return [""];
  const lines = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxWidth) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length ? lines : [""];
}
