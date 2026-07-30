"""Ghana ASR Workbench   FastAPI backend.

Run:  uvicorn app.main:app --reload --port 8000   (from backend/)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import clips, prompts, results, runs
from .seed import seed_prompts
from .services.engines import engine_status

app = FastAPI(title="Ghana ASR Workbench")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
seed_prompts()

app.include_router(prompts.router)
app.include_router(clips.router)
app.include_router(runs.router)
app.include_router(results.router)


@app.get("/api/health")
def health():
    return {"ok": True, "engines": engine_status()}
