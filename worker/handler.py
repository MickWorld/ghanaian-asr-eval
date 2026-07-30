"""RunPod serverless handler: Whisper (faster-whisper) + MMS on GPU.

Input (job["input"]):
    task      'whisper' | 'mms'
    audio_b64 base64-encoded WAV (16 kHz mono)
    model     whisper only: tiny|base|small|medium|large-v3 (default large-v3)
    adapter   mms only: ISO 639-3 adapter code, e.g. 'aka' or 'ewe'

Output:
    {"text": str, "meta": str}  or  {"error": str}

Models are lazy-loaded on first use and cached across invocations of a warm
worker. Whisper runs float16 on CUDA; MMS runs float16 on CUDA.
"""

import base64
import tempfile

import runpod

_cache: dict = {}


def _whisper(model_size: str, wav_path: str) -> dict:
    from faster_whisper import WhisperModel

    key = f"whisper:{model_size}"
    if key not in _cache:
        _cache[key] = WhisperModel(model_size, device="cuda", compute_type="float16")
    # Auto language detection on purpose: Whisper has no Akan/Ewe, and what it
    # thinks it heard is part of the evaluation.
    segments, info = _cache[key].transcribe(wav_path, beam_size=5)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return {"text": text, "meta": f"detected:{info.language} (p={info.language_probability:.2f})"}


def _mms(adapter: str, wav_path: str) -> dict:
    import librosa
    import torch
    from transformers import AutoProcessor, Wav2Vec2ForCTC

    model_id = "facebook/mms-1b-all"
    if "mms" not in _cache:
        processor = AutoProcessor.from_pretrained(model_id)
        model = Wav2Vec2ForCTC.from_pretrained(
            model_id, ignore_mismatched_sizes=True, torch_dtype=torch.float16
        ).to("cuda")
        model.eval()
        _cache["mms"] = (processor, model, {"adapter": None})
    processor, model, state = _cache["mms"]
    if state["adapter"] != adapter:
        processor.tokenizer.set_target_lang(adapter)
        model.load_adapter(adapter)
        state["adapter"] = adapter

    audio, _sr = librosa.load(wav_path, sr=16000, mono=True)
    inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
    inputs = {k: v.to("cuda", dtype=torch.float16) if v.dtype.is_floating_point else v.to("cuda")
              for k, v in inputs.items()}
    with torch.no_grad():
        logits = model(**inputs).logits
    ids = logits.argmax(dim=-1)[0]
    return {"text": processor.decode(ids).strip(), "meta": f"adapter:{adapter}"}


def handler(job):
    try:
        inp = job.get("input") or {}
        task = inp.get("task")
        audio_b64 = inp.get("audio_b64")
        if task not in ("whisper", "mms"):
            return {"error": f"task must be 'whisper' or 'mms', got {task!r}"}
        if not audio_b64:
            return {"error": "audio_b64 is required"}

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(base64.b64decode(audio_b64))
            wav_path = f.name

        if task == "whisper":
            return _whisper(inp.get("model") or "large-v3", wav_path)
        return _mms(inp.get("adapter") or "aka", wav_path)
    except Exception as exc:  # noqa: BLE001   report anything to the caller
        return {"error": f"{type(exc).__name__}: {exc}"}


runpod.serverless.start({"handler": handler})
