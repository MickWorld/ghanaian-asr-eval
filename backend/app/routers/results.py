"""Results endpoints: WER/CER summaries, per-clip diffs, findings export."""

from fastapi import APIRouter, HTTPException

from ..config import EXPORT_DIR
from ..db import connect, rows_to_dicts
from ..services.scoring import aggregate, score_pair

router = APIRouter(prefix="/api/results", tags=["results"])


def _scored_runs(run_ids: list[int] | None = None) -> list[dict]:
    """Score every completed transcription that has a non-empty reference."""
    with connect() as conn:
        query = """
            SELECT r.id AS run_id, r.system, r.model, r.engine, r.created_at,
                   t.hypothesis, t.meta, t.latency_ms, t.status,
                   c.id AS clip_id, c.filename, c.language, c.reference, c.duration_sec
            FROM runs r
            JOIN transcriptions t ON t.run_id = r.id
            JOIN clips c ON c.id = t.clip_id
            WHERE r.status IN ('done', 'failed', 'cancelled')
        """
        params: list = []
        if run_ids:
            query += f" AND r.id IN ({','.join('?' * len(run_ids))})"
            params = run_ids
        rows = rows_to_dicts(conn.execute(query + " ORDER BY r.id, c.filename", params).fetchall())

    scored = []
    for row in rows:
        if row["status"] != "done" or not row["reference"].strip():
            continue
        s = score_pair(row["reference"], row["hypothesis"])
        scored.append({**row, **s})
    return scored


@router.get("/summary")
def summary():
    """Per-run, per-language aggregate WER/CER. The dashboard's main data."""
    scored = _scored_runs()
    groups: dict[tuple, list] = {}
    run_info: dict[int, dict] = {}
    for s in scored:
        run_info[s["run_id"]] = {
            "run_id": s["run_id"], "system": s["system"], "model": s["model"],
            "engine": s["engine"], "created_at": s["created_at"],
        }
        for lang in (s["language"], "all"):
            groups.setdefault((s["run_id"], lang), []).append(s)

    out = []
    for (run_id, lang), pairs in sorted(groups.items()):
        agg = aggregate(pairs)
        out.append({**run_info[run_id], "language": lang, **agg})
    return out


@router.get("/comparisons/{run_id}")
def comparisons(run_id: int):
    """Every scored clip of a run with word-level alignment ops for highlighting."""
    with connect() as conn:
        run = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    if not run:
        raise HTTPException(404, "run not found")
    scored = _scored_runs([run_id])
    return {
        "run": dict(run),
        "clips": [
            {
                "clip_id": s["clip_id"], "filename": s["filename"], "language": s["language"],
                "reference": s["reference"], "hypothesis": s["hypothesis"], "meta": s["meta"],
                "latency_ms": s["latency_ms"], "duration_sec": s["duration_sec"],
                "wer": round(s["wer"], 4), "cer": round(s["cer"], 4),
                "word_counts": s["word_counts"], "ops": s["ops"],
            }
            for s in scored
        ],
    }


@router.post("/export")
def export_findings():
    """Generate a Markdown findings report from all completed runs."""
    scored = _scored_runs()
    if not scored:
        raise HTTPException(422, "nothing to export — complete a run with references first")

    lines = [
        "# Ghanaian ASR Evaluation — Findings",
        "",
        "Automated export from the ASR Workbench. WER/CER on self-recorded Twi, Ewe,",
        "and Twi–English code-switched clips, scored against native-speaker references.",
        "",
        "## Summary",
        "",
        "| System | Model | Engine | Language | Clips | WER | CER |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in summary():
        lines.append(
            f"| {row['system']} | {row['model']} | {row['engine']} | {row['language']} "
            f"| {row['clips']} | {row['wer']:.1%} | {row['cer']:.1%} |"
        )

    by_run: dict[int, list] = {}
    for s in scored:
        by_run.setdefault(s["run_id"], []).append(s)
    for run_id, items in sorted(by_run.items()):
        first = items[0]
        lines += ["", f"## Run {run_id}: {first['system']} {first['model']} ({first['engine']})", ""]
        for s in items:
            lines += [
                f"**{s['filename']}** ({s['language']}, WER {s['wer']:.1%})  ",
                f"- ref: `{s['reference']}`  ",
                f"- hyp: `{s['hypothesis'] or '(empty)'}`",
                "",
            ]

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / "findings.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return {"path": str(path), "markdown": "\n".join(lines)}
