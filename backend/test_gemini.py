"""Quick check: REST list models (no google-generativeai / grpc)."""

import os
from pathlib import Path

from dotenv import load_dotenv

from env_utils import normalize_api_key
from services.gemini_rest import list_models_rest

load_dotenv(
    Path(__file__).resolve().parent / ".env",
    override=True,
    encoding="utf-8",
)
key = normalize_api_key(os.getenv("GEMINI_API_KEY"))
if not key:
    raise SystemExit("Set GEMINI_API_KEY in backend/.env")

n = len(list_models_rest(key))
print(f"OK — Gemini REST reachable, {n} generateContent-capable models.")
