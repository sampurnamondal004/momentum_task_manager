from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.database import get_db
from app.services.priority import calculate_priority

router = APIRouter(tags=["Tasks"])

@router.post("/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task: schemas.TaskCreate, db: AsyncSession = Depends(get_db)):
    """
    Creates a new task and calculates its initial priority score.
    """
    # Verify user exists
    user = await crud.get_user(db, task.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {task.user_id} does not exist."
        )
    return await crud.create_task(db=db, task_in=task)


@router.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
async def read_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Retrieves details for a specific task.
    """
    db_task = await crud.get_task(db=db, task_id=task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )
    return db_task


@router.get("/users/{user_id}/tasks", response_model=List[schemas.TaskResponse])
async def read_user_tasks(user_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Lists all tasks for a specific user, sorted by priority score descending.
    """
    user = await crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )
    return await crud.get_user_tasks(db=db, user_id=user_id)


@router.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
async def update_task(task_id: UUID, task_in: schemas.TaskUpdate, db: AsyncSession = Depends(get_db)):
    """
    Updates task properties and recalculates priority score automatically.
    """
    db_task = await crud.update_task(db=db, task_id=task_id, task_in=task_in)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )
    return db_task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Deletes a task from the database.
    """
    success = await crud.delete_task(db=db, task_id=task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )
    return None


@router.get("/tasks/{task_id}/priority", response_model=schemas.PriorityResponse)
async def get_task_priority(task_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Computes priority on-the-fly for a task and returns the score and a one-liner explainability string.
    """
    db_task = await crud.get_task(db=db, task_id=task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )
    
    score, explanation = calculate_priority(
        deadline=db_task.deadline,
        calibrated_effort=db_task.calibrated_effort,
        importance=db_task.importance,
        postponements=db_task.postponements
    )
    
    return schemas.PriorityResponse(
        task_id=db_task.id,
        priority_score=score,
        explanation=explanation
    )
