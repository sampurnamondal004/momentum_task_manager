from datetime import datetime, timezone
from typing import Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app import models

def calculate_priority(
    deadline: datetime | None,
    calibrated_effort: int,  # in minutes
    importance: int,          # 1 to 5
    postponements: int        # count
) -> Tuple[float, str]:
    """
    Computes priority score and generates an explainable one-liner description.
    
    Formula logic:
    1. Urgency: calibrated_effort / time_remaining (in minutes)
    2. Overdue: penalty score based on how long it has been overdue.
    3. Importance multiplier: weights the urgency.
    4. Postponements: adds incremental weight.
    """
    now = datetime.now(timezone.utc)
    
    # Standardize deadline timezone
    if deadline is not None and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    # 1. Calculate Urgency
    if deadline is None:
        # No deadline -> Low urgency, rely entirely on importance
        urgency = 0.1
        time_text = "no deadline"
    else:
        time_remaining_sec = (deadline - now).total_seconds()
        time_remaining_min = time_remaining_sec / 60.0
        
        if time_remaining_min <= 0:
            # Overdue! Calculate penalty
            overdue_min = abs(time_remaining_min)
            # Urgency scales with effort and overdue duration
            urgency = (calibrated_effort / 10.0) + 10.0 + (overdue_min / 60.0) * 5.0
            time_text = f"overdue by {overdue_min / 60.0:.1f} hours"
        else:
            # Due in the future
            if time_remaining_min < 1.0:
                time_remaining_min = 1.0  # Prevent division by zero
            urgency = calibrated_effort / time_remaining_min
            
            hours = time_remaining_min / 60.0
            if hours < 24:
                time_text = f"due in {hours:.1f} hours"
            else:
                time_text = f"due in {hours / 24.0:.1f} days"

    # 2. Compute Priority Score
    # Score = Urgency * Importance + Postponements * 2.0
    score = (urgency * importance) + (postponements * 2.0)
    score = round(score, 2)

    # 3. Generate Explanation
    if deadline is None:
        explanation = f"No deadline set. Priority is based on importance ({importance}/5) and effort ({calibrated_effort}m)."
    elif deadline <= now:
        explanation = f"Task is {time_text} and takes {calibrated_effort}m. Immediate action is critical to prevent further delay."
    else:
        hours_left = (deadline - now).total_seconds() / 3600.0
        if score > 15.0:
            explanation = f"Urgent task due in {hours_left:.1f} hours. Requires {calibrated_effort}m—start soon to avoid missing the deadline."
        elif postponements > 2:
            explanation = f"Postponed {postponements} times already. Finishes in {calibrated_effort}m—clear it now to reduce backlog friction."
        else:
            explanation = f"Due in {hours_left / 24.0:.1f} days with moderate urgency. Estimated effort is {calibrated_effort}m."

    return score, explanation
