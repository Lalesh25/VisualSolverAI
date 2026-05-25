"""List models available to your API key (HTTPS REST — no grpc)."""

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
api_key = normalize_api_key(os.getenv("GEMINI_API_KEY"))
if not api_key:
    raise SystemExit("Set GEMINI_API_KEY in backend/.env")

print("\nAvailable Gemini models (generateContent) for this API key:\n")
for m in list_models_rest(api_key):
    print("-", m.get("name", ""))
