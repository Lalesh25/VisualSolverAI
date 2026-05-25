"""Gemini via HTTPS REST only — avoids grpc/cygrpc (often blocked by Windows App Control)."""

from __future__ import annotations

import base64
from typing import Any

import requests

GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _api_error_message(resp: requests.Response) -> str:
    """Return Google's single-line `error.message` only (never dump full JSON to the UI)."""
    try:
        data = resp.json()
        err = data.get("error") or {}
        msg = err.get("message")
        if isinstance(msg, str) and msg.strip():
            return msg.strip()
    except Exception:
        pass
    text = (resp.text or "").strip()
    if len(text) > 400:
        text = text[:400] + "…"
    return text or resp.reason or f"HTTP {resp.status_code}"


def _normalize_model_id(model: str) -> str:
    m = (model or "").strip()
    if m.startswith("models/"):
        m = m[len("models/") :]
    return m


def gemini_generate_vision(
    api_key: str,
    model: str,
    prompt: str,
    image_bytes: bytes,
    *,
    mime_type: str = "image/png",
    timeout: int = 120,
) -> str:
    """
    Multimodal generateContent. Returns combined plain text from the first candidate, or "".
    Raises RuntimeError on API error response.
    """
    model = _normalize_model_id(model)
    url = f"{GEMINI_REST_BASE}/models/{model}:generateContent"
    # Query `key=` matches Google's documented REST examples; header-only can fail some proxies.
    body: dict[str, Any] = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.standard_b64encode(image_bytes).decode("ascii"),
                        }
                    },
                ],
            }
        ],
    }
    resp = requests.post(
        url,
        params={"key": api_key},
        headers={"x-goog-api-key": api_key},
        json=body,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(_api_error_message(resp))

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""

    parts = (candidates[0].get("content") or {}).get("parts") or []
    chunks = [p.get("text", "") for p in parts if isinstance(p.get("text"), str)]
    return "".join(chunks).strip()


def gemini_generate_text(
    api_key: str,
    model: str,
    prompt: str,
    *,
    timeout: int = 90,
) -> str:
    """Text-only generateContent. Returns combined plain text from the first candidate, or ""."""
    model = _normalize_model_id(model)
    url = f"{GEMINI_REST_BASE}/models/{model}:generateContent"
    body: dict[str, Any] = {
        "contents": [
            {
                "parts": [{"text": prompt}],
            }
        ],
    }
    resp = requests.post(
        url,
        params={"key": api_key},
        headers={"x-goog-api-key": api_key},
        json=body,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(_api_error_message(resp))

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""

    parts = (candidates[0].get("content") or {}).get("parts") or []
    chunks = [p.get("text", "") for p in parts if isinstance(p.get("text"), str)]
    return "".join(chunks).strip()


def list_models_rest(api_key: str, timeout: int = 30) -> list[dict[str, Any]]:
    """Models that support generateContent (raw API dicts with at least 'name')."""
    url = f"{GEMINI_REST_BASE}/models"
    resp = requests.get(
        url,
        params={"key": api_key},
        headers={"x-goog-api-key": api_key},
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(_api_error_message(resp))
    out: list[dict[str, Any]] = []
    for m in resp.json().get("models") or []:
        methods = m.get("supportedGenerationMethods") or []
        if "generateContent" in methods:
            out.append(m)
    return out
