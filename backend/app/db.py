"""SQLite storage. Thin helper layer over the stdlib sqlite3 module.

A fresh connection per operation keeps things simple and thread-safe
(runs execute on background threads).
"""

import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL CHECK (language IN ('twi', 'ewe', 'cs')),
    category TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,          -- e.g. twi_01.wav
    language TEXT NOT NULL CHECK (language IN ('twi', 'ewe', 'cs')),
    prompt_id INTEGER REFERENCES prompts(id) ON DELETE SET NULL,
    duration_sec REAL NOT NULL DEFAULT 0,
    reference TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system TEXT NOT NULL,                   -- 'whisper' | 'mms'
    model TEXT NOT NULL,                    -- e.g. 'large-v3' | 'mms-1b-all'
    engine TEXT NOT NULL,                   -- 'runpod' | 'local'
    status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|done|failed|cancelled
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|running|done|failed
    hypothesis TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '',          -- detected language / adapter code
    latency_ms INTEGER,
    error TEXT NOT NULL DEFAULT '',
    UNIQUE (run_id, clip_id)
);
"""


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def rows_to_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]
