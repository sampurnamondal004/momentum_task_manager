import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from pydantic import BaseModel, Field

from google import genai
from app.config import settings

logger = logging.getLogger(__name__)

# Allowed categories for task mapping
ALLOWED_CATEGORIES = {"writing", "calls", "admin", "coding", "financial", "social"}


class GeminiParsedTask(BaseModel):
    task_name: str = Field(description="The extracted name or action of the task.")
    deadline: Optional[str] = Field(description="ISO-8601 format string representing the deadline, or empty/null if none.")
    estimated_effort_hours: float = Field(description="Estimated time needed to complete the task in hours.")
    category: Literal["writing", "calls", "admin", "coding", "financial", "social"] = Field(
        description="The task category."
    )


def heuristic_fallback_parse(text: str) -> dict:
    """
    Fallback task parser using regex heuristics if no Gemini API key is configured.
    Conforms to the required 6 categories.
    """
    logger.warning("Using heuristic task parser fallback.")
    text_lower = text.lower()
    
    # 1. Category extraction (default to admin)
    category = "admin"
    words = set(re.findall(r'\b\w+\b', text_lower))
    
    if any(w in words for w in ["call", "phone", "talk", "ring", "calls", "calling"]):
        category = "calls"
    elif any(w in words for w in ["write", "draft", "report", "paper", "essay", "blog", "writing", "reports"]):
        category = "writing"
    elif any(w in words for w in ["code", "debug", "develop", "program", "build", "frontend", "backend", "coding"]):
        category = "coding"
    elif any(w in words for w in ["pay", "bill", "invoice", "bank", "financial", "tax", "rent", "payment"]):
        category = "financial"
    elif any(w in words for w in ["meet", "coffee", "lunch", "social", "party", "dinner", "visit", "meeting"]):
        category = "social"
    elif any(w in words for w in ["admin", "organize", "schedule", "clean", "file", "sort"]):
        category = "admin"
        
    # 2. Effort extraction (hours to minutes)
    effort_minutes = 30  # Default MVP effort: 30 minutes
    
    # Look for "X hours" or "X hrs"
    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hour|hr|hours|hrs)", text_lower)
    if hour_match:
        effort_minutes = int(float(hour_match.group(1)) * 60)
    else:
        # Look for "X minutes" or "X mins"
        min_match = re.search(r"(\d+)\s*(?:minute|min|minutes|mins)", text_lower)
        if min_match:
            effort_minutes = int(min_match.group(1))

    # 3. Deadline extraction
    deadline = None
    now = datetime.now(timezone.utc)
    if "today" in text_lower:
        deadline = now.replace(hour=17, minute=0, second=0, microsecond=0)
    elif "tomorrow" in text_lower:
        deadline = (now + timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
    elif "next week" in text_lower:
        deadline = (now + timedelta(days=7)).replace(hour=12, minute=0, second=0, microsecond=0)
    elif "friday" in text_lower:
        days_ahead = 4 - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        deadline = (now + timedelta(days=days_ahead)).replace(hour=17, minute=0, second=0, microsecond=0)
    elif "monday" in text_lower:
        days_ahead = 0 - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        deadline = (now + timedelta(days=days_ahead)).replace(hour=12, minute=0, second=0, microsecond=0)

    # 4. Title extraction
    title = text
    cleanup_patterns = [
        r"by\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week\w*)",
        r"(?:takes|taking|estimated)\s+(?:about\s+)?\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?",
        r"for\s+(?:about\s+)?\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?",
        r"\b\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?\b"
    ]
    for pattern in cleanup_patterns:
        title = re.sub(pattern, "", title, flags=re.IGNORECASE)
    
    title = re.sub(r"\s+", " ", title).strip(" \"',.!?")
    if not title:
        title = text
        
    return {
        "title": title,
        "deadline": deadline.isoformat() if deadline else None,
        "estimated_effort": effort_minutes,
        "category": category
    }


async def parse_task_llm(text: str) -> dict:
    """
    Parses task description using Gemini (google-genai Client) with structured Pydantic schema.
    Falls back to heuristics on error or if api key is missing.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set. Falling back to heuristic parsing.")
        return heuristic_fallback_parse(text)

    now = datetime.now(timezone.utc)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")
    day_of_week = now.strftime("%A")

    prompt = (
        f"You are an NLP parser for Momentum. Extract the task details from this user input: \"{text}\"\n\n"
        f"Reference Current Time: {now_str} ({day_of_week}).\n"
        f"Ensure relative deadlines (like 'tomorrow', 'Friday', 'next week') are resolved to specific ISO strings "
        f"relative to this reference time."
    )

    try:
        # Client automatically reads GEMINI_API_KEY from env, but we pass it explicitly to ensure correctness
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Call generate_content in blocking executor or standard async (google-genai generate_content is synchronous)
        # We can run it in an async threadpool using anyio/asyncio to keep our FastAPI app responsive
        import anyio
        
        def call_gemini():
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': GeminiParsedTask,
                }
            )
            
        response = await anyio.to_thread.run_sync(call_gemini)
        
        parsed_task: GeminiParsedTask = response.parsed
        if parsed_task:
            # Map hours to minutes
            effort_minutes = int(parsed_task.estimated_effort_hours * 60)
            
            # Map category
            category = parsed_task.category
            if category not in ALLOWED_CATEGORIES:
                category = "admin"
                
            # Normalize deadline ISO string
            deadline_str = None
            if parsed_task.deadline:
                try:
                    # Clean/validate datetime format
                    dt = datetime.fromisoformat(parsed_task.deadline.replace('Z', '+00:00'))
                    deadline_str = dt.isoformat()
                except Exception:
                    deadline_str = None
                    
            return {
                "title": parsed_task.task_name,
                "deadline": deadline_str,
                "estimated_effort": effort_minutes,
                "category": category
            }
        else:
            logger.error("Gemini failed to populate parsed response.")
            
    except Exception as e:
        logger.error(f"Error calling Gemini API: {e}", exc_info=True)

    # Fallback to regex heuristic parser
    return heuristic_fallback_parse(text)
