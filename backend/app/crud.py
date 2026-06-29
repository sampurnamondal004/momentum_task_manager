from typing import List, Optional
from uuid import UUID
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services.priority import calculate_priority

# --- User CRUD ---

async def get_user(db: AsyncSession, user_id: UUID) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user_in: schemas.UserCreate) -> models.User:
    db_user = models.User(
        timezone=user_in.timezone,
        notification_prefs=user_in.notification_prefs,
        oauth_tokens=user_in.oauth_tokens
    )
    db.add(db_user)
    await db.flush()  # flushes user to get DB-generated ID and default fields
    return db_user

async def update_user(db: AsyncSession, user_id: UUID, user_in: schemas.UserUpdate) -> Optional[models.User]:
    db_user = await get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
        
    await db.flush()
    return db_user


# --- Task CRUD ---

async def get_task(db: AsyncSession, task_id: UUID) -> Optional[models.Task]:
    result = await db.execute(select(models.Task).where(models.Task.id == task_id))
    return result.scalars().first()

async def get_user_tasks(db: AsyncSession, user_id: UUID) -> List[models.Task]:
    result = await db.execute(
        select(models.Task)
        .where(models.Task.user_id == user_id)
        .order_by(models.Task.priority_score.desc())
    )
    return list(result.scalars().all())

async def create_task(db: AsyncSession, task_in: schemas.TaskCreate) -> models.Task:
    # Set default calibrated effort to estimated effort initially
    calibrated_effort = task_in.estimated_effort
    
    # Calculate priority score
    score, _ = calculate_priority(
        deadline=task_in.deadline,
        calibrated_effort=calibrated_effort,
        importance=task_in.importance,
        postponements=0
    )
    
    db_task = models.Task(
        user_id=task_in.user_id,
        title=task_in.title,
        category=task_in.category,
        deadline=task_in.deadline,
        estimated_effort=task_in.estimated_effort,
        calibrated_effort=calibrated_effort,
        importance=task_in.importance,
        priority_score=score,
        postponements=0,
        status="pending"
    )
    db.add(db_task)
    await db.flush()
    return db_task

async def update_task(db: AsyncSession, task_id: UUID, task_in: schemas.TaskUpdate) -> Optional[models.Task]:
    db_task = await get_task(db, task_id)
    if not db_task:
        return None
    
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)
        
    # Recalculate priority if any factors change
    score, _ = calculate_priority(
        deadline=db_task.deadline,
        calibrated_effort=db_task.calibrated_effort,
        importance=db_task.importance,
        postponements=db_task.postponements
    )
    db_task.priority_score = score
    
    await db.flush()
    return db_task

async def delete_task(db: AsyncSession, task_id: UUID) -> bool:
    db_task = await get_task(db, task_id)
    if not db_task:
        return False
    await db.delete(db_task)
    await db.flush()
    return True
