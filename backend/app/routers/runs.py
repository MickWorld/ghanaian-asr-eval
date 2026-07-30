"""Run endpoints: launch evaluation runs, poll progress, cancel."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import connect, rows_to_dicts
from ..services.executor import cancel_run, start_run

router = APIRouter(prefix="/api/runs", tags=["runs"])

VALID_SYSTEMS = {
    "whisper": {"tiny", "base", "small", "medium", "large-v3"},
    "mms": {"mms-1b-all"},
}


class RunIn(BaseModel):
    system: str            # 'whisper' | 'mms'
    model: str             # e.g. 'large-v3' or 'mms-1b-all'
    engine: str            # 'runpod' | 'local'
    clip_ids: list[int] | None = None   # None = all clips


@router.post("")
def create_run(body: RunIn):
    if body.system not in VALID_SYSTEMS:
        raise HTTPException(422, f"system must be one of {sorted(VALID_SYSTEMS)}")
    if body.model not in VALID_SYSTEMS[body.system]:
        raise HTTPException(422, f"model must be one of {sorted(VALID_SYSTEMS[body.system])}")
    if body.engine not in ("runpod", "local"):
        raise HTTPException(422, "engine must be 'runpod' or 'local'")

    with connect() as conn:
        if body.clip_ids:
            marks = ",".join("?" * len(body.clip_ids))
            clips = conn.execute(f"SELECT id FROM clips WHERE id IN ({marks})", body.clip_ids).fetchall()
        else:
            clips = conn.execute("SELECT id FROM clips").fetchall()
        if not clips:
            raise HTTPException(422, "no clips to transcribe — record some first")
        cur = conn.execute(
            "INSERT INTO runs (system, model, engine) VALUES (?, ?, ?)",
            (body.system, body.model, body.engine),
        )
        run_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO transcriptions (run_id, clip_id) VALUES (?, ?)",
            [(run_id, c["id"]) for c in clips],
        )
    start_run(run_id)
    return get_run(run_id)


@router.get("")
def list_runs():
    with connect() as conn:
        rows = conn.execute(
            """SELECT r.*,
                      COUNT(t.id) AS total,
                      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
                      SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed
               FROM runs r LEFT JOIN transcriptions t ON t.run_id = r.id
               GROUP BY r.id ORDER BY r.id DESC"""
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/{run_id}")
def get_run(run_id: int):
    with connect() as conn:
        run = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise HTTPException(404, "run not found")
        items = conn.execute(
            """SELECT t.*, c.filename, c.language, c.reference
               FROM transcriptions t JOIN clips c ON c.id = t.clip_id
               WHERE t.run_id = ? ORDER BY c.filename""",
            (run_id,),
        ).fetchall()
    return {"run": dict(run), "items": rows_to_dicts(items)}


@router.post("/{run_id}/cancel")
def cancel(run_id: int):
    if not cancel_run(run_id):
        raise HTTPException(409, "run is not currently executing")
    return {"ok": True}


@router.delete("/{run_id}")
def delete_run(run_id: int):
    with connect() as conn:
        cur = conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "run not found")
    return {"ok": True}
