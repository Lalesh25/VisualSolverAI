import { useEffect, useRef } from "react";
// Prebundled entry avoids Vite/Rollup resolution issues with mermaid.core.mjs + lodash-es paths.
import mermaid from "mermaid/dist/mermaid.esm.min.mjs";

/**
 * Renders a Mermaid diagram string (e.g. flowchart TD …) into SVG.
 */
export default function MermaidBlock({ chart, isDark }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !chart?.trim()) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "strict",
      fontFamily: '"Source Sans 3", system-ui, sans-serif',
    });

    const id = `mmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    el.innerHTML = "";
    let cancelled = false;

    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (!cancelled && ref.current === el) el.innerHTML = svg;
      })
      .catch(() => {
        if (!cancelled && ref.current === el) {
          el.innerHTML = "";
          const pre = document.createElement("pre");
          pre.className =
            "text-xs font-mono whitespace-pre-wrap break-all opacity-90 p-3 rounded-xl bg-slate-800/40";
          pre.textContent = chart;
          el.appendChild(pre);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, isDark]);

  if (!chart?.trim()) return null;

  return (
    <div
      ref={ref}
      className="visual-mermaid flex justify-center overflow-x-auto py-4 [&_svg]:max-w-full [&_svg]:h-auto"
      aria-label="Visual explanation diagram"
    />
  );
}
