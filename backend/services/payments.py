import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Type

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import User, get_user_by_id, set_user_pro, update_user_fields
from services.auth import get_current_user

load_dotenv(
    Path(__file__).resolve().parent.parent / ".env",
    override=True,
    encoding="utf-8",
)

router = APIRouter(prefix="/payments", tags=["payments"])

PLAN_MONTHLY = "pro_monthly"
PLAN_ANNUAL = "pro_annual"

_razorpay_loaded: Optional[tuple[Any, tuple[Type[BaseException], ...]]] = None


def _import_razorpay():
    """Load razorpay on first use (avoids pkg_resources crash at app import on Render)."""
    global _razorpay_loaded
    if _razorpay_loaded is not None:
        return _razorpay_loaded

    try:
        import pkg_resources  # noqa: F401
    except ModuleNotFoundError:
        import setuptools  # noqa: F401

    from razorpay import Client
    from razorpay.errors import (
        BadRequestError,
        GatewayError,
        ServerError,
        SignatureVerificationError,
    )

    _razorpay_loaded = (
        Client,
        (BadRequestError, GatewayError, ServerError, SignatureVerificationError),
    )
    return _razorpay_loaded


def _strip(val: str | None) -> str:
    return (val or "").strip().strip("\ufeff")


def _get_razorpay():
    Client, _ = _import_razorpay()
    key_id = _strip(os.getenv("RAZORPAY_KEY_ID"))
    key_secret = _strip(os.getenv("RAZORPAY_KEY_SECRET"))
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail="Payments are not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).",
        )
    return Client(auth=(key_id, key_secret)), key_id


def _plan_id_for_slug(plan: str) -> str:
    if plan == PLAN_MONTHLY:
        pid = _strip(os.getenv("RAZORPAY_PLAN_PRO_MONTHLY"))
    elif plan == PLAN_ANNUAL:
        pid = _strip(os.getenv("RAZORPAY_PLAN_PRO_ANNUAL"))
    else:
        raise HTTPException(status_code=400, detail="Invalid plan.")
    if not pid:
        raise HTTPException(
            status_code=503,
            detail=f"Razorpay plan ID not configured for this tier ({plan}).",
        )
    return pid


class CreateSubscriptionBody(BaseModel):
    plan: str = Field(..., description="pro_monthly or pro_annual")


@router.post("/razorpay/create-subscription")
async def razorpay_create_subscription(
    body: CreateSubscriptionBody,
    current_user: User = Depends(get_current_user),
):
    if body.plan not in (PLAN_MONTHLY, PLAN_ANNUAL):
        raise HTTPException(status_code=400, detail="Invalid plan.")

    _, razorpay_errors = _import_razorpay()
    BadRequestError, GatewayError, ServerError, _ = razorpay_errors

    client, key_id = _get_razorpay()
    plan_id = _plan_id_for_slug(body.plan)
    total_count = 120 if body.plan == PLAN_MONTHLY else 30

    try:
        subscription = client.subscription.create(
            {
                "plan_id": plan_id,
                "total_count": total_count,
                "quantity": 1,
                "customer_notify": 1,
                "notes": {"user_id": str(current_user.id), "plan": body.plan},
            }
        )
    except BadRequestError as e:
        raise HTTPException(status_code=400, detail=str(e) or "Could not create subscription") from e
    except (GatewayError, ServerError) as e:
        raise HTTPException(
            status_code=502,
            detail=str(e) or "Razorpay error. Try again shortly.",
        ) from e

    sub_id = subscription.get("id")
    if not sub_id:
        raise HTTPException(status_code=502, detail="Invalid response from Razorpay.")

    update_user_fields(
        current_user.id,
        {"pending_razorpay_subscription_id": sub_id},
    )

    return {"subscription_id": sub_id, "key_id": key_id}


class ConfirmSubscriptionBody(BaseModel):
    razorpay_subscription_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/razorpay/confirm-subscription")
async def razorpay_confirm_subscription(
    body: ConfirmSubscriptionBody,
    current_user: User = Depends(get_current_user),
):
    _, razorpay_errors = _import_razorpay()
    BadRequestError, GatewayError, ServerError, SignatureVerificationError = razorpay_errors

    client, _ = _get_razorpay()
    params = {
        "razorpay_subscription_id": body.razorpay_subscription_id.strip(),
        "razorpay_payment_id": body.razorpay_payment_id.strip(),
        "razorpay_signature": body.razorpay_signature.strip(),
    }
    try:
        client.utility.verify_subscription_payment_signature(params)
    except SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid payment signature.") from e

    try:
        sub = client.subscription.fetch(params["razorpay_subscription_id"])
    except (BadRequestError, GatewayError, ServerError) as e:
        raise HTTPException(
            status_code=400,
            detail=str(e) or "Could not load subscription.",
        ) from e

    doc = get_user_by_id(current_user.id) or {}
    pending = doc.get("pending_razorpay_subscription_id")
    notes_uid = str((sub.get("notes") or {}).get("user_id", ""))
    pending_ok = pending == params["razorpay_subscription_id"]
    notes_ok = notes_uid == str(current_user.id)
    if not pending_ok and not notes_ok:
        raise HTTPException(
            status_code=403,
            detail="This subscription is not linked to your account. Start checkout again from this device.",
        )

    period_end: Optional[datetime] = None
    raw_end = sub.get("current_end")
    if raw_end is not None:
        try:
            period_end = datetime.utcfromtimestamp(int(raw_end))
        except (TypeError, ValueError, OSError):
            period_end = None

    plan_slug = (sub.get("notes") or {}).get("plan")
    if isinstance(plan_slug, str) and plan_slug.strip():
        plan_slug = plan_slug.strip()
    else:
        plan_slug = None

    set_user_pro(
        current_user.id,
        is_pro=True,
        razorpay_subscription_id=params["razorpay_subscription_id"],
        subscription_current_period_end=period_end,
        subscription_plan=plan_slug,
    )
    update_user_fields(current_user.id, {"pending_razorpay_subscription_id": None})
    return {"ok": True}
