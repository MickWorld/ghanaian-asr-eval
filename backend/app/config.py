"""Central configuration. Reads .env from the project root."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "audio" / "raw"
WAV_DIR = DATA_DIR / "audio" / "wav"
DB_PATH = DATA_DIR / "workbench.db"
EXPORT_DIR = DATA_DIR / "exports"

RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "").strip()
RUNPOD_ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID", "").strip()
RUNPOD_BASE_URL = "https://api.runpod.ai/v2"

# Seconds to wait for a single clip's transcription job (covers cold starts).
RUNPOD_JOB_TIMEOUT = int(os.getenv("RUNPOD_JOB_TIMEOUT", "600"))

for d in (RAW_DIR, WAV_DIR, EXPORT_DIR):
    d.mkdir(parents=True, exist_ok=True)
