import sqlite3

from pathlib import Path
from typing import Generator

DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "skillpilot.db"


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
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
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL UNIQUE,
                target_career TEXT NOT NULL DEFAULT '',
                password_hash TEXT,
                education TEXT NOT NULL DEFAULT '',
                academic_level TEXT NOT NULL DEFAULT '',
                institution TEXT NOT NULL DEFAULT '',
                experience TEXT NOT NULL DEFAULT '',
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
        learner_migrations = {
            "password_hash": "TEXT",
            "education": "TEXT NOT NULL DEFAULT ''",
            "academic_level": "TEXT NOT NULL DEFAULT ''",
            "institution": "TEXT NOT NULL DEFAULT ''",
            "experience": "TEXT NOT NULL DEFAULT ''",
            "certifications_json": "TEXT NOT NULL DEFAULT '[]'",
            "projects_json": "TEXT NOT NULL DEFAULT '[]'",
        }
        for column, definition in learner_migrations.items():
            if column not in learner_columns:
                connection.execute(f"ALTER TABLE learners ADD COLUMN {column} {definition}")

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
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS learners_email_unique ON learners(email)"
        )
