"""Normalize values from .env (whitespace around =, BOM, quoted strings)."""

from __future__ import annotations


def normalize_env_value(val: str | None) -> str | None:
    if val is None:
        return None
    s = str(val).strip().strip("\ufeff")
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        s = s[1:-1].strip()
    return s if s else None


def normalize_api_key(val: str | None) -> str | None:
    """
    Google API keys must be a single continuous token. Copy/paste from email or
    Windows .env sometimes injects spaces, CR, or line breaks.
    """
    s = normalize_env_value(val)
    if not s:
        return None
    # Remove ALL whitespace (including accidental \r\n inside the key)
    s = "".join(s.split())
    return s if s else None
