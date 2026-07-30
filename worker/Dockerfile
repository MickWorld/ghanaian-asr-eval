# RunPod serverless worker: Whisper large-v3 (faster-whisper) + MMS-1b-all on GPU.
# Models are baked into the image so cold starts skip the multi-GB download.

FROM runpod/base:0.6.2-cuda12.1.0

WORKDIR /app
COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements.txt

# Pre-download models into the image.
RUN python3.11 -c "\
from faster_whisper import WhisperModel; \
WhisperModel('large-v3', device='cpu', compute_type='int8')"
RUN python3.11 -c "\
from transformers import AutoProcessor, Wav2Vec2ForCTC; \
AutoProcessor.from_pretrained('facebook/mms-1b-all'); \
m = Wav2Vec2ForCTC.from_pretrained('facebook/mms-1b-all', ignore_mismatched_sizes=True); \
m.load_adapter('aka'); m.load_adapter('ewe')"

COPY handler.py .
CMD ["python3.11", "-u", "handler.py"]
