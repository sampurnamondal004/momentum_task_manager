import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oauth_tokens = Column(JSON, nullable=True)
    timezone = Column(String, default="UTC", nullable=False)
    notification_prefs = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, timezone={self.timezone})>"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, default="other", nullable=False)  # writing, calls, admin, coding, financial, social, other
    deadline = Column(DateTime(timezone=True), nullable=True)
    estimated_effort = Column(Integer, default=0, nullable=False)  # in minutes
    calibrated_effort = Column(Integer, default=0, nullable=False)  # in minutes
    priority_score = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, in_progress, completed, failed
    importance = Column(Integer, default=3, nullable=False)  # 1 to 5 scale
    postponements = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="tasks")

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, title={self.title}, priority={self.priority_score:.2f})>"
