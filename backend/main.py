from pathlib import Path

from dotenv import load_dotenv

# Load .env before importing database or any module that reads os.environ.
load_dotenv(
    Path(__file__).resolve().parent / ".env",
    override=True,
    encoding="utf-8",
)

import base64
import io
import os
import tempfile
from typing import Optional

from env_utils import normalize_api_key, normalize_env_value
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fpdf import FPDF

from database import User, save_submission
from services.auth import get_optional_user, router as auth_router
from services.gemini_rest import gemini_generate_text, gemini_generate_vision
from services.history import router as history_router
from services.payments import router as payments_router
from services.model_output import clean_model_text, extract_visual_mermaid

API_KEY = normalize_api_key(os.getenv("GEMINI_API_KEY"))

# REST-only Gemini (no google-generativeai / grpc — works when cygrpc is blocked by App Control).
# Default matches current AI Studio model list; override with GEMINI_VISION_MODEL=... in .env if needed.
GEMINI_VISION_MODEL = normalize_env_value(os.getenv("GEMINI_VISION_MODEL")) or "gemini-2.0-flash"

app = FastAPI(
    title="VisualSolver AI (Gemini 1.5 Flash)",
    description="Canvas-based image OCR + reasoning using Gemini"
)

# --- Allow frontend requests ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(history_router)
app.include_router(payments_router)


@app.get("/")
def root():
    mongo_ok = bool(normalize_env_value(os.getenv("MONGO_URI")))
    return {
        "message": "VisualSolver AI backend running",
        "gemini_configured": bool(API_KEY),
        "mongo_configured": mongo_ok,
    }


def _require_gemini_key():
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not set. Add it in Render → Environment "
                "(or backend/.env for local dev), then redeploy."
            ),
        )


@app.post("/download_pdf")
async def download_pdf(
    solution: str = Form(...),
    filename: str = Form("solution")
):
    """
    Generate and download a PDF containing the AI solution.
    """
    try:
        # Create PDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        
        # Add title
        pdf.set_font("Arial", "B", 16)
        pdf.cell(200, 10, txt="VisualSolver AI - Solution", ln=True, align="C")
        pdf.ln(10)
        
        # Add solution content
        pdf.set_font("Arial", size=12)
        
        # Split solution into lines and add to PDF
        for line in solution.split("\n"):
            pdf.multi_cell(0, 10, txt=line)
        
        # Output PDF to bytes
        pdf_output = pdf.output(dest="S").encode("latin1", "ignore")
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}.pdf"}
        )
    except Exception as e:
        return {"error": str(e)}


@app.post("/process_image")
async def process_image(
    file: UploadFile = File(...),
    show_steps: bool = Form(False),
    visual_explanation: bool = Form(False),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Process the uploaded canvas image using Gemini.
    show_steps -> if true, returns detailed reasoning;
                   else returns final concise answer.
    visual_explanation -> if true (Pro), second model pass returns Mermaid diagram text.
    """
    try:
        _require_gemini_key()
        if visual_explanation and (not current_user or not current_user.is_pro):
            raise HTTPException(
                status_code=403,
                detail="Upgrade to Pro first for visual explanations.",
            )
        # Save uploaded image temporarily
        temp_path = tempfile.mktemp(suffix=".png")
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        # --- Smart prompt ---
        prompt = (
            "You are an expert AI that interprets handwritten or drawn math/science problems from images. "
            "Extract the problem and solve it clearly.\n"
            "Write in plain text only: no Markdown (no **, #, ```, or `), no LaTeX (no $ or \\frac). "
            "Use normal line breaks and numbered steps when explaining. "
            "For math, use Unicode symbols where helpful (× ÷ ≤ ≥ ² ³ √ π) or simple parentheses.\n"
            + (
                "Provide detailed step-by-step reasoning and the final answer. "
                "Label steps as Step 1, Step 2, etc."
                if show_steps
                else "Only return the final numeric or textual answer concisely."
            )
        )

        with open(temp_path, "rb") as img_f:
            image_bytes = img_f.read()

        mime_type = (file.content_type or "image/png").split(";")[0].strip() or "image/png"
        if not mime_type.startswith("image/"):
            mime_type = "image/png"

        try:
            raw_text = gemini_generate_vision(
                API_KEY,
                GEMINI_VISION_MODEL,
                prompt,
                image_bytes,
                mime_type=mime_type,
            )
        except Exception as api_exc:
            err = str(api_exc)
            low = err.lower()
            if "expired" in low or "renew the api key" in low:
                return {
                    "error": (
                        "Gemini API key expired. Create a new key at https://aistudio.google.com/apikey, "
                        "put it in backend/.env as GEMINI_API_KEY=your_new_key, save and restart the backend (uvicorn)."
                    )
                }
            if "api_key" in low or "api key" in low:
                err += (
                    " — Also check: backend/.env has no spaces around =; remove duplicate GEMINI_API_KEY from "
                    "Windows environment variables; in Google Cloud → Credentials, allow Generative Language API "
                    "and use Application restrictions = None for local dev."
                )
            return {"error": f"Gemini API error: {err}"}
        if not raw_text:
            result_text = "⚠️ No readable text found in image."
        else:
            result_text = clean_model_text(raw_text)

        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Save submission to MongoDB (linked to account when Authorization Bearer is sent)
        try:
            uid = current_user.id if current_user else None
            saved_record = save_submission(
                image_data=image_base64,
                result=result_text,
                show_steps=show_steps,
                user_id=uid,
            )
            print(f"✅ Submission saved to MongoDB: {saved_record['_id']}")
        except Exception as db_error:
            print(f"⚠️ MongoDB save error: {db_error}")

        # Cleanup
        os.remove(temp_path)

        visual_mermaid: str | None = None
        if visual_explanation and result_text and not result_text.startswith("⚠️"):
            diagram_prompt = (
                "You turn a math or science solution into ONE simple Mermaid diagram for students.\n"
                "Prefer flowchart TD showing the logical flow (given → steps → answer), or graph LR for "
                "relationships. Keep node labels short (under 35 characters), plain text, ASCII only.\n"
                "Do not use Markdown or LaTeX. Output ONLY these delimiters and the diagram between them:\n"
                "<<<VISUAL_MERMAID_START>>>\n"
                "(your mermaid code here, starting with a line like flowchart TD or graph LR)\n"
                "<<<VISUAL_MERMAID_END>>>\n"
                "Solution to visualize:\n"
            ) + result_text[:14000]

            try:
                raw_diagram = gemini_generate_text(
                    API_KEY,
                    GEMINI_VISION_MODEL,
                    diagram_prompt,
                    timeout=90,
                )
                visual_mermaid = extract_visual_mermaid(raw_diagram)
            except Exception as vis_exc:
                print(f"⚠️ Visual explanation error: {vis_exc}")

        out: dict = {"text": result_text, "solution": result_text}
        if visual_mermaid:
            out["visual_explanation"] = visual_mermaid
        return out

    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}

