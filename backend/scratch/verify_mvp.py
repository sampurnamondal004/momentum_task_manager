import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend directory to path so we can import app modules
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base
from app import models, schemas, crud
from app.services.priority import calculate_priority
from app.services.llm_service import heuristic_fallback_parse, parse_task_llm

async def run_verification():
    print("==================================================")
    print("   MOMENTUM MVP PHASE 0 VERIFICATION SUITE")
    print("==================================================")
    
    # 1. Setup in-memory SQLite for self-contained testing
    print("\n[1/5] Setting up mock SQLite database...")
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("SQLite tables created successfully.")
    
    # 2. Test User Creation
    print("\n[2/5] Testing User Creation...")
    async with AsyncSessionLocal() as session:
        user_in = schemas.UserCreate(
            timezone="America/New_York",
            notification_prefs={"email": True, "push": False}
        )
        user = await crud.create_user(session, user_in)
        await session.commit()
        
        user_id = user.id
        print(f"Created User ID: {user_id}")
        print(f"Timezone: {user.timezone}")
        print(f"Notification Prefs: {user.notification_prefs}")
        assert user.timezone == "America/New_York"
        assert user.notification_prefs["email"] is True

    # 3. Test Task Parse Logic (Heuristics & Mock LLM fallback)
    print("\n[3/5] Testing NLP Task Parse Logic...")
    test_inputs = [
        "call the client tomorrow at 10am for 15 minutes",
        "write the engineering design report by Friday, takes 3 hours",
        "pay electricity bill today, takes 10 mins"
    ]
    
    parsed_tasks = []
    for idx, text in enumerate(test_inputs, 1):
        print(f"\nParsing text {idx}: '{text}'")
        # Run local fallback parsing
        parsed = heuristic_fallback_parse(text)
        parsed_tasks.append(parsed)
        print(f"  -> Title: {parsed['title']}")
        print(f"  -> Category: {parsed['category']}")
        print(f"  -> Estimated Effort: {parsed['estimated_effort']} mins")
        print(f"  -> Deadline: {parsed['deadline']}")
        
    # Validations
    assert parsed_tasks[0]["category"] == "calls"
    assert parsed_tasks[0]["estimated_effort"] == 15
    assert parsed_tasks[1]["category"] == "writing"
    assert parsed_tasks[1]["estimated_effort"] == 180
    assert parsed_tasks[2]["category"] == "financial"
    assert parsed_tasks[2]["estimated_effort"] == 10

    # 4. Test Task Insertion & Priority Score
    print("\n[4/5] Testing Task Insertion & Priority score calculation...")
    async with AsyncSessionLocal() as session:
        parsed = parsed_tasks[1] # "write engineering design report"
        
        # Build TaskCreate
        deadline_dt = datetime.fromisoformat(parsed["deadline"]) if parsed["deadline"] else None
        task_in = schemas.TaskCreate(
            user_id=user_id,
            title=parsed["title"],
            category=parsed["category"],
            deadline=deadline_dt,
            estimated_effort=parsed["estimated_effort"],
            importance=4 # higher importance
        )
        
        task = await crud.create_task(session, task_in)
        await session.commit()
        
        task_id = task.id
        print(f"Inserted Task: '{task.title}'")
        print(f"  -> Category: {task.category}")
        print(f"  -> Deadline: {task.deadline}")
        print(f"  -> Estimated Effort: {task.estimated_effort} mins")
        print(f"  -> Initial Priority Score: {task.priority_score}")
        assert task.priority_score > 0

    # 5. Test Priority Update & Explainability
    print("\n[5/5] Testing Priority scoring explainability...")
    async with AsyncSessionLocal() as session:
        # Retrieve task
        task = await crud.get_task(session, task_id)
        
        # Calculate expected score and explanation
        score, explanation = calculate_priority(
            deadline=task.deadline,
            calibrated_effort=task.calibrated_effort,
            importance=task.importance,
            postponements=task.postponements
        )
        print(f"Calculated Score: {score}")
        print(f"Explanation: \"{explanation}\"")
        assert score == task.priority_score
        
        # Simulating a postponement update
        print("\nUpdating task with 3 postponements...")
        task_update = schemas.TaskUpdate(postponements=3)
        updated_task = await crud.update_task(session, task_id, task_update)
        await session.commit()
        
        print(f"  -> New Priority Score: {updated_task.priority_score}")
        score_new, explanation_new = calculate_priority(
            deadline=updated_task.deadline,
            calibrated_effort=updated_task.calibrated_effort,
            importance=updated_task.importance,
            postponements=updated_task.postponements
        )
        print(f"  -> New Explanation: \"{explanation_new}\"")
        assert updated_task.priority_score > score
        assert "Postponed 3 times" in explanation_new

    print("\n==================================================")
    print("   ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    # Configure event loop policy for Windows if needed
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_verification())
