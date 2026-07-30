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
RUNPOD_BASE_URL = "https://api.runpod.ai/v2"

# Whisper endpoint: either the official "Faster Whisper" Hub worker
# (RUNPOD_WHISPER_WORKER=faster-whisper) or this repo's worker/handler.py
# (RUNPOD_WHISPER_WORKER=custom).
RUNPOD_WHISPER_ENDPOINT_ID = (
    os.getenv("RUNPOD_WHISPER_ENDPOINT_ID", "") or os.getenv("RUNPOD_ENDPOINT_ID", "")
).strip()
RUNPOD_WHISPER_WORKER = os.getenv("RUNPOD_WHISPER_WORKER", "faster-whisper").strip().lower()

# MMS needs per-clip adapter switching (aka/ewe), which only this repo's
# custom worker supports. Leave empty to run MMS locally instead.
RUNPOD_MMS_ENDPOINT_ID = os.getenv("RUNPOD_MMS_ENDPOINT_ID", "").strip()

# Seconds to wait for a single clip's transcription job (covers cold starts).
RUNPOD_JOB_TIMEOUT = int(os.getenv("RUNPOD_JOB_TIMEOUT", "600"))

for d in (RAW_DIR, WAV_DIR, EXPORT_DIR):
    d.mkdir(parents=True, exist_ok=True)
