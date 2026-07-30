"""Executes evaluation runs on background threads.

One thread per run; each clip's transcription status is written to SQLite as
it progresses, so the frontend can poll GET /api/runs/{id} for live progress.
For RunPod runs, clips are processed with a small worker pool   serverless
workers scale out, so parallel requests finish much faster.
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..config import WAV_DIR
from ..db import connect
from .engines import EngineError, transcribe

_cancel_flags: dict[int, threading.Event] = {}


def start_run(run_id: int) -> None:
    _cancel_flags[run_id] = threading.Event()
    threading.Thread(target=_execute, args=(run_id,), daemon=True).start()


def cancel_run(run_id: int) -> bool:
    flag = _cancel_flags.get(run_id)
    if flag:
        flag.set()
        return True
    return False


def _execute(run_id: int) -> None:
    with connect() as conn:
        run = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        items = conn.execute(
            """SELECT t.id AS tid, c.id AS cid, c.filename, c.language
               FROM transcriptions t JOIN clips c ON c.id = t.clip_id
               WHERE t.run_id = ? ORDER BY c.filename""",
            (run_id,),
        ).fetchall()
        conn.execute("UPDATE runs SET status = 'running' WHERE id = ?", (run_id,))

    if not run:
        return
    system, model, engine = run["system"], run["model"], run["engine"]
    cancel = _cancel_flags[run_id]

    def process(item) -> None:
        if cancel.is_set():
            return
        with connect() as conn:
            conn.execute("UPDATE transcriptions SET status = 'running' WHERE id = ?", (item["tid"],))
        wav_path = WAV_DIR / item["filename"]
        started = time.monotonic()
        try:
            if not wav_path.exists():
                raise EngineError(f"WAV file missing: {wav_path.name}")
            result = transcribe(engine, system, model, wav_path, item["language"])
            latency = int((time.monotonic() - started) * 1000)
            with connect() as conn:
                conn.execute(
                    """UPDATE transcriptions
                       SET status = 'done', hypothesis = ?, meta = ?, latency_ms = ?, error = ''
                       WHERE id = ?""",
                    (result["text"], result["meta"], latency, item["tid"]),
                )
        except Exception as exc:  # noqa: BLE001   record any failure per clip
            latency = int((time.monotonic() - started) * 1000)
            with connect() as conn:
                conn.execute(
                    "UPDATE transcriptions SET status = 'failed', error = ?, latency_ms = ? WHERE id = ?",
                    (str(exc)[:1000], latency, item["tid"]),
                )

    try:
        if engine == "runpod":
            # Parallel: serverless endpoint scales workers horizontally.
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(process, items))
        else:
            # Local CPU: strictly sequential   models share one machine.
            for item in items:
                process(item)
    finally:
        with connect() as conn:
            failed = conn.execute(
                "SELECT COUNT(*) FROM transcriptions WHERE run_id = ? AND status = 'failed'",
                (run_id,),
            ).fetchone()[0]
            pending = conn.execute(
                "SELECT COUNT(*) FROM transcriptions WHERE run_id = ? AND status IN ('pending','running')",
                (run_id,),
            ).fetchone()[0]
            if cancel.is_set():
                status, error = "cancelled", ""
            elif failed and failed == len(items):
                first_err = conn.execute(
                    "SELECT error FROM transcriptions WHERE run_id = ? AND status = 'failed' LIMIT 1",
                    (run_id,),
                ).fetchone()
                status, error = "failed", (first_err["error"] if first_err else "all clips failed")
            elif pending:
                status, error = "failed", "run ended with unprocessed clips"
            else:
                status, error = "done", ""
            conn.execute(
                "UPDATE runs SET status = ?, error = ?, finished_at = datetime('now') WHERE id = ?",
                (status, error, run_id),
            )
        _cancel_flags.pop(run_id, None)
