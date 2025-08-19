from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.query import router as query_router
from routes.delete import router as delete_router
from routes.emails import router as email_router
from routes.email_search import router as email_search_router
from routes.debug_chroma import router as debug_chroma_router
from routes import google_docs
from routes.slack import router as slack_router
from routes.chat import init_chat_routes
from routes.activity import router as activity_router
from mongodb import client as mongodb_client, test_connection
import asyncio
import os
from dotenv import load_dotenv
from typing import List
from pydantic import BaseModel
from datetime import datetime

# Load environment variables from .env file
load_dotenv(override=True)

# Debug: Print environment variables
print("Environment variables from .env:")
for var in ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_SIGNING_SECRET", "SLACK_REDIRECT_URI"]:
    print(f"{var}: {'Set' if os.getenv(var) else 'Not set'}")

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload_router, prefix="")  # Handles /upload
app.include_router(query_router, prefix="/api")  # Handles /api/search and /api/documents
app.include_router(delete_router, prefix="/api")  # Handles /api/documents/{document_id}
app.include_router(email_router, prefix="/api")  # Handles /api/emails/*
app.include_router(email_search_router, prefix="/api")  # Handles /api/search/emails
app.include_router(debug_chroma_router, prefix="/api")  # Handles /api/debug/chroma/*
app.include_router(google_docs.router, prefix="")  # Handles /api/google-docs/import and /api/google-docs/list
app.include_router(slack_router, prefix="/api")  # Handles /api/slack/*
app.include_router(activity_router, prefix="")  # Handles /api/activity

# Initialize chat routes with MongoDB
init_chat_routes(app, mongodb_client.get_database())


activity_log: List[dict] = []

class Activity(BaseModel):
    page: str  # e.g., "Document", "Email", "Chat"

@app.post("/api/activity")
def log_activity(activity: Activity):
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "page": activity.page
    }
    activity_log.append(entry)
    return {"message": "Activity logged", "activity": entry}

@app.get("/api/activity")
def get_activities():
    return activity_log


# Test MongoDB connection on startup
@app.on_event("startup")
async def startup_db_client():
    # Test MongoDB connection
    connected = await test_connection()
    if not connected:
        raise Exception("Failed to connect to MongoDB")
    
    # Create upload directories if they don't exist
    os.makedirs("uploaded_docs", exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
