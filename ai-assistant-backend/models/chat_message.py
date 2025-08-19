from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, Field, ConfigDict, field_serializer
from bson import ObjectId

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _info):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        json_schema = {}
        json_schema.update(type="string")
        return json_schema

class ChatMessage(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    role: str  # 'user' or 'assistant'
    content: str
    session_id: str  # To group messages by chat session
    created_at: Union[datetime, str] = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str
        },
        json_schema_extra={
            "example": {
                "role": "user",
                "content": "Hello, world!",
                "session_id": "unique-session-id",
                "created_at": "2023-01-01T00:00:00Z"
            }
        }
    )

    @field_serializer('created_at')
    def serialize_dt(self, dt: datetime, _info):
        if isinstance(dt, str):
            return dt
        return dt.isoformat()
