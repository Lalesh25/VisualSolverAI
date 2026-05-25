import os

import dotenv
from pymongo import MongoClient
from datetime import datetime
from dotenv import load_dotenv
import base64

# Load environment variables from .env file
load_dotenv()

# Get MongoDB URI from environment variable
MONGO_URI = os.getenv("MONGO_URI")

# MongoDB database and collection names
DATABASE_NAME = "visualsolver_db"
COLLECTION_NAME = "submissions"


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
        "user_id": user_id
    }
    
    # Insert into database
    result_inserted = collection.insert_one(submission)
    
    # Return the inserted document with its ID
    submission["_id"] = str(result_inserted.inserted_id)
    return submission


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

