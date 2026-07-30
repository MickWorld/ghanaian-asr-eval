"""Prompt list CRUD   the sentences/topics shown on the Record page."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import connect, rows_to_dicts

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptIn(BaseModel):
    language: str
    category: str = ""
    text: str
    position: int = 0


@router.get("")
def list_prompts():
    with connect() as conn:
        rows = conn.execute(
            """SELECT p.*, c.id AS recorded_clip_id, c.filename AS recorded_filename
               FROM prompts p
               LEFT JOIN clips c ON c.prompt_id = p.id
               ORDER BY p.language, p.position, p.id"""
        ).fetchall()
    return rows_to_dicts(rows)


@router.post("")
def create_prompt(body: PromptIn):
    if body.language not in ("twi", "ewe", "cs"):
        raise HTTPException(422, "language must be twi, ewe, or cs")
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO prompts (language, category, text, position) VALUES (?, ?, ?, ?)",
            (body.language, body.category, body.text, body.position),
        )
        row = conn.execute("SELECT * FROM prompts WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.put("/{prompt_id}")
def update_prompt(prompt_id: int, body: PromptIn):
    with connect() as conn:
        cur = conn.execute(
            "UPDATE prompts SET language = ?, category = ?, text = ?, position = ? WHERE id = ?",
            (body.language, body.category, body.text, body.position, prompt_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "prompt not found")
        row = conn.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,)).fetchone()
    return dict(row)


@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: int):
    with connect() as conn:
        cur = conn.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "prompt not found")
    return {"ok": True}
