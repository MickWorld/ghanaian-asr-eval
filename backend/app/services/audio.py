"""Audio handling: convert uploads to 16 kHz mono WAV via ffmpeg, probe duration."""

import json
import subprocess
from pathlib import Path

from ..config import RAW_DIR, WAV_DIR


class AudioError(RuntimeError):
    pass


def convert_to_wav(raw_bytes: bytes, original_name: str, target_stem: str) -> tuple[Path, float]:
    """Save the original upload, convert to 16 kHz mono s16 WAV, return (wav_path, duration)."""
    suffix = Path(original_name).suffix.lower() or ".webm"
    raw_path = RAW_DIR / f"{target_stem}{suffix}"
    raw_path.write_bytes(raw_bytes)

    wav_path = WAV_DIR / f"{target_stem}.wav"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(raw_path),
        "-ac", "1", "-ar", "16000", "-sample_fmt", "s16",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raw_path.unlink(missing_ok=True)
        raise AudioError(f"ffmpeg failed: {result.stderr.strip()[:500]}")

    return wav_path, probe_duration(wav_path)


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return 0.0
    try:
        return round(float(json.loads(result.stdout)["format"]["duration"]), 2)
    except (KeyError, ValueError, json.JSONDecodeError):
        return 0.0


def delete_clip_files(stem: str) -> None:
    for p in RAW_DIR.glob(f"{stem}.*"):
        p.unlink(missing_ok=True)
    (WAV_DIR / f"{stem}.wav").unlink(missing_ok=True)
