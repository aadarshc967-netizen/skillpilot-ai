# SkillPilot AI

A personalized learning dashboard prototype with a React, Vite, TypeScript, and Tailwind CSS frontend and a FastAPI/SQLite backend.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Create an account or sign in from the dashboard. New accounts start with an empty learner profile, skills, roadmap, and assessment history. Add profile details, skills, and a career goal to generate a personalized analysis and roadmap.

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

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/learner` (authenticated)
- `PUT /api/learner/career`
- `PUT /api/learner/profile` (learner details, certifications, projects)
- `GET /api/skills`
- `POST /api/skills`
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

The backend loads `GEMINI_API_KEY` from `backend/.env` or the process environment. Temporary Gemini 5xx errors are retried up to twice with exponential backoff; if the configured model still fails, requests try `gemini-3.1-flash-lite` once. If both models fail, the API reports an error and does not substitute demo responses. To explicitly enable deterministic demo behavior for a local demonstration, set `SKILLPILOT_DEMO_MODE=true`. The UI labels those results as demo output, not live AI.

Learner endpoints require a bearer token returned by signup or login. Passwords are stored as salted PBKDF2 hashes. Set a persistent, securely generated `JWT_SECRET_KEY` (at least 32 characters) in the backend environment to keep tokens valid across restarts; production mode refuses to run authenticated requests without it. Never commit `.env` files, API keys, or the database.

Backend tests:

```powershell
python -m pytest backend\tests -q
```
