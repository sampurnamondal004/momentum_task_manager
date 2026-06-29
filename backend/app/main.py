from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routes import users, tasks, llm

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database Tables
    async with engine.begin() as conn:
        # Auto-create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: Clean up resources if necessary
    await engine.dispose()

app = FastAPI(
    title="Momentum Phase 0 MVP API",
    description="Intelligent productivity companion backend.",
    version="0.1.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(llm.router)

@app.get("/")
async def root():
    return {
        "app": "Momentum Phase 0 MVP Backend",
        "status": "healthy",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
