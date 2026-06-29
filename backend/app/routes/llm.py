from fastapi import APIRouter, HTTPException, status

from app import schemas
from app.services.llm_service import parse_task_llm

router = APIRouter(prefix="/parse-task", tags=["LLM Task Parser"])

@router.post("", response_model=schemas.ParseTaskResponse)
async def parse_task(payload: schemas.ParseTaskRequest):
    """
    Parses a raw natural language description of a task into structured fields:
    title, category, estimated_effort, and deadline.
    """
    try:
        parsed_result = await parse_task_llm(payload.text)
        return parsed_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed parsing task description: {str(e)}"
        )
