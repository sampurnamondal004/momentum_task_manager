# Momentum

An AI-powered productivity companion that closes the **intention-action gap** —
helping people actually finish tasks before deadlines, instead of just getting
reminded about them.

## The problem

Students, professionals, and entrepreneurs miss deadlines, meetings, and
payments despite reminder apps, because a notification doesn't reduce the
friction of actually starting the work. Momentum is built around *action*,
not alerts: it decomposes tasks, times its nudges around real free moments,
pre-stages the first step for you, and verifies completion against real
signals instead of trusting a self-reported checkbox.

## What it does

- **Intelligent task prioritization** — a score combining urgency, effort,
  and your own completion history, with a plain-language explanation for
  every ranking.
- **AI-powered scheduling** — finds real free slots on your calendar and
  fits work sessions into them automatically.
- **Context-aware nudges** — timed to when you can actually act, not a fixed
  clock time.
- **Friction-reduction / pre-staging** — drafts the first step for you
  (an email, an outline, a checklist) so starting isn't a blank page.
- **Verified completion** — confirms tasks are actually done from a real
  signal (a calendar event that ran, a file that changed) rather than a
  manual "mark as done."
- **Permission-tiered autonomy** — low-stakes, reversible actions happen
  automatically; anything that sends, pays, or submits externally waits for
  a one-tap approval.
- **Goal & habit tracking**, **voice capture**, and an **effort-calibration
  loop** that corrects its own time estimates against what actually happened.

## Architecture

```
Input (voice/text/calendar/email)
        ↓
NLP Task Parser (Gemini, structured JSON output)
        ↓
Prioritization Engine ←→ Effort Calibration Loop
        ↓
Scheduling Engine → Friction-Reduction Layer → Permission-Tiered Execution
        ↓
Verified Completion Engine → Goal & Habit Tracker / Procrastination Model
```

Full component-level detail lives in `Momentum_Technical_Architecture.md`.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python), SQLAlchemy |
| Database | PostgreSQL |
| LLM | Google Gemini (`google-genai`, `gemini-2.5-flash`) — structured JSON output |
| Frontend | React + Vite, plain CSS |
| Dev tooling | Google Antigravity (agentic IDE) |
| Deployment | Google Cloud |

## Project structure

```
momentum/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── crud.py
│   │   ├── database.py
│   │   ├── routes/        (users.py, tasks.py, llm.py)
│   │   └── services/
│   │       ├── priority.py
│   │       └── llm_service.py
│   ├── scratch/verify_mvp.py
│   ├── .env
│   └── requirements.txt
└── frontend(1)/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── components/
    │   └── styles/
    └── package.json
```

## Getting started — backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1      # or source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

Create `.env` from `.env.template` and fill in:
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/momentum
GEMINI_API_KEY=your_key_here
HOST=0.0.0.0
PORT=8000
DEBUG=True
```

Create the database in pgAdmin (or `createdb momentum`), then run:
```bash
uvicorn app.main:app --reload
```

## Getting started — frontend

```bash
cd frontend(1)
npm install
cp .env.example .env      # set VITE_API_URL if your backend isn't on localhost:8000
npm run dev
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/parse-task` | Send raw task text, get back structured fields (name, deadline, effort, category) |
| POST | `/tasks` | Save a parsed task |
| GET | `/tasks` | List all tasks with priority scores and explanations |
| GET | `/tasks/{id}` | Fetch a single task's full detail |

## Roadmap (post-MVP)

- Gmail ingestion and auto-drafted email sending (Tier B, approval-gated)
- Google Chat / Meet as additional nudge and voice check-in channels
- Full effort-calibration and procrastination-pattern personalization
- End-to-end voice capture and spoken check-ins
- Real Tier B approval flow (currently a static UI concept in the frontend)

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b2f069d0-9267-4634-9297-ca8c753d6430

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
