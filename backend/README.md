# Momentum Phase 0 MVP Backend

FastAPI backend built with PostgreSQL and LLM-powered parsing for Phase 0 of the Momentum productivity companion.

## Features Scaffolded
1. **User Database Table**: Standard fields (`id`, `timezone`, `notification_prefs`, `oauth_tokens`).
2. **Task Database Table**: Fields for title, category, deadline, estimated and calibrated effort, priority score, and status.
3. **Task NLP Parser (`POST /parse-task`)**: Call LLM (Gemini or OpenAI) with structured JSON output, few-shot prompt, and relative date resolution. Falls back on a custom regex-based heuristic parsing engine if API keys are not provided.
4. **Explainable Priority Score (`GET /tasks/{task_id}/priority`)**: Computes priority using urgency (calibrated effort vs. time remaining), importance, and postponements, returning the score and a one-liner explainability string.
5. **Auto-DB Migration on Startup**: Tables are auto-created in PostgreSQL when the FastAPI server initializes.

## Installation & Setup

1. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```

2. **Set up Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Edit the `.env` file with your credentials:
   - Provide `DATABASE_URL` pointing to your PostgreSQL instance (e.g. `postgresql+asyncpg://postgres:postgres@localhost:5432/momentum`).
   - (Optional) Provide `GEMINI_API_KEY` or `OPENAI_API_KEY` for LLM task parsing. If not provided, a robust heuristic backup parser resolves standard queries automatically.

5. **Run the Server**:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend API will run on `http://localhost:8000`. You can inspect endpoints and run interactive queries at `http://localhost:8000/docs`.
