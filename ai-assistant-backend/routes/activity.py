from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from mongodb import get_database

router = APIRouter()

class ActivityCreate(BaseModel):
    page: str
    metadata: Optional[Dict[str, Any]] = None
    type: str = "page_view"
    timestamp: Optional[str] = None

class ActivityResponse(ActivityCreate):
    id: str
    timestamp: str

@router.post("/api/activity", response_model=dict)
async def log_activity(
    activity: ActivityCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Log a user activity with duplicate prevention"""
    try:
        # Generate timestamp if not provided
        timestamp = activity.timestamp or datetime.utcnow().isoformat()
        
        # Check for recent duplicate activity (same page and type within last 5 seconds)
        duplicate = await db.activities.find_one({
            "page": activity.page,
            "type": activity.type,
            "timestamp": {
                "$gte": (datetime.utcnow() - timedelta(seconds=5)).isoformat()
            }
        })
        
        if duplicate:
            print(f"[Activity] Duplicate activity detected for {activity.page} - skipping")
            duplicate["id"] = str(duplicate.pop("_id"))
            return {"status": "duplicate", "activity": duplicate}
            
        # Prepare activity data
        activity_data = activity.dict()
        activity_data.update({
            "timestamp": timestamp,
            "metadata": activity.metadata or {}
        })
        
        # Insert into MongoDB
        result = await db.activities.insert_one(activity_data)
        
        # Get the inserted document
        inserted_activity = await db.activities.find_one({"_id": result.inserted_id})
        inserted_activity["id"] = str(inserted_activity.pop("_id"))
        
        print(f"[Activity] Logged: {activity.page} - {inserted_activity['timestamp']}")
        
        return {"status": "success", "activity": inserted_activity}
    except Exception as e:
        print(f"Error logging activity: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to log activity: {str(e)}")

@router.get("/api/activity", response_model=List[dict])
async def get_activities(
    limit: int = 5,  # Default to 5 activities
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get recent activities, sorted by most recent first.
    
    Args:
        limit: Maximum number of activities to return (default: 5, max: 100)
    """
    try:
        # Ensure limit is reasonable
        limit = max(1, min(100, int(limit)))
        
        activities = []
        # Sort by timestamp in descending order (newest first)
        cursor = db.activities.find().sort("timestamp", -1).limit(limit)
        
        async for doc in cursor:
            # Convert ObjectId to string and clean up the document
            doc["id"] = str(doc.pop("_id"))
            # Ensure timestamp is properly formatted
            if isinstance(doc.get("timestamp"), datetime):
                doc["timestamp"] = doc["timestamp"].isoformat()
            activities.append(doc)
            
        return activities
    except ValueError as ve:
        print(f"Invalid limit parameter: {str(ve)}")
        raise HTTPException(status_code=400, detail=f"Invalid limit parameter: {str(ve)}")
    except Exception as e:
        print(f"Error fetching activities: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch activities")
