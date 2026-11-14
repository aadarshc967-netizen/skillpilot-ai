import asyncio
import json
import logging
import queue
import re
import sqlite3
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .agents import (
    ASSESSMENT_QUESTIONS,
    CAREER_REQUIREMENTS,
    AgentOrchestrator,
    AgentProviderError,
    MentorAgent,
)
from .database import get_connection, get_db, initialize_database
from .schemas import (
    AnalysisRequest,
    AssessmentAttempt,
    AssessmentSubmission,
    LearnerProfileUpdate,
    CareerUpdate,
    Learner,
    MentorMessage,
    RoadmapStep,
    Skill,
    SkillProgressUpdate,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="SkillPilot AI API",
    description="Learner profiles, skill-gap analysis, and collaborative learning agents.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Database = Annotated[sqlite3.Connection, Depends(get_db)]
logger = logging.getLogger(__name__)


@app.get("/api/health")
def health() -> dict[str, str]:
    orchestrator = AgentOrchestrator()
    return {"status": "ok", "ai_mode": orchestrator.mode}


@app.get("/api/learner", response_model=Learner)
def get_learner(db: Database) -> dict[str, object]:
    learner = db.execute("SELECT * FROM learners WHERE id = 1").fetchone()
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    return _learner_response(learner)


@app.put("/api/learner/career", response_model=Learner)
def update_career(payload: CareerUpdate, db: Database) -> dict[str, object]:
    career = payload.target_career.strip()
    if not career:
        raise HTTPException(status_code=422, detail="Target career cannot be empty")
    if career not in CAREER_REQUIREMENTS:
        raise HTTPException(status_code=422, detail="Select a supported target career")
    result = db.execute(
        "UPDATE learners SET target_career = ? WHERE id = 1",
        (career,),
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Learner not found")
    db.execute(
        "UPDATE skills SET is_gap = 0, priority = '—' WHERE learner_id = 1"
    )
    existing_skills = {
        row["name"].casefold(): row
        for row in db.execute(
            "SELECT id, name, category, progress FROM skills WHERE learner_id = 1"
        ).fetchall()
    }
    for requirement in CAREER_REQUIREMENTS[career]:
        existing = existing_skills.get(requirement["name"].casefold())
        if existing is None:
            db.execute(
                """
                INSERT INTO skills
                    (learner_id, name, category, level, progress, is_gap, priority)
                VALUES (1, ?, ?, 'Not started', 0, 1, ?)
                """,
                (requirement["name"], requirement["category"], requirement["priority"]),
            )
            continue
        is_gap = existing["progress"] < requirement["minimum_progress"]
        priority = requirement["priority"] if is_gap else "—"
        db.execute(
            "UPDATE skills SET is_gap = ?, priority = ? WHERE id = ?",
            (int(is_gap), priority, existing["id"]),
        )
    db.commit()
    return _learner_response(db.execute("SELECT * FROM learners WHERE id = 1").fetchone())


@app.put("/api/learner/profile", response_model=Learner)
def update_learner_profile(payload: LearnerProfileUpdate, db: Database) -> dict[str, object]:
    name = payload.name.strip()
    email = payload.email.strip()
    certifications = [item.strip() for item in payload.certifications if item.strip()]
    projects = [item.strip() for item in payload.projects if item.strip()]
    if not name or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a learner name and valid email address")
    result = db.execute(
        """
        UPDATE learners
        SET name = ?, email = ?, certifications_json = ?, projects_json = ?
        WHERE id = 1
        """,
        (name, email, json.dumps(certifications), json.dumps(projects)),
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Learner not found")
    db.commit()
    return _learner_response(db.execute("SELECT * FROM learners WHERE id = 1").fetchone())


@app.get("/api/skills", response_model=list[Skill])
def get_skills(db: Database) -> list[dict[str, object]]:
    rows = db.execute(
        "SELECT * FROM skills WHERE learner_id = 1 ORDER BY is_gap, id"
    ).fetchall()
    return [dict(row) for row in rows]


@app.put("/api/skills/{skill_id}", response_model=Skill)
def update_skill_progress(
    skill_id: int,
    payload: SkillProgressUpdate,
    db: Database,
) -> dict[str, object]:
    skill = db.execute(
        "SELECT * FROM skills WHERE id = ? AND learner_id = 1",
        (skill_id,),
    ).fetchone()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    profile = db.execute("SELECT target_career FROM learners WHERE id = 1").fetchone()
    requirements = {
        item["name"].casefold(): item
        for item in CAREER_REQUIREMENTS[profile["target_career"]]
    }
    requirement = requirements.get(skill["name"].casefold())
    is_gap = bool(requirement and payload.progress < requirement["minimum_progress"])
    priority = requirement["priority"] if is_gap and requirement else "—"
    level = (
        "Not started" if payload.progress == 0
        else "Beginner" if payload.progress < 40
        else "Intermediate" if payload.progress < 75
        else "Advanced"
    )
    db.execute(
        "UPDATE skills SET progress = ?, level = ?, is_gap = ?, priority = ? WHERE id = ?",
        (payload.progress, level, int(is_gap), priority, skill_id),
    )
    db.commit()
    updated = db.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
    return dict(updated)


@app.get("/api/roadmap", response_model=list[RoadmapStep])
def get_roadmap(db: Database) -> list[dict[str, Any]]:
    return _load_roadmap(db)


@app.put("/api/roadmap/{step_id}", response_model=RoadmapStep)
def update_roadmap_step(step_id: int, status: str, db: Database) -> dict[str, Any]:
    if status not in {"complete", "in-progress", "up-next", "locked"}:
        raise HTTPException(status_code=422, detail="Unsupported roadmap status")
    result = db.execute(
        "UPDATE roadmap_steps SET status = ? WHERE id = ? AND learner_id = 1",
        (status, step_id),
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Roadmap step not found")
    db.commit()
    step = db.execute("SELECT * FROM roadmap_steps WHERE id = ?", (step_id,)).fetchone()
    item = dict(step)
    item["exercises"] = json.loads(item.pop("exercises_json", "[]"))
    item["resources"] = json.loads(item.pop("resources_json", "[]"))
    return item


@app.get("/api/assessments", response_model=list[AssessmentAttempt])
def get_assessment_history(db: Database) -> list[dict[str, Any]]:
    rows = db.execute(
        """
        SELECT id, target_career, score, total_questions, correct_count,
               weak_topics_json, created_at
        FROM assessment_attempts WHERE learner_id = 1 ORDER BY id DESC
        """
    ).fetchall()
    return [
        {
            **dict(row),
            "weak_topics": json.loads(row["weak_topics_json"]),
        }
        for row in rows
    ]


@app.get("/api/assessment/questions")
def get_assessment_questions() -> list[dict[str, Any]]:
    return [
        {key: value for key, value in question.items() if key != "correct_answer"}
        for question in ASSESSMENT_QUESTIONS
    ]


@app.post("/api/agents/analyze")
def analyze_learning_path(payload: AnalysisRequest, db: Database) -> StreamingResponse:
    learner = db.execute("SELECT * FROM learners WHERE id = 1").fetchone()
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    career = (payload.target_career or learner["target_career"]).strip()
    if not career:
        raise HTTPException(status_code=422, detail="Target career cannot be empty")
    if career not in CAREER_REQUIREMENTS:
        raise HTTPException(status_code=422, detail="Select a supported target career")
    skills = [
        dict(row)
        for row in db.execute(
            "SELECT * FROM skills WHERE learner_id = 1 ORDER BY is_gap, id"
        ).fetchall()
    ]
    previous_steps = _load_roadmap(db)
    assessment_row = db.execute(
        "SELECT * FROM assessment_attempts WHERE learner_id = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    latest_assessment = _assessment_context(assessment_row)
    learner_profile = _agent_profile_context(learner)
    orchestrator = AgentOrchestrator()

    def run(on_activity: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
        result = orchestrator.analyze(
            career,
            skills,
            previous_steps,
            on_activity,
            profile=learner_profile,
            assessment=latest_assessment,
        )
        _replace_roadmap(result["learning_path"]["steps"])
        return result

    return _agent_event_stream(run)


@app.post("/api/agents/assessment")
def submit_assessment(
    payload: AssessmentSubmission,
    db: Database,
) -> StreamingResponse:
    learner = db.execute("SELECT * FROM learners WHERE id = 1").fetchone()
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    career = (payload.target_career or learner["target_career"]).strip()
    if career not in CAREER_REQUIREMENTS:
        raise HTTPException(status_code=422, detail="Select a supported target career")
    skills = [
        dict(row)
        for row in db.execute(
            "SELECT * FROM skills WHERE learner_id = 1 ORDER BY is_gap, id"
        ).fetchall()
    ]
    previous_steps = _load_roadmap(db)
    answers = [answer.model_dump() for answer in payload.answers]
    learner_profile = _agent_profile_context(learner)
    orchestrator = AgentOrchestrator()

    def run(on_activity: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
        result = orchestrator.assess_and_adapt(
            career,
            skills,
            previous_steps,
            answers,
            on_activity,
            profile=learner_profile,
        )
        _persist_assessment_adaptation(career, result["updated_roadmap"]["steps"], result["assessment"])
        return result

    return _agent_event_stream(run)


@app.post("/api/mentor/chat")
def mentor_chat(payload: MentorMessage, db: Database) -> dict[str, str]:
    learner = db.execute("SELECT * FROM learners WHERE id = 1").fetchone()
    if learner is None:
        raise HTTPException(status_code=404, detail="Learner not found")
    skills = [
        dict(row)
        for row in db.execute(
            "SELECT * FROM skills WHERE learner_id = 1 ORDER BY is_gap, id"
        ).fetchall()
    ]
    latest_assessment_row = db.execute(
        "SELECT * FROM assessment_attempts WHERE learner_id = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    mentor = MentorAgent(AgentOrchestrator().runtime)
    try:
        reply = mentor.respond(
            payload.question.strip(),
            (payload.target_career or learner["target_career"]).strip(),
            skills,
            _agent_profile_context(learner),
            _assessment_context(latest_assessment_row),
        )
    except AgentProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "mode": "demo" if mentor.runtime.demo_mode else "live",
        "agent": mentor.name,
        "reply": reply,
    }


def _load_roadmap(db: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = db.execute(
        "SELECT * FROM roadmap_steps WHERE learner_id = 1 ORDER BY position"
    ).fetchall()
    steps: list[dict[str, Any]] = []
    for row in rows:
        step = dict(row)
        step["exercises"] = json.loads(step.pop("exercises_json", "[]"))
        step["resources"] = json.loads(step.pop("resources_json", "[]"))
        steps.append(step)
    return steps


def _learner_response(row: sqlite3.Row) -> dict[str, object]:
    learner = dict(row)
    learner["certifications"] = json.loads(learner.pop("certifications_json", "[]"))
    learner["projects"] = json.loads(learner.pop("projects_json", "[]"))
    return learner


def _agent_profile_context(row: sqlite3.Row) -> dict[str, list[str]]:
    return {
        "certifications": json.loads(row["certifications_json"]),
        "projects": json.loads(row["projects_json"]),
    }


def _assessment_context(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "target_career": row["target_career"],
        "score": row["score"],
        "total_questions": row["total_questions"],
        "correct_count": row["correct_count"],
        "weak_topics": json.loads(row["weak_topics_json"]),
        "results": json.loads(row["results_json"]),
    }


def _persist_assessment_adaptation(
    career: str,
    steps: list[dict[str, Any]],
    assessment: dict[str, Any],
) -> None:
    connection = get_connection()
    try:
        _write_roadmap(connection, steps)
        connection.execute(
            """
            INSERT INTO assessment_attempts
                (learner_id, target_career, score, total_questions, correct_count,
                 weak_topics_json, results_json)
            VALUES (1, ?, ?, ?, ?, ?, ?)
            """,
            (
                career,
                assessment["score"],
                assessment["total_questions"],
                assessment["correct_count"],
                json.dumps(assessment["weak_topics"]),
                json.dumps(assessment["results"]),
            ),
        )
        connection.commit()
    finally:
        connection.close()


def _replace_roadmap(steps: list[dict[str, Any]]) -> None:
    connection = get_connection()
    try:
        _write_roadmap(connection, steps)
        connection.commit()
    finally:
        connection.close()


def _write_roadmap(connection: sqlite3.Connection, steps: list[dict[str, Any]]) -> None:
    connection.execute("DELETE FROM roadmap_steps WHERE learner_id = 1")
    connection.executemany(
        """
        INSERT INTO roadmap_steps
            (learner_id, title, duration, lessons, description, status, position,
             exercises_json, resources_json)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                step["title"],
                step["duration"],
                step["lessons"],
                step["description"],
                step["status"],
                position,
                json.dumps(step.get("exercises", [])),
                json.dumps(step.get("resources", [])),
            )
            for position, step in enumerate(steps, start=1)
        ],
    )


def _agent_event_stream(
    run: Callable[[Callable[[dict[str, Any]], None]], dict[str, Any]],
) -> StreamingResponse:
    def encode_event(event: dict[str, Any]) -> str:
        return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    async def stream() -> AsyncIterator[str]:
        events: queue.Queue[dict[str, Any]] = queue.Queue()
        current_activity: dict[str, Any] | None = None

        def report_activity(activity: dict[str, Any]) -> None:
            nonlocal current_activity
            if activity["status"] == "running":
                current_activity = activity
            elif current_activity and current_activity["agent"] == activity["agent"]:
                current_activity = None
            events.put({"type": "activity", "activity": activity})

        def execute() -> None:
            nonlocal current_activity
            try:
                result = run(report_activity)
                events.put({"type": "result", "data": result})
            except (AgentProviderError, ValueError) as exc:
                if current_activity:
                    failed_activity = {
                        **current_activity,
                        "status": "failed",
                        "output": {"error": str(exc)},
                    }
                    events.put({"type": "activity", "activity": failed_activity})
                events.put({"type": "error", "message": str(exc)})
            except Exception:
                logger.exception("Unexpected agent orchestration failure")
                if current_activity:
                    failed_activity = {
                        **current_activity,
                        "status": "failed",
                        "output": {"error": "Agent orchestration failed unexpectedly."},
                    }
                    events.put({"type": "activity", "activity": failed_activity})
                events.put({"type": "error", "message": "Agent orchestration failed unexpectedly."})

        worker = asyncio.create_task(asyncio.to_thread(execute))
        while True:
            try:
                event = events.get_nowait()
            except queue.Empty:
                if worker.done():
                    break
                await asyncio.sleep(0.025)
                continue
            yield encode_event(event)
            if event["type"] in {"result", "error"}:
                break
        await worker

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
