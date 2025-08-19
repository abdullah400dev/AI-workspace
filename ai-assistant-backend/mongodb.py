import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection string from environment variables
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ai-workspace-chat")
DB_NAME = os.getenv("MONGODB_DB_NAME", "ai-workspace")

# Create a MongoDB client
client: AsyncIOMotorClient = None

def get_mongo_client() -> AsyncIOMotorClient:
    """Get the MongoDB client instance"""
    global client
    if client is None:
        client = AsyncIOMotorClient(MONGODB_URI)
    return client

async def get_database(db_name: str = None) -> AsyncIOMotorDatabase:
    """Get a database instance"""
    db_name = db_name or DB_NAME
    return get_mongo_client()[db_name]

# For backward compatibility
client = get_mongo_client()
db = client[DB_NAME]
messages_collection = db.messages

# Test the connection
async def test_connection():
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

# Context manager for database sessions
@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """Async context manager for database sessions"""
    try:
        db = await get_database()
        yield db
    except Exception as e:
        print(f"Database session error: {e}")
        raise
