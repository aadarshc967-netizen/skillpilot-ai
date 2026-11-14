import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import database
from backend.app.agents import (
    AgentOrchestrator,
    AgentProviderError,
    AgentRuntime,
    CareerMatch,
    LearningPath,
    LearningPathAgent,
    RoadmapPlanStep,
    SkillAnalysis,
    AssessmentResult,
)
from backend.app.main import app


@pytest.fixture(autouse=True)
def demo_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "")


@pytest.fixture
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(database, "DATABASE_PATH", tmp_path / "skillpilot-test.db")
    with TestClient(app) as test_client:
        yield test_client


def sample_skills() -> list[dict[str, object]]:
    return [
        {"name": "Python", "category": "Programming", "progress": 72, "is_gap": False, "priority": "—"},
        {"name": "SQL", "category": "Databases", "progress": 58, "is_gap": False, "priority": "—"},
        {"name": "HTML & CSS", "category": "Web fundamentals", "progress": 35, "is_gap": False, "priority": "—"},
        {"name": "JavaScript", "category": "Programming", "progress": 0, "is_gap": True, "priority": "High"},
        {"name": "React", "category": "Frontend framework", "progress": 0, "is_gap": True, "priority": "High"},
        {"name": "Node.js", "category": "Backend runtime", "progress": 0, "is_gap": True, "priority": "High"},
        {"name": "Git & GitHub", "category": "Developer tools", "progress": 0, "is_gap": True, "priority": "Medium"},
        {"name": "REST APIs", "category": "Backend concepts", "progress": 0, "is_gap": True, "priority": "Medium"},
    ]


def sample_roadmap() -> list[dict[str, object]]:
    return [
        {
            "id": 1,
            "title": "HTML & CSS essentials",
            "duration": "2 weeks",
            "lessons": 8,
            "description": "Build responsive interfaces.",
            "status": "complete",
            "position": 1,
            "exercises": ["Build a profile card"],
            "resources": ["https://developer.mozilla.org/en-US/docs/Learn"],
        },
        {
            "id": 2,
            "title": "JavaScript foundations",
            "duration": "3 weeks",
            "lessons": 12,
            "description": "Learn modern JavaScript.",
            "status": "in-progress",
            "position": 2,
            "exercises": ["Build a quiz"],
            "resources": ["https://javascript.info/first-steps"],
        },
        {
            "id": 3,
            "title": "Build with React",
            "duration": "4 weeks",
            "lessons": 16,
            "description": "Build interactive interfaces.",
            "status": "up-next",
            "position": 3,
            "exercises": ["Build a task list"],
            "resources": ["https://react.dev/learn"],
        },
    ]


def test_analysis_agents_run_in_sequence_and_pass_outputs() -> None:
    orchestrator = AgentOrchestrator(AgentRuntime())
    events: list[dict[str, object]] = []
    result = orchestrator.analyze(
        "Full Stack Developer",
        sample_skills(),
        sample_roadmap(),
        events.append,
    )

    completed = [event for event in events if event["status"] == "completed"]
    assert [event["agent"] for event in completed] == [
        "Skill Analyst Agent",
        "Career Matching Agent",
        "Learning Path Agent",
    ]
    assert result["mode"] == "demo"
    assert result["skill_analysis"]["skill_gaps"]
    assert "React" in result["career_match"]["missing_requirements"]
    assert "requirements" in result["career_match"]["formula"]
    assert result["learning_path"]["steps"]
    assert result["learning_path"]["steps"][0]["status"] == "complete"
    assert all(step["exercises"] and step["resources"] for step in result["learning_path"]["steps"])
    assert any(step["title"] == "Refresh HTML & CSS" for step in result["learning_path"]["steps"])
    assert completed[1]["output"]["requirement_scores"]


def test_poor_assessment_adds_targeted_step_before_existing_progress() -> None:
    orchestrator = AgentOrchestrator(AgentRuntime())
    events: list[dict[str, object]] = []
    previous = sample_roadmap()
    result = orchestrator.assess_and_adapt(
        "Full Stack Developer",
        sample_skills(),
        previous,
        [
            {"question_id": "js-scope", "answer": "const"},
            {"question_id": "js-array-map", "answer": "A number"},
            {"question_id": "js-promise", "answer": "catch()"},
        ],
        events.append,
    )

    assert result["assessment"]["score"] == 0
    assert result["assessment"]["weak_topics"] == [
        "JavaScript scope",
        "JavaScript arrays",
        "JavaScript promises",
    ]
    assert result["roadmap_changed"] is True
    updated = result["updated_roadmap"]["steps"]
    assert updated[0]["status"] == "complete"
    assert updated[1]["title"] == "Targeted practice: JavaScript scope"
    assert updated[1]["status"] == "in-progress"
    assert updated[1]["exercises"] and updated[1]["resources"]
    assert [event["agent"] for event in events if event["status"] == "completed"] == [
        "Assessment Agent",
        "Skill Analyst Agent",
        "Career Matching Agent",
        "Learning Path Agent",
    ]


def test_live_roadmap_adaptation_enforces_weak_topic_coverage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-used")
    runtime = AgentRuntime()
    model_path = LearningPath(
        summary="Model generated a short roadmap.",
        steps=[
            RoadmapPlanStep(
                id=1,
                title="Continue the course",
                duration="1 week",
                lessons=2,
                description="Continue with the next module.",
                status="in-progress",
                position=1,
                exercises=["Complete the next lesson"],
                resources=["https://developer.mozilla.org/"],
            )
        ],
    )
    monkeypatch.setattr(runtime, "generate", lambda _prompt, _output_type: model_path)
    assessment = AssessmentResult(
        score=0,
        total_questions=3,
        correct_count=0,
        weak_topics=["JavaScript scope", "JavaScript promises"],
        results=[],
        summary="Review the fundamentals.",
    )
    adapted = LearningPathAgent(runtime).adapt(
        "Full Stack Developer",
        SkillAnalysis(strengths=[], weaknesses=[], skill_gaps=[], summary="Analysis"),
        CareerMatch(
            score=0,
            formula="Test",
            requirement_scores=[],
            missing_requirements=[],
            explanation="Match",
        ),
        assessment,
        sample_roadmap(),
    )

    titles = [step.title for step in adapted.steps]
    assert titles[0] == "HTML & CSS essentials"
    assert "Targeted practice: JavaScript scope" in titles
    assert "Targeted practice: JavaScript promises" in titles
    assert adapted.steps[1].status == "in-progress"


def test_successful_assessment_does_not_insert_remedial_module() -> None:
    result = AgentOrchestrator(AgentRuntime()).assess_and_adapt(
        "Full Stack Developer",
        sample_skills(),
        sample_roadmap(),
        [
            {"question_id": "js-scope", "answer": "let"},
            {"question_id": "js-array-map", "answer": "A new transformed array"},
            {"question_id": "js-promise", "answer": "then()"},
        ],
    )
    assert result["assessment"]["score"] == 100
    assert result["assessment"]["weak_topics"] == []
    assert result["roadmap_changed"] is False
    assert len(result["updated_roadmap"]["steps"]) == len(sample_roadmap())


def test_http_assessment_stream_updates_persisted_roadmap(client: TestClient) -> None:
    response = client.post(
        "/api/agents/assessment",
        json={
            "answers": [
                {"question_id": "js-scope", "answer": "const"},
                {"question_id": "js-array-map", "answer": "A number"},
                {"question_id": "js-promise", "answer": "catch()"},
            ]
        },
    )
    assert response.status_code == 200
    event_data = [
        line.removeprefix("data: ").strip()
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    activities = [json.loads(line) for line in event_data]
    result = next(event["data"] for event in activities if event["type"] == "result")
    persisted_roadmap = client.get("/api/roadmap").json()

    assert result["mode"] == "demo"
    assert result["roadmap_changed"] is True
    assert persisted_roadmap[1]["title"] == "Targeted practice: JavaScript scope"
    assert persisted_roadmap[1]["exercises"]
    assert persisted_roadmap[1]["resources"]


def test_http_analysis_stream_returns_sequential_agent_outputs(client: TestClient) -> None:
    response = client.post(
        "/api/agents/analyze",
        json={"target_career": "Full Stack Developer"},
    )
    assert response.status_code == 200
    event_data = [
        json.loads(line.removeprefix("data: ").strip())
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    completed = [
        event["activity"]["agent"]
        for event in event_data
        if event["type"] == "activity" and event["activity"]["status"] == "completed"
    ]
    result = next(event["data"] for event in event_data if event["type"] == "result")
    persisted_roadmap = client.get("/api/roadmap").json()
    assert completed == [
        "Skill Analyst Agent",
        "Career Matching Agent",
        "Learning Path Agent",
    ]
    assert result["mode"] == "demo"
    assert result["career_match"]["score"] >= 0
    assert result["learning_path"]["steps"]
    assert [step["title"] for step in persisted_roadmap] == [
        step["title"] for step in result["learning_path"]["steps"]
    ]


def test_changing_career_regenerates_career_specific_roadmap(client: TestClient) -> None:
    updated = client.put(
        "/api/learner/career",
        json={"target_career": "Data Analyst"},
    )
    assert updated.status_code == 200
    response = client.post("/api/agents/analyze", json={})
    result_event = next(
        json.loads(line.removeprefix("data: ").strip())
        for line in response.text.splitlines()
        if line.startswith("data: ") and '"type": "result"' in line
    )
    roadmap_titles = [step["title"] for step in client.get("/api/roadmap").json()]
    assert result_event["data"]["career"] == "Data Analyst"
    assert any("Statistics" in title for title in roadmap_titles)
    assert any("Data visualization" in title for title in roadmap_titles)
    assert all("React" not in title and "JavaScript" not in title for title in roadmap_titles)
    role_skills = client.get("/api/skills").json()
    statistics = next(skill for skill in role_skills if skill["name"] == "Statistics")
    assert statistics["progress"] == 0
    assert statistics["is_gap"] is True


def test_http_agent_stream_reports_stage_failure(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingOrchestrator:
        def analyze(self, _career, _skills, _steps, on_activity, **_kwargs):
            on_activity({
                "agent": "Skill Analyst Agent",
                "task": "Analyze learner skills.",
                "status": "running",
                "output": None,
            })
            raise AgentProviderError("Gemini agent request failed; check backend logs.")

    monkeypatch.setattr("backend.app.main.AgentOrchestrator", FailingOrchestrator)
    response = client.post("/api/agents/analyze", json={})
    events = [
        json.loads(line.removeprefix("data: ").strip())
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    failed = next(
        event["activity"]
        for event in events
        if event["type"] == "activity" and event["activity"]["status"] == "failed"
    )
    assert failed["agent"] == "Skill Analyst Agent"
    assert events[-1]["type"] == "error"
    assert "Gemini agent request failed" in events[-1]["message"]


def test_mentor_demo_mode_is_explicit(client: TestClient) -> None:
    response = client.post("/api/mentor/chat", json={"question": "What should I learn next?"})
    assert response.status_code == 200
    assert response.json()["mode"] == "demo"
    assert response.json()["reply"].startswith("DEMO MODE:")


def test_profile_skills_roadmap_and_assessment_history_persist(client: TestClient) -> None:
    profile_response = client.put(
        "/api/learner/profile",
        json={
            "name": "Taylor Learner",
            "email": "taylor@example.com",
            "certifications": ["Python Basics"],
            "projects": ["Portfolio app"],
        },
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["certifications"] == ["Python Basics"]
    assert profile_response.json()["projects"] == ["Portfolio app"]
    assert client.get("/api/learner").json()["name"] == "Taylor Learner"

    skills = client.get("/api/skills").json()
    javascript = next(skill for skill in skills if skill["name"] == "JavaScript")
    updated_skill = client.put(
        f"/api/skills/{javascript['id']}",
        json={"progress": 70},
    )
    assert updated_skill.status_code == 200
    assert updated_skill.json()["level"] == "Intermediate"
    assert updated_skill.json()["is_gap"] is False

    roadmap = client.get("/api/roadmap").json()
    step = roadmap[1]
    saved_step = client.put(f"/api/roadmap/{step['id']}?status=complete")
    assert saved_step.status_code == 200
    assert next(item for item in client.get("/api/roadmap").json() if item["id"] == step["id"])["status"] == "complete"

    assessment = client.post(
        "/api/agents/assessment",
        json={
            "answers": [
                {"question_id": "js-scope", "answer": "const"},
                {"question_id": "js-array-map", "answer": "A number"},
                {"question_id": "js-promise", "answer": "catch()"},
            ]
        },
    )
    assert assessment.status_code == 200
    history = client.get("/api/assessments").json()
    assert len(history) == 1
    assert history[0]["score"] == 0
    assert "JavaScript arrays" in history[0]["weak_topics"]

    analysis = client.post("/api/agents/analyze", json={})
    result = next(
        json.loads(line.removeprefix("data: ").strip())["data"]
        for line in analysis.text.splitlines()
        if line.startswith("data: ") and '"type": "result"' in line
    )
    assert "1 certifications" in result["skill_analysis"]["summary"]
    assert "1 projects" in result["skill_analysis"]["summary"]
    javascript_gap = next(
        item for item in (
            result["skill_analysis"]["skill_gaps"]
            + result["skill_analysis"]["weaknesses"]
            + result["skill_analysis"]["strengths"]
        )
        if item["name"] == "JavaScript"
    )
    assert "assessment results" in javascript_gap["reason"].lower()


def test_profile_fields_migrate_on_existing_database(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "existing-profile.db"
    monkeypatch.setattr(database, "DATABASE_PATH", path)
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE learners (id INTEGER PRIMARY KEY, name TEXT, email TEXT, target_career TEXT);
            INSERT INTO learners VALUES (1, 'Jordan Miller', 'jordan@example.com', 'Full Stack Developer');
            """
        )

    database.initialize_database()
    with sqlite3.connect(path) as connection:
        learner_columns = {row[1] for row in connection.execute("PRAGMA table_info(learners)")}
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        profile = connection.execute(
            "SELECT certifications_json, projects_json FROM learners WHERE id = 1"
        ).fetchone()
    assert {"certifications_json", "projects_json"} <= learner_columns
    assert "assessment_attempts" in tables
    assert profile == ("[]", "[]")


def test_database_connection_can_cross_fastapi_worker_threads(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(database, "DATABASE_PATH", tmp_path / "threaded.db")
    connection = database.get_connection()
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            result = executor.submit(
                lambda: connection.execute("SELECT 1").fetchone()[0]
            ).result()
        assert result == 1
    finally:
        connection.close()


def test_provider_diagnostics_keep_status_and_redact_api_key(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    secret = "test-dummy-api-key-not-real"
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    runtime = AgentRuntime()

    class ProviderFailure(Exception):
        code = 404
        status = "NOT_FOUND"
        message = f"Model unavailable (credential {secret})"

    runtime._log_provider_error("test", ProviderFailure())
    assert "provider_code=404" in caplog.text
    assert "provider_status=NOT_FOUND" in caplog.text
    assert "[REDACTED]" in caplog.text
    assert secret not in caplog.text


def test_assessment_rejects_duplicate_or_partial_submissions() -> None:
    from backend.app.agents import AssessmentAgent

    agent = AssessmentAgent(AgentRuntime())
    with pytest.raises(ValueError, match="only be answered once"):
        agent.run([
            {"question_id": "js-scope", "answer": "let"},
            {"question_id": "js-scope", "answer": "let"},
            {"question_id": "js-promise", "answer": "then()"},
        ])
    with pytest.raises(ValueError, match="every assessment question"):
        agent.run([{"question_id": "js-scope", "answer": "let"}])


def test_live_gemini_failure_activates_labeled_demo_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-used")

    class BrokenModels:
        @staticmethod
        def generate_content(**_kwargs: object) -> None:
            raise RuntimeError("provider unavailable")

    class BrokenClient:
        models = BrokenModels()

    runtime = AgentRuntime()
    runtime._client = BrokenClient()
    assert runtime.demo_mode is False
    with pytest.raises(AgentProviderError, match="Gemini agent request failed"):
        runtime.generate("test", SkillAnalysis)
    assert runtime.demo_mode is True
    assert runtime.fallback_reason is not None


def test_orchestrator_continues_in_demo_after_gemini_quota_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-used")

    class QuotaLimitedModels:
        @staticmethod
        def generate_content(**_kwargs: object) -> None:
            raise RuntimeError("429 quota exceeded")

    runtime = AgentRuntime()
    runtime._client = type("QuotaLimitedClient", (), {"models": QuotaLimitedModels()})()
    activities: list[dict[str, object]] = []
    result = AgentOrchestrator(runtime).analyze(
        "Full Stack Developer",
        sample_skills(),
        sample_roadmap(),
        activities.append,
    )

    assert result["mode"] == "demo"
    assert result["mode_reason"] == "Gemini is unavailable or over quota; deterministic demo mode is active."
    assert len([activity for activity in activities if activity["status"] == "completed"]) == 3
    assert result["learning_path"]["steps"]


def test_existing_sqlite_roadmap_schema_is_migrated_without_data_loss(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "existing.db"
    monkeypatch.setattr(database, "DATABASE_PATH", path)
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE learners (id INTEGER PRIMARY KEY, name TEXT, email TEXT, target_career TEXT);
            CREATE TABLE skills (
                id INTEGER PRIMARY KEY, learner_id INTEGER, name TEXT, category TEXT,
                level TEXT, progress INTEGER, is_gap INTEGER, priority TEXT
            );
            CREATE TABLE roadmap_steps (
                id INTEGER PRIMARY KEY, learner_id INTEGER, title TEXT, duration TEXT,
                lessons INTEGER, description TEXT, status TEXT, position INTEGER
            );
            INSERT INTO learners VALUES (1, 'Jordan Miller', 'jordan@example.com', 'Full Stack Developer');
            INSERT INTO roadmap_steps VALUES (1, 1, 'Existing step', '1 week', 2, 'Keep me', 'in-progress', 1);
            """
        )

    database.initialize_database()
    with sqlite3.connect(path) as connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(roadmap_steps)")}
        existing_step = connection.execute(
            "SELECT title, description FROM roadmap_steps WHERE id = 1"
        ).fetchone()
    assert {"exercises_json", "resources_json"} <= columns
    assert existing_step == ("Existing step", "Keep me")
