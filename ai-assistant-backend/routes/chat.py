from fastapi import APIRouter, HTTPException
from typing import List
from models.chat_message import ChatMessage
from bson import ObjectId
from datetime import datetime
from pymongo import ReturnDocument
import uuid

router = APIRouter()

# Create a new chat session
def generate_session_id() -> str:
    return str(uuid.uuid4())

# Save a message
@router.post("/messages")
async def save_message(message: ChatMessage):
    try:
        # Convert to dict and remove None values
        message_dict = message.model_dump(by_alias=True, exclude_none=True)
        
        # Insert the message
        result = await router.mongodb.messages.insert_one(message_dict)
        
        # Return the saved message
        if result.inserted_id:
            message_dict["_id"] = str(result.inserted_id)
            return {"status": "success", "message": ChatMessage(**message_dict)}
        
        raise HTTPException(status_code=500, detail="Failed to save message")
        
    except Exception as e:
        print(f"Error saving message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get all messages
@router.get("/messages", response_model=List[ChatMessage])
async def get_all_messages():
    try:
        messages = []
        async for message in router.mongodb.messages.find().sort("created_at", 1):
            # Convert ObjectId to string and create ChatMessage instance
            message["_id"] = str(message["_id"])
            messages.append(ChatMessage(**message))
        return messages
    except Exception as e:
        print(f"Error in get_all_messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get messages by session
@router.get("/messages/{session_id}", response_model=List[ChatMessage])
async def get_messages(session_id: str):
    try:
        messages = []
        async for message in router.mongodb.messages.find({"session_id": session_id}).sort("created_at", 1):
            # Convert ObjectId to string and create ChatMessage instance
            message["_id"] = str(message["_id"])
            messages.append(ChatMessage(**message))
        return messages
    except Exception as e:
        print(f"Error in get_messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def init_chat_routes(app, mongodb):
    # Store MongoDB instance in the router
    router.mongodb = mongodb
    # Include the router in the app
    app.include_router(router, prefix="/api/chat", tags=["chat"])
