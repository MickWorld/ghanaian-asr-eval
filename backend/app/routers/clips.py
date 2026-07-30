"""Clip endpoints: upload (browser recording or file), list, edit reference, serve audio."""

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import WAV_DIR
from ..db import connect, rows_to_dicts
from ..services.audio import AudioError, convert_to_wav, delete_clip_files

router = APIRouter(prefix="/api/clips", tags=["clips"])


def next_stem(conn, language: str) -> str:
    """twi_01, twi_02, ... — scan existing filenames for the highest index."""
    rows = conn.execute(
        "SELECT filename FROM clips WHERE language = ?", (language,)
    ).fetchall()
    highest = 0
    for r in rows:
        stem = Path(r["filename"]).stem  # e.g. twi_07
        try:
            highest = max(highest, int(stem.rsplit("_", 1)[1]))
        except (IndexError, ValueError):
            continue
    return f"{language}_{highest + 1:02d}"


@router.get("")
def list_clips():
    with connect() as conn:
        rows = conn.execute(
            """SELECT c.*, p.text AS prompt_text, p.category AS prompt_category
               FROM clips c LEFT JOIN prompts p ON p.id = c.prompt_id
               ORDER BY c.language, c.filename"""
        ).fetchall()
    return rows_to_dicts(rows)


@router.post("")
async def upload_clip(
    file: UploadFile = File(...),
    language: str = Form(...),
    prompt_id: int | None = Form(None),
    reference: str = Form(""),
):
    if language not in ("twi", "ewe", "cs"):
        raise HTTPException(422, "language must be twi, ewe, or cs")
    raw = await file.read()
    if not raw:
        raise HTTPException(422, "empty upload")
    with connect() as conn:
        stem = next_stem(conn, language)
    try:
        wav_path, duration = convert_to_wav(raw, file.filename or "clip.webm", stem)
    except AudioError as exc:
        raise HTTPException(500, str(exc)) from exc
    with connect() as conn:
        cur = conn.execute(
            """INSERT INTO clips (filename, language, prompt_id, duration_sec, reference)
               VALUES (?, ?, ?, ?, ?)""",
            (wav_path.name, language, prompt_id, duration, reference.strip()),
        )
        row = conn.execute("SELECT * FROM clips WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


class ClipPatch(BaseModel):
    reference: str | None = None
    language: str | None = None
    prompt_id: int | None = None


@router.patch("/{clip_id}")
def patch_clip(clip_id: int, body: ClipPatch):
    with connect() as conn:
        row = conn.execute("SELECT * FROM clips WHERE id = ?", (clip_id,)).fetchone()
        if not row:
            raise HTTPException(404, "clip not found")
        if body.reference is not None:
            conn.execute("UPDATE clips SET reference = ? WHERE id = ?", (body.reference.strip(), clip_id))
        if body.language is not None:
            if body.language not in ("twi", "ewe", "cs"):
                raise HTTPException(422, "invalid language")
            conn.execute("UPDATE clips SET language = ? WHERE id = ?", (body.language, clip_id))
        if body.prompt_id is not None:
            conn.execute("UPDATE clips SET prompt_id = ? WHERE id = ?", (body.prompt_id, clip_id))
        row = conn.execute("SELECT * FROM clips WHERE id = ?", (clip_id,)).fetchone()
    return dict(row)


@router.delete("/{clip_id}")
def delete_clip(clip_id: int):
    with connect() as conn:
        row = conn.execute("SELECT filename FROM clips WHERE id = ?", (clip_id,)).fetchone()
        if not row:
            raise HTTPException(404, "clip not found")
        conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
    delete_clip_files(Path(row["filename"]).stem)
    return {"ok": True}


@router.get("/{clip_id}/audio")
def clip_audio(clip_id: int):
    with connect() as conn:
        row = conn.execute("SELECT filename FROM clips WHERE id = ?", (clip_id,)).fetchone()
    if not row:
        raise HTTPException(404, "clip not found")
    path = WAV_DIR / row["filename"]
    if not path.exists():
        raise HTTPException(404, "audio file missing on disk")
    return FileResponse(path, media_type="audio/wav", filename=row["filename"])
