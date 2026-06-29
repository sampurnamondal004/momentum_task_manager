# Momentum — Technical Architecture
### AI-powered productivity companion (working name)

---

## 1. Overview

**One-liner:** Momentum closes the gap between *knowing* a task is due and *actually starting* it — by combining task decomposition, context-aware scheduling, friction-reducing pre-staging, and **verified** completion tracking, instead of relying on passive reminders or self-reported progress.

**Required capability coverage:** intelligent prioritization, AI-powered scheduling, personalized recommendations, context-aware reminders, calendar integration, goal/habit tracking, voice assistance, autonomous planning & execution.

**The four differentiators this architecture is built around** (the gaps left open by every comparable AI-generated blueprint reviewed for this problem):

1. **Verified completion** — confirmed via real signals, not self-report or a "mark as done" tap.
2. **Permission-tiered autonomous execution** — a clear boundary between what the AI does on its own and what it asks approval for first.
3. **Effort calibration loop** — the system corrects its own time/effort estimates against what actually happened, instead of trusting a static guess forever.
4. **Task-type procrastination modeling** — personalization at the level of *which kinds* of tasks a specific person avoids, not just *what time of day* they're productive.

---

## 2. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                          INPUT LAYER                           │
│   Voice (STT)  │  Text/Chat  │  Calendar Sync  │  Email Parse  │
│                  Manual Entry  │  Doc/Syllabus Upload (OCR)    │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION / LLM CORE                      │
│     NLP Task Parser  →  Category Tagger  →  Decomposer         │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
        ┌──────────────────────┼───────────────────────┐
        ▼                      ▼                        ▼
┌────────────────┐   ┌──────────────────┐    ┌───────────────────┐
│ Prioritization  │   │ Scheduling Engine │    │ Effort Calibration │
│ Engine (score + │   │ (free-slot fit,   │    │ Loop (predicted vs │
│ explanation)    │   │  calendar write)  │    │ actual, per-user)  │
└────────┬────────┘   └─────────┬─────────┘    └──────────┬─────────┘
         └───────────────────────┼────────────────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │     PRODUCTIVITY AGENT    │
                     │  (decision orchestration)  │
                     └─────────────┬─────────────┘
                                  ▼
        ┌──────────────────────────┼───────────────────────┐
        ▼                          ▼                        ▼
┌─────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ Nudge &          │    │ Friction-Reduction  │    │ Permission-Tiered   │
│ Escalation Engine│    │ Layer (pre-staging) │    │ Autonomous Exec      │
└────────┬─────────┘    └──────────┬──────────┘    └──────────┬──────────┘
         └───────────────────────────┼─────────────────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │ Verified Completion       │
                     │ Engine (real signals)      │
                     └─────────────┬─────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │ Goal & Habit Tracker       │
                     │ + Procrastination Model    │
                     └─────────────────────────┘
```

Data flows down on the first pass (capture → understand → decide → act) and flows back up continuously (every completion signal feeds the calibration loop and the procrastination model, which reshape future prioritization and nudging).

---

## 3. Core Components

### 3.1 Ingestion Layer
- OAuth (read-only first): Google Calendar, Outlook, Gmail.
- Voice capture: Web Speech API for the demo; swap to a hosted STT (e.g. Whisper) for production-grade accuracy.
- Manual/chat input as the universal fallback.
- Document/syllabus OCR — stretch goal, not MVP.

### 3.2 NLP Task Parser (LLM Core)
- Single LLM call with structured JSON output: extracts task name, deadline, estimated effort, category (writing / calls / admin / coding / financial / social), and dependencies.
- Few-shot prompted so vague input ("finish the report") still produces a usable structured object.

### 3.3 Prioritization Engine
- Priority score combines: urgency (effort ÷ time remaining), user-tagged or inferred importance, count of past postponements, and the *calibrated* effort estimate (not the raw guess — see 3.5).
- Every score ships with a one-line explanation ("Bill is due today and takes 5 minutes — clearing it first prevents a penalty"). Explainability is now expected by judges and users alike, so this isn't optional polish.

### 3.4 Scheduling Engine
- Reads free/busy blocks from the calendar API.
- Heuristic slot-fitting: work backward from the deadline, allocate the longest sufficient free block first, split across multiple sessions if needed.
- Writes tentative work-session events back to the calendar (reversible — falls under Tier A autonomy, see 3.8).

### 3.5 Effort Calibration Loop — *differentiator*
- Logs predicted effort vs. actual time-to-completion (sourced from the Verified Completion Engine, 3.10).
- Maintains a per-user, per-category correction factor (e.g. "this user's writing tasks run 40% longer than their own estimate") using a simple rolling average — no heavy ML required for an MVP.
- This is what keeps the priority score from decaying into "a number nobody trusts" after a few wrong guesses.

### 3.6 Friction-Reduction / Pre-staging Layer
- Category-keyed micro-generators: email drafts, outlines, checklists, deep links into the relevant app or portal.
- Each generator is a small, separately-prompted LLM call — keeps each one simple and easy to demo independently.

### 3.7 Nudge & Escalation Engine
- Tiered nudge logic: ambient (48h out) → actionable suggestion (24h out, tied to a real free slot) → accountability check-in (close to deadline, high urgency).
- Tone and escalation path are adjusted by the procrastination-pattern model (3.9), not a single fixed script for everyone.

### 3.8 Permission-Tiered Autonomous Execution — *differentiator*
- **Tier A (autonomous, reversible):** rescheduling work blocks, drafting (not sending) content, generating checklists, reordering the task list.
- **Tier B (approval required):** sending an email, submitting a form, making a payment, canceling or declining a meeting.
- Implementation pattern: every autonomous action is emitted as an "intent" object. Tier A intents execute immediately and are logged. Tier B intents queue for a one-tap approval before they fire. This is the detail that makes "autonomous execution" credible to judges instead of a buzzword.

### 3.9 Procrastination-Pattern Model — *differentiator*
- Tracks completion latency and skip-rate **per task category**, not just per time-of-day.
- Surfaces concrete insights ("you delay phone-call tasks by an average of 2.1 days") and feeds that into which escalation strategy gets used for that category (smaller chunking, stricter tone, buddy-ping, etc.).

### 3.10 Verified Completion Engine — *differentiator*
- Signal sources, in order of preference: calendar event lifecycle (session actually ran), file-modified timestamp, payment/webhook confirmation, sent-email confirmation. Falls back to an explicit check-in only when no real signal is available.
- Every completion claim carries a confidence label: **verified / inferred / self-reported**. This confidence label feeds both the calibration loop and the trust score the nudge engine uses — a self-reported "done" doesn't get treated the same as a confirmed one.

### 3.11 Goal & Habit Tracking
- Long-horizon goals (e.g. "GATE prep in 10 weeks") decompose into recurring tasks the same way a single deadline does.
- Streaks and completion-rate views sit on top of the same task/event data — no separate subsystem needed.

### 3.12 Voice Interface
- STT for frictionless capture ("remind me to follow up with the recruiter Thursday").
- TTS for spoken check-ins at nudge moments. Mockable with the browser API for a hackathon demo; production would move to a dedicated voice API.

---

## 4. Data Model (simplified)

| Table | Key fields |
|---|---|
| `users` | id, oauth_tokens, timezone, notification_prefs |
| `tasks` | id, user_id, title, category, deadline, estimated_effort, calibrated_effort, priority_score, status |
| `task_events` | id, task_id, event_type (scheduled / nudged / pre_staged / completed / escalated), signal_source, confidence |
| `calendar_blocks` | id, task_id, start, end, source (auto-scheduled / user-set) |
| `calibration_history` | id, user_id, category, predicted_effort, actual_effort, ratio |
| `procrastination_profile` | id, user_id, category, avg_delay, skip_rate, preferred_tone |
| `goals` | id, user_id, title, horizon, decomposed_task_ids |
| `habits` | id, user_id, name, streak_count, last_completed |

`task_events` is the backbone — it's what the calibration loop, the procrastination model, and the verified-completion confidence score all read from.

---

## 5. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Fast to build, async-native — reuse the WebSocket/real-time patterns already familiar from prior work |
| Database | PostgreSQL (+ `pgvector` extension) | One database for both relational data and learned-preference embeddings — avoids standing up a separate vector store for an MVP |
| LLM | Claude or GPT API, structured JSON output mode | Task parsing, decomposition, and content generation |
| Calendar | Google Calendar API (OAuth2) | Broadest student/professional coverage; Outlook as a fast-follow |
| Real-time nudges | FastAPI WebSockets (web demo) / Firebase Cloud Messaging (mobile) | Push the nudge the moment the context engine fires it |
| Frontend | React (web) | Fastest path to a working, demoable UI in a hackathon window |
| Voice | Web Speech API (MVP) → hosted STT/TTS (production) | Zero setup cost for the demo, upgradeable later |
| Hosting | Railway | Matches existing deployment experience, fast to stand up |

---

## 6. Security & Privacy

- OAuth scopes start read-only; write access (calendar scheduling) is requested as a separate, explicit grant.
- Every Tier B autonomous action requires one-tap confirmation and is logged with a timestamp and the data it touched — this audit trail is the answer if a judge asks "what stops this from sending the wrong email."
- Financial integrations (bill payments) go through a tokenized provider (e.g. Plaid-style) rather than storing raw banking credentials directly.

---

## 7. Phased Build Plan

**Phase 0 — hackathon-window MVP**
1. Manual/voice task input → LLM decomposition + priority score with a visible explanation.
2. Google Calendar read + free-slot-based nudge timing.
3. One working friction-reduction generator (e.g. auto-drafted email or outline) — this is the moment that should make judges sit up.
4. One verified-completion hook (calendar event lifecycle, or a file-modified timestamp), demoed side-by-side against a "fake self-report" to make the contrast explicit.
5. A visible permission-tier toggle in the UI, even if only Tier A logic is fully wired — shows the safety thinking without requiring every integration to actually work live.

**Phase 1 — post-hackathon**
- Effort calibration loop, procrastination-pattern model, full escalation tiers, goal/habit tracking, voice I/O end-to-end, autonomous execution beyond drafts (with real Tier B approval flow).

---

## 8. Differentiator → Component Map

| Gap in existing AI-generated takes | Component that closes it |
|---|---|
| Trusts self-reported progress | Verified Completion Engine (3.10) |
| "AI auto-handles X" with no safety boundary | Permission-Tiered Autonomous Execution (3.8) |
| Static effort/urgency guesses that never improve | Effort Calibration Loop (3.5) |
| Personalizes by time-of-day only | Procrastination-Pattern Model (3.9) |
