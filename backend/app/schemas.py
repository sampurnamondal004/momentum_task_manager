from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

# User Schemas
class UserBase(BaseModel):
    timezone: str = Field(default="UTC", description="The user's preferred timezone.")
    notification_prefs: Optional[Dict[str, Any]] = Field(default=None, description="Key-value user notification preferences.")

class UserCreate(UserBase):
    oauth_tokens: Optional[Dict[str, Any]] = Field(default=None, description="Encrypted or raw credentials/tokens for OAuth provider integrations.")

class UserUpdate(BaseModel):
    timezone: Optional[str] = None
    notification_prefs: Optional[Dict[str, Any]] = None
    oauth_tokens: Optional[Dict[str, Any]] = None

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Task Schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, description="Title/name of the task.")
    category: str = Field(default="other", description="Category tag: writing, calls, admin, coding, financial, social, other.")
    deadline: Optional[datetime] = Field(default=None, description="Deadline for the task, preferably in timezone-aware format.")
    estimated_effort: int = Field(default=0, ge=0, description="Estimated effort in minutes.")
    importance: int = Field(default=3, ge=1, le=5, description="User-set or inferred importance level (1 to 5 scale).")

class TaskCreate(TaskBase):
    user_id: UUID = Field(..., description="The ID of the owner of this task.")

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    deadline: Optional[datetime] = None
    estimated_effort: Optional[int] = None
    calibrated_effort: Optional[int] = None
    status: Optional[str] = None
    importance: Optional[int] = None
    postponements: Optional[int] = None

class TaskResponse(TaskBase):
    id: UUID
    user_id: UUID
    calibrated_effort: int
    priority_score: float
    status: str
    postponements: int
    created_at: datetime

    class Config:
        from_attributes = True


# Parser Schemas
class ParseTaskRequest(BaseModel):
    text: str = Field(..., description="Raw task description from voice/chat manual capture.")

class ParseTaskResponse(BaseModel):
    title: str
    deadline: Optional[datetime] = None
    estimated_effort: int = 0
    category: str = "other"


# Priority Schemas
class PriorityResponse(BaseModel):
    task_id: UUID
    priority_score: float
    explanation: str
