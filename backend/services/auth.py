import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

from database import (
    User,
    UserCreate,
    create_user,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    update_user_fields,
    upsert_google_user,
    user_doc_to_public,
    verify_password,
)

load_dotenv(
    Path(__file__).resolve().parent.parent / ".env",
    override=True,
    encoding="utf-8",
)

logger = logging.getLogger(__name__)


def _normalized_google_client_id() -> str:
    """Strip whitespace, BOM, and optional surrounding quotes from .env values."""
    raw = os.getenv("GOOGLE_CLIENT_ID", "") or ""
    s = raw.strip().strip("\ufeff")
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        s = s[1:-1].strip()
    return s


def _verify_google_id_token_with_google(credential: str, client_id: str) -> dict[str, Any]:
    """
    Validate the Google ID token using Google's tokeninfo endpoint.
    More reliable across environments than local JWT verification alone, and returns
    clear audience mismatches when backend/frontend OAuth client IDs differ.
    """
    credential = (credential or "").strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    try:
        r = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=15,
        )
    except requests.RequestException as exc:
        logger.warning("Google tokeninfo request failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Could not reach Google to verify sign-in. Try again.",
        ) from exc

    if r.status_code != 200:
        logger.warning("tokeninfo HTTP %s: %s", r.status_code, (r.text or "")[:400])
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential")

    info = r.json()
    if info.get("error"):
        raise HTTPException(
            status_code=401,
            detail=info.get("error_description", "Invalid Google credential"),
        )

    aud = info.get("aud")
    if aud != client_id:
        logger.warning(
            "Google token aud=%r does not match configured GOOGLE_CLIENT_ID=%r",
            aud,
            client_id,
        )
        raise HTTPException(
            status_code=401,
            detail=(
                "Google client ID mismatch: set backend GOOGLE_CLIENT_ID to the exact same "
                "OAuth 2.0 Web client ID as VITE_GOOGLE_CLIENT_ID (Google Cloud Console → "
                "APIs & Services → Credentials)."
            ),
        )

    ev = info.get("email_verified")
    if isinstance(ev, str):
        email_verified = ev.lower() in ("true", "1", "yes")
    else:
        email_verified = bool(ev)

    return {
        "email": info.get("email"),
        "email_verified": email_verified,
        "sub": info.get("sub"),
        "name": (info.get("name") or ""),
    }

SECRET_KEY = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
optional_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleTokenRequest(BaseModel):
    credential: str


class UpdateProfileBody(BaseModel):
    name: Optional[str] = None


class UpdatePhotoBody(BaseModel):
    """Data URL (e.g. image/jpeg;base64,...) or null to remove."""
    photo_data_url: Optional[str] = None


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


MAX_PHOTO_DATA_URL_LEN = 600_000


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user_doc_to_public(user)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
) -> Optional[User]:
    """Same JWT as /auth/me, but missing/invalid token returns None instead of 401."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = get_user_by_id(user_id)
    if user is None:
        return None
    return user_doc_to_public(user)


@router.post("/register")
async def register(user_data: UserCreate):
    existing = get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(user_data)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["_id"], "email": user["email"]},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["_id"],
        "email": user["email"],
        "name": user.get("name", ""),
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["_id"]), "email": user["email"]},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
    }


@router.post("/google")
async def login_with_google(body: GoogleTokenRequest):
    client_id = _normalized_google_client_id()
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured (set GOOGLE_CLIENT_ID).",
        )

    idinfo = _verify_google_id_token_with_google(body.credential, client_id)

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google email not verified")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google token has no email")

    name = idinfo.get("name") or ""
    google_sub = str(idinfo.get("sub", ""))

    user = upsert_google_user(email=email, name=name, google_sub=google_sub)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["_id"], "email": user["email"]},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["_id"],
        "email": user["email"],
        "name": user.get("name", ""),
    }


@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me")
async def update_profile(
    body: UpdateProfileBody,
    current_user: User = Depends(get_current_user),
):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = (body.name or "").strip()[:200]
    if not updates:
        return current_user
    update_user_fields(current_user.id, updates)
    fresh = get_user_by_id(current_user.id)
    if not fresh:
        raise HTTPException(status_code=500, detail="User not found")
    return user_doc_to_public(fresh)


@router.patch("/me/photo")
async def update_profile_photo(
    body: UpdatePhotoBody,
    current_user: User = Depends(get_current_user),
):
    if body.photo_data_url is None:
        update_user_fields(current_user.id, {"profile_photo": None})
    else:
        raw = (body.photo_data_url or "").strip()
        if not raw.startswith("data:image/"):
            raise HTTPException(
                status_code=400,
                detail="Photo must be a data URL (data:image/png or jpeg;base64,...).",
            )
        if len(raw) > MAX_PHOTO_DATA_URL_LEN:
            raise HTTPException(status_code=400, detail="Image is too large. Use a smaller image.")
        update_user_fields(current_user.id, {"profile_photo": raw})
    fresh = get_user_by_id(current_user.id)
    if not fresh:
        raise HTTPException(status_code=500, detail="User not found")
    return user_doc_to_public(fresh)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordBody,
    current_user: User = Depends(get_current_user),
):
    if not current_user.password_user:
        raise HTTPException(
            status_code=400,
            detail="Password sign-in is not enabled for this account (e.g. Google sign-in only).",
        )
    doc = get_user_by_id(current_user.id)
    if not doc or not verify_password(body.current_password, doc["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    new_hash = hash_password(body.new_password)
    update_user_fields(current_user.id, {"hashed_password": new_hash})
    return {"ok": True}
