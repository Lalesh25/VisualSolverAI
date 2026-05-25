import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from passlib.context import CryptContext

from env_utils import normalize_api_key, normalize_env_value
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient

load_dotenv(
    Path(__file__).resolve().parent / ".env",
    override=True,
    encoding="utf-8",
)

MONGO_URI = normalize_env_value(os.getenv("MONGO_URI"))
GEMINI_API_KEY = normalize_api_key(os.getenv("GEMINI_API_KEY"))

DATABASE_NAME = "visualsolver_db"
COLLECTION_NAME = "submissions"
USERS_COLLECTION = "users"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    name: str = ""


class User(BaseModel):
    id: str
    email: str
    name: str = ""
    is_pro: bool = False
    profile_photo: Optional[str] = None
    password_user: bool = True
    subscription_current_period_end: Optional[datetime] = Field(
        default=None,
        description="Razorpay current period end (UTC), when known.",
    )
    subscription_plan: Optional[str] = Field(
        default=None,
        description="pro_monthly or pro_annual from checkout.",
    )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _users_collection():
    db = get_database()
    return db[USERS_COLLECTION]


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    coll = _users_collection()
    return coll.find_one({"email": email.strip().lower()})


def get_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None
    coll = _users_collection()
    return coll.find_one({"_id": oid})


def create_user(user_data: UserCreate) -> dict[str, Any]:
    coll = _users_collection()
    doc = {
        "email": user_data.email.strip().lower(),
        "hashed_password": hash_password(user_data.password),
        "name": (user_data.name or "").strip(),
        "password_user": True,
    }
    result = coll.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def upsert_google_user(email: str, name: str, google_sub: str) -> dict[str, Any]:
    """
    Find or create a user for Google Sign-In. Password-based accounts with the same
    email can be signed in via Google after Google verifies the email.
    """
    coll = _users_collection()
    email_norm = email.strip().lower()
    existing = coll.find_one({"email": email_norm})
    if existing:
        updates: dict[str, Any] = {}
        nm = (name or "").strip()
        if nm and not (existing.get("name") or "").strip():
            updates["name"] = nm
        if google_sub and existing.get("google_sub") != google_sub:
            updates["google_sub"] = google_sub
        if updates:
            coll.update_one({"_id": existing["_id"]}, {"$set": updates})
        fresh = coll.find_one({"_id": existing["_id"]})
        fresh["_id"] = str(fresh["_id"])
        return fresh
    doc = {
        "email": email_norm,
        "hashed_password": hash_password(secrets.token_urlsafe(48)),
        "name": (name or "").strip(),
        "google_sub": google_sub,
        "password_user": False,
    }
    result = coll.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def user_doc_to_public(doc: dict[str, Any]) -> User:
    return User(
        id=str(doc["_id"]) if isinstance(doc["_id"], ObjectId) else doc["_id"],
        email=doc["email"],
        name=doc.get("name") or "",
        is_pro=bool(doc.get("is_pro")),
        profile_photo=doc.get("profile_photo"),
        password_user=bool(doc.get("password_user", True)),
        subscription_current_period_end=doc.get("subscription_current_period_end"),
        subscription_plan=doc.get("subscription_plan"),
    )


def update_user_fields(user_id: str, fields: dict[str, Any]) -> bool:
    coll = _users_collection()
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return False
    if not fields:
        return True
    result = coll.update_one({"_id": oid}, {"$set": fields})
    return result.matched_count > 0


def set_user_pro(
    user_id: str,
    *,
    is_pro: bool,
    razorpay_subscription_id: Optional[str] = None,
    subscription_current_period_end: Optional[datetime] = None,
    subscription_plan: Optional[str] = None,
) -> None:
    coll = _users_collection()
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return
    update: dict[str, Any] = {
        "is_pro": is_pro,
        "subscription_updated_at": datetime.utcnow(),
    }
    if razorpay_subscription_id:
        update["razorpay_subscription_id"] = razorpay_subscription_id
    if subscription_current_period_end is not None:
        update["subscription_current_period_end"] = subscription_current_period_end
    if subscription_plan is not None:
        update["subscription_plan"] = subscription_plan
    coll.update_one({"_id": oid}, {"$set": update})


def get_database():
    """
    Connect to MongoDB and return the database instance.
    """
    if not MONGO_URI:
        raise ValueError("MONGO_URI not found in environment variables. Please add it to .env file.")

    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    return db


def save_submission(image_data: str, result: str, show_steps: bool = False, user_id: str = None) -> dict:
    """
    Save a submission to MongoDB.
    
    Args:
        image_data: Base64 encoded image data
        result: The solution/result from the AI
        show_steps: Whether step-by-step solution was requested
        user_id: Optional user identifier
    
    Returns:
        dict: The inserted document with its ID
    """
    db = get_database()
    collection = db[COLLECTION_NAME]
    
    # Create submission document
    submission = {
        "timestamp": datetime.utcnow(),
        "image": image_data,  # Base64 encoded image
        "result": result,
        "show_steps": show_steps,
        "user_id": user_id,
    }
    
    # Insert into database
    result_inserted = collection.insert_one(submission)
    
    # Return the inserted document with its ID
    submission["_id"] = str(result_inserted.inserted_id)
    return submission


def list_submissions_for_user(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Recent submissions for a user (excludes large image blob)."""
    db = get_database()
    collection = db[COLLECTION_NAME]
    cursor = (
        collection.find({"user_id": user_id}, {"image": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    out: list[dict[str, Any]] = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("timestamp") and hasattr(doc["timestamp"], "isoformat"):
            doc["timestamp"] = doc["timestamp"].isoformat() + "Z"
        out.append(doc)
    return out


def get_submission_for_user(submission_id: str, user_id: str) -> Optional[dict[str, Any]]:
    """Full submission including image; only if it belongs to user_id."""
    try:
        oid = ObjectId(submission_id)
    except (InvalidId, TypeError):
        return None
    db = get_database()
    collection = db[COLLECTION_NAME]
    doc = collection.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    if doc.get("timestamp") and hasattr(doc["timestamp"], "isoformat"):
        doc["timestamp"] = doc["timestamp"].isoformat() + "Z"
    return doc


def get_submissions(limit: int = 100) -> list:
    """
    Retrieve recent submissions from MongoDB.
    
    Args:
        limit: Maximum number of submissions to retrieve
    
    Returns:
        list: List of submission documents
    """
    db = get_database()
    collection = db[COLLECTION_NAME]
    
    submissions = list(collection.find().sort("timestamp", -1).limit(limit))
    
    # Convert ObjectId to string for JSON serialization
    for sub in submissions:
        sub["_id"] = str(sub["_id"])
    
    return submissions

