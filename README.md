# SkillPilot AI

A personalized learning dashboard prototype with a React, Vite, TypeScript, and Tailwind CSS frontend and a FastAPI/SQLite backend.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The dashboard starts with a sample learner, Jordan Miller, whose target is Full Stack Developer. Profile and sample display data live in `frontend/src/data.ts`. The app uses the FastAPI endpoints for agent analysis, assessments, and mentor chat.

The typed API adapter in `frontend/src/services/api.ts` targets the FastAPI server at `http://127.0.0.1:8000` by default. Set `VITE_API_BASE_URL` to override it.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API initializes a local SQLite database at `backend/data/skillpilot.db`. Learner profile details, skills, roadmap progress, and assessment attempts are persisted there.

- `GET /api/health`
- `GET /api/learner`
- `PUT /api/learner/career`
- `PUT /api/learner/profile` (learner details, certifications, projects)
- `GET /api/skills`
- `PUT /api/skills/{skill_id}` (persist proficiency updates)
- `GET /api/roadmap`
- `PUT /api/roadmap/{step_id}` (persist roadmap status)
- `GET /api/assessment/questions`
- `GET /api/assessments` (saved assessment history)
- `POST /api/agents/analyze` (server-sent agent activity events)
- `POST /api/agents/assessment` (assessment and adapted roadmap events)
- `POST /api/mentor/chat`

Interactive API documentation is available at `http://localhost:8000/docs`.

## AI agents and demo mode

The backend orchestrator runs the Skill Analyst, Career Matching, and Learning Path agents in sequence, passing validated output between them. Assessment submissions run the Assessment Agent first, then pass the results through the analysis and matching agents to the Learning Path Agent for roadmap adaptation. Agent progress is streamed to the frontend as server-sent events.

Set `GEMINI_API_KEY` in the backend process environment to use the official Google Gen AI Python SDK. Optionally set `GEMINI_MODEL` (defaults to `gemini-3.8-flash`). Never put API keys in frontend variables or source files. For example, in PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
$env:GEMINI_MODEL = "gemini-3.8-flash"
uvicorn app.main:app --reload
```

Without `GEMINI_API_KEY`, the backend uses deterministic demo behavior, returned with `mode: "demo"` and labeled as demo mode in the UI. Demo mode is not a live AI response. If Gemini is unavailable, returns an invalid response, or is over quota, the current orchestration run switches to deterministic demo behavior and returns a visible fallback reason. The key is loaded from `backend/.env` (or the process environment) and must never be committed.

Backend tests:

```powershell
python -m pytest backend\tests -q
```
