"""
Verify that Google accepts your GEMINI_API_KEY (same path as the app).

From the backend folder run:
  py verify_gemini_key.py
"""

from pathlib import Path

from dotenv import load_dotenv

from env_utils import normalize_api_key
from services.gemini_rest import list_models_rest


def main() -> None:
    load_dotenv(
        Path(__file__).resolve().parent / ".env",
        override=True,
        encoding="utf-8",
    )
    import os

    raw = os.getenv("GEMINI_API_KEY")
    key = normalize_api_key(raw)
    if not key:
        print("FAIL: GEMINI_API_KEY is missing or empty in backend/.env")
        raise SystemExit(1)

    print(f"Key length: {len(key)} chars (Google keys are usually 39)")
    print(f"Starts with 'AIza': {str(key).startswith('AIza')}")
    print("Calling generativelanguage.googleapis.com (list models)...")

    try:
        models = list_models_rest(key)
    except Exception as e:
        print("FAIL:", e)
        print(
            "\nIf you see API_KEY_INVALID:\n"
            "  • Create a NEW key at https://aistudio.google.com/apikey\n"
            "  • Google Cloud → APIs & Services → Credentials → your key:\n"
            "      - API restrictions: include 'Generative Language API' (or don't restrict)\n"
            "      - Application restrictions: 'None' works for local dev (not HTTP referrers)\n"
            "  • Remove GEMINI_API_KEY from Windows env vars if it overrides .env\n"
        )
        raise SystemExit(1) from e

    print(f"OK — Google accepted the key ({len(models)} models with generateContent).")
    for m in models[:8]:
        print(" ", m.get("name", ""))


if __name__ == "__main__":
    main()
