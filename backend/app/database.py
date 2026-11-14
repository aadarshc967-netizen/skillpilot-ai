import sqlite3
import json
from pathlib import Path
from typing import Generator

DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "skillpilot.db"


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def get_db() -> Generator[sqlite3.Connection, None, None]:
    connection = get_connection()
    try:
        yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS learners (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                target_career TEXT NOT NULL,
                certifications_json TEXT NOT NULL DEFAULT '[]',
                projects_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY,
                learner_id INTEGER NOT NULL REFERENCES learners(id),
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                level TEXT NOT NULL,
                progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
                is_gap INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'Medium'
            );

            CREATE TABLE IF NOT EXISTS roadmap_steps (
                id INTEGER PRIMARY KEY,
                learner_id INTEGER NOT NULL REFERENCES learners(id),
                title TEXT NOT NULL,
                duration TEXT NOT NULL,
                lessons INTEGER NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                position INTEGER NOT NULL,
                exercises_json TEXT NOT NULL DEFAULT '[]',
                resources_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS assessment_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id INTEGER NOT NULL REFERENCES learners(id),
                target_career TEXT NOT NULL,
                score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                weak_topics_json TEXT NOT NULL DEFAULT '[]',
                results_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        learner_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(learners)")
        }
        if "certifications_json" not in learner_columns:
            connection.execute(
                "ALTER TABLE learners ADD COLUMN certifications_json TEXT NOT NULL DEFAULT '[]'"
            )
        if "projects_json" not in learner_columns:
            connection.execute(
                "ALTER TABLE learners ADD COLUMN projects_json TEXT NOT NULL DEFAULT '[]'"
            )

        roadmap_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(roadmap_steps)")
        }
        if "exercises_json" not in roadmap_columns:
            connection.execute(
                "ALTER TABLE roadmap_steps ADD COLUMN exercises_json TEXT NOT NULL DEFAULT '[]'"
            )
        if "resources_json" not in roadmap_columns:
            connection.execute(
                "ALTER TABLE roadmap_steps ADD COLUMN resources_json TEXT NOT NULL DEFAULT '[]'"
            )

        learner_count = connection.execute(
            "SELECT COUNT(*) FROM learners"
        ).fetchone()[0]
        if learner_count:
            return

        connection.execute(
            """
            INSERT INTO learners (id, name, email, target_career)
            VALUES (1, 'Jordan Miller', 'jordan.miller@example.com', 'Full Stack Developer')
            """
        )
        connection.executemany(
            """
            INSERT INTO skills
                (learner_id, name, category, level, progress, is_gap, priority)
            VALUES (1, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("Python", "Programming", "Intermediate", 72, 0, "—"),
                ("SQL", "Databases", "Intermediate", 58, 0, "—"),
                ("HTML & CSS", "Web fundamentals", "Beginner", 35, 0, "—"),
                ("JavaScript", "Programming", "Not started", 0, 1, "High"),
                ("React", "Frontend framework", "Not started", 0, 1, "High"),
                ("Node.js", "Backend runtime", "Not started", 0, 1, "High"),
                ("Git & GitHub", "Developer tools", "Not started", 0, 1, "Medium"),
                ("REST APIs", "Backend concepts", "Not started", 0, 1, "Medium"),
            ],
        )
        connection.executemany(
            """
            INSERT INTO roadmap_steps
                (learner_id, title, duration, lessons, description, status, position,
                 exercises_json, resources_json)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "HTML & CSS essentials",
                    "2 weeks",
                    8,
                    "Build accessible, responsive pages and get comfortable with the building blocks of the web.",
                    "complete",
                    1,
                    json.dumps(["Recreate a responsive profile card from a design"]),
                    json.dumps(["https://developer.mozilla.org/en-US/docs/Learn"]),
                ),
                (
                    "JavaScript foundations",
                    "3 weeks",
                    12,
                    "Learn modern JavaScript, from variables and functions through async code and browser APIs.",
                    "in-progress",
                    2,
                    json.dumps(["Build a quiz with arrays and functions", "Practice scope with small code snippets"]),
                    json.dumps(["https://javascript.info/first-steps", "https://developer.mozilla.org/en-US/docs/Web/JavaScript"]),
                ),
                (
                    "Build with React",
                    "4 weeks",
                    16,
                    "Turn your JavaScript into interactive interfaces with components, hooks, and state.",
                    "up-next",
                    3,
                    json.dumps(["Build a reusable task-list component"]),
                    json.dumps(["https://react.dev/learn"]),
                ),
                (
                    "Backend with Node.js",
                    "3 weeks",
                    11,
                    "Create a server, design REST APIs, and connect your app to a database.",
                    "locked",
                    4,
                    json.dumps(["Build a REST endpoint for a small notes app"]),
                    json.dumps(["https://nodejs.org/en/learn"]),
                ),
            ],
        )
