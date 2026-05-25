"""Normalize LLM text for plain, readable display (no Markdown/LaTeX noise)."""

import re
import unicodedata


def clean_model_text(s: str) -> str:
    if not s:
        return s
    t = unicodedata.normalize("NFKC", s)
    t = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", t)
    t = re.sub(r"```[\w]*\r?\n?", "", t)
    t = t.replace("```", "")
    t = re.sub(r"^#{1,6}\s+", "", t, flags=re.MULTILINE)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\$\$([^$]+)\$\$", r"\1", t)
    t = re.sub(r"\$([^$\n]+)\$", r"\1", t)
    t = re.sub(r"\\\(|\\\)", "", t)
    t = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", r"(\1)/(\2)", t)
    t = re.sub(r"\\sqrt\{([^}]+)\}", r"√(\1)", t)
    t = re.sub(r"\\text\{([^}]+)\}", r"\1", t)
    latex_sym = (
        (r"\\times", "×"),
        (r"\\cdot", "·"),
        (r"\\div", "÷"),
        (r"\\pm", "±"),
        (r"\\mp", "∓"),
        (r"\\leq", "≤"),
        (r"\\geq", "≥"),
        (r"\\neq", "≠"),
        (r"\\approx", "≈"),
        (r"\\infty", "∞"),
        (r"\\pi", "π"),
        (r"\\theta", "θ"),
        (r"\\alpha", "α"),
        (r"\\beta", "β"),
        (r"\\sum", "Σ"),
        (r"\\,", " "),
    )
    for pat, rep in latex_sym:
        t = re.sub(pat, rep, t)
    t = re.sub(r"\\left|\\right", "", t)
    t = re.sub(r"\\[ ,;]", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]+$", "", t, flags=re.MULTILINE)
    return t.strip()


VISUAL_MERMAID_START = "<<<VISUAL_MERMAID_START>>>"
VISUAL_MERMAID_END = "<<<VISUAL_MERMAID_END>>>"


def extract_visual_mermaid(s: str) -> str | None:
    """Pull Mermaid source from a model response delimited by VISUAL_MERMAID_* markers."""
    if not s:
        return None
    i = s.find(VISUAL_MERMAID_START)
    j = s.find(VISUAL_MERMAID_END)
    if i < 0 or j < 0 or j <= i:
        return None
    inner = s[i + len(VISUAL_MERMAID_START) : j].strip()
    inner = re.sub(r"^```mermaid?\s*", "", inner, flags=re.IGNORECASE)
    inner = re.sub(r"\s*```\s*$", "", inner)
    inner = inner.strip()
    return inner or None
