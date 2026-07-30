"""Transcription engines.

Two interchangeable backends behind one function signature:

    transcribe(engine, system, model, wav_path, language_group) -> {text, meta}

- 'runpod': submits the clip (base64) to a RunPod serverless endpoint running
  worker/handler.py, then polls until the job completes. Handles cold starts.
- 'local':  runs Whisper / MMS on this machine's CPU. Heavy deps (torch,
  openai-whisper, transformers) are imported lazily so the backend starts
  without them; install backend/requirements-local.txt to enable.

language_group is the clip's group: 'twi' | 'ewe' | 'cs'. MMS has no
code-switching mode, so 'cs' clips use the Akan adapter — how it fails there
is part of what we measure.
"""

import base64
import time

import httpx

from ..config import RUNPOD_API_KEY, RUNPOD_BASE_URL, RUNPOD_ENDPOINT_ID, RUNPOD_JOB_TIMEOUT

MMS_ADAPTERS = {"twi": "aka", "ewe": "ewe", "cs": "aka"}


class EngineError(RuntimeError):
    pass


def transcribe(engine: str, system: str, model: str, wav_path, language_group: str) -> dict:
    if engine == "runpod":
        return _transcribe_runpod(system, model, wav_path, language_group)
    if engine == "local":
        return _transcribe_local(system, model, wav_path, language_group)
    raise EngineError(f"Unknown engine '{engine}'")


def engine_status() -> dict:
    """What can this installation actually run? Drives UI affordances."""
    local_whisper = local_mms = False
    try:
        import faster_whisper  # noqa: F401
        local_whisper = True
    except ImportError:
        pass
    try:
        import transformers  # noqa: F401
        import torch  # noqa: F401
        local_mms = True
    except ImportError:
        pass
    return {
        "runpod_configured": bool(RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID),
        "local_whisper": local_whisper,
        "local_mms": local_mms,
    }


# ---------------------------------------------------------------- RunPod ----

def _transcribe_runpod(system: str, model: str, wav_path, language_group: str) -> dict:
    if not (RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID):
        raise EngineError(
            "RunPod is not configured. Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID "
            "in the .env file (see docs/RUNPOD_SETUP.md)."
        )
    payload = {
        "input": {
            "task": system,
            "model": model,
            "audio_b64": base64.b64encode(wav_path.read_bytes()).decode(),
            "adapter": MMS_ADAPTERS.get(language_group, "aka"),
        }
    }
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}
    base = f"{RUNPOD_BASE_URL}/{RUNPOD_ENDPOINT_ID}"

    with httpx.Client(timeout=60) as client:
        resp = client.post(f"{base}/run", json=payload, headers=headers)
        if resp.status_code != 200:
            raise EngineError(f"RunPod submit failed ({resp.status_code}): {resp.text[:300]}")
        job_id = resp.json().get("id")
        if not job_id:
            raise EngineError(f"RunPod returned no job id: {resp.text[:300]}")

        deadline = time.monotonic() + RUNPOD_JOB_TIMEOUT
        while time.monotonic() < deadline:
            time.sleep(2)
            status = client.get(f"{base}/status/{job_id}", headers=headers)
            if status.status_code != 200:
                continue
            data = status.json()
            state = data.get("status")
            if state == "COMPLETED":
                output = data.get("output") or {}
                if "error" in output:
                    raise EngineError(f"Worker error: {output['error']}")
                return {"text": output.get("text", ""), "meta": output.get("meta", "")}
            if state in ("FAILED", "CANCELLED", "TIMED_OUT"):
                raise EngineError(f"RunPod job {state}: {str(data.get('error'))[:300]}")
        client.post(f"{base}/cancel/{job_id}", headers=headers)
    raise EngineError(f"RunPod job timed out after {RUNPOD_JOB_TIMEOUT}s (cold start too slow?)")


# ----------------------------------------------------------------- Local ----

_local_cache: dict = {}


def _transcribe_local(system: str, model: str, wav_path, language_group: str) -> dict:
    if system == "whisper":
        return _local_whisper(model, wav_path)
    if system == "mms":
        return _local_mms(wav_path, MMS_ADAPTERS.get(language_group, "aka"))
    raise EngineError(f"Unknown system '{system}'")


def _local_whisper(model_size: str, wav_path) -> dict:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise EngineError(
            "Local Whisper not installed. Run: pip install -r backend/requirements.txt"
        ) from None
    key = f"whisper:{model_size}"
    if key not in _local_cache:
        _local_cache[key] = WhisperModel(model_size, device="cpu", compute_type="int8")
    # No language forced: Whisper does not support Akan/Ewe, so what it
    # auto-detects is itself a finding.
    segments, info = _local_cache[key].transcribe(str(wav_path), beam_size=5)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return {"text": text, "meta": f"detected:{info.language} (p={info.language_probability:.2f})"}


def _local_mms(wav_path, adapter: str) -> dict:
    try:
        import librosa
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC
    except ImportError:
        raise EngineError(
            "Local MMS not installed. Run: pip install -r backend/requirements.txt"
        ) from None
    model_id = "facebook/mms-1b-all"
    if "mms" not in _local_cache:
        processor = AutoProcessor.from_pretrained(model_id)
        model = Wav2Vec2ForCTC.from_pretrained(model_id, ignore_mismatched_sizes=True)
        model.eval()
        _local_cache["mms"] = (processor, model, {"adapter": None})
    processor, model, state = _local_cache["mms"]
    if state["adapter"] != adapter:
        processor.tokenizer.set_target_lang(adapter)
        model.load_adapter(adapter)
        state["adapter"] = adapter
    audio, _sr = librosa.load(wav_path, sr=16000, mono=True)
    inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits
    ids = torch.argmax(logits, dim=-1)[0]
    return {"text": processor.decode(ids).strip(), "meta": f"adapter:{adapter}"}
