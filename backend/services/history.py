from fastapi import APIRouter, Depends, HTTPException

from database import User, get_submission_for_user, list_submissions_for_user
from services.auth import get_current_user

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/submissions")
async def get_my_submissions(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    if limit < 1 or limit > 100:
        limit = 50
    return {"items": list_submissions_for_user(current_user.id, limit=limit)}


@router.get("/submissions/{submission_id}")
async def get_one_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
):
    doc = get_submission_for_user(submission_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found")
    raw_b64 = doc.get("image") or ""
    if raw_b64 and not raw_b64.startswith("data:"):
        doc["image_data_url"] = f"data:image/png;base64,{raw_b64}"
    else:
        doc["image_data_url"] = raw_b64 or None
    del doc["image"]
    return doc
