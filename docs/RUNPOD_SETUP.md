# RunPod GPU setup (optional)

The workbench runs fully on your PC's CPU. Use RunPod when you want
**Whisper large-v3** (much better on low-resource/accented speech) or faster
MMS runs. Serverless billing is per-second - evaluating ~30 short clips
typically costs **well under $1**.

There are two independent pieces. Do the first one only, unless you also
want MMS on GPU:

| What | How | Difficulty |
| --- | --- | --- |
| **Whisper** (all sizes incl. large-v3) | One-click Hub template | Easy, 5 minutes |
| **MMS** (aka/ewe adapters) | This repo's custom worker | Medium, needs GitHub |

> **Warning - wrong template trap:** do NOT deploy Whisper through a
> **vLLM** quick-deploy. vLLM serves whisper as a text model and its RunPod
> wrapper has no audio route, so transcription requests fail with
> `BadRequestError` / "Invalid route". Use the **Faster Whisper** worker
> template instead.

## Part 1 - Whisper via the official image (easy)

> Stay in **Serverless**. Do NOT create a Pod - pods bill per hour even
> while idle, and this app cannot talk to them.

1. RunPod console → **Serverless** → **New Endpoint**.
2. Choose the **Docker image** source option and enter:
   `runpod/ai-api-faster-whisper:1.0.10`
   (If the Hub search shows "Faster Whisper" by runpod-workers as a
   *serverless* repo, that's the same thing - either works.)
3. Settings: tick **several GPU types** (RTX 4090 / L4 / A5000 / 4000 Ada -
   anything 16-24 GB), min workers **0**, max workers **3**, idle timeout
   **60 s**. If only one GPU type is ticked and it's unavailable, workers
   show `throttled` and jobs sit in queue forever.
4. Copy the **Endpoint ID** from the endpoint page into `.env`:

   ```text
   RUNPOD_API_KEY=rpa_...          (Settings → API Keys → Create)
   RUNPOD_ENDPOINT_ID=<the id>
   RUNPOD_WHISPER_WORKER=faster-whisper
   ```

5. Restart the backend. On the Runs page, pick Whisper → large-v3 →
   RunPod GPU. First job after idle takes 1-3 min (cold start); after that,
   seconds per clip.

## Part 2 - MMS via the custom worker (optional)

MMS must switch language adapters per clip (`aka` for Twi and code-switch,
`ewe` for Ewe). No stock template does this - it needs `worker/handler.py`
from this repo.

1. Push this repository to GitHub (public or private).
2. RunPod console → **Serverless** → **New Endpoint** → **GitHub Repo** →
   authorize and select your repo. Set the Dockerfile path to
   `worker/Dockerfile`. RunPod builds the image for you (~20-30 min first
   time - both models are baked in).
3. Same GPU settings as Part 1; container disk **25 GB**.
4. Copy that endpoint's ID into `.env`:

   ```text
   RUNPOD_MMS_ENDPOINT_ID=<the id>
   ```

5. Restart the backend - the RunPod GPU button now lights up for Meta MMS
   too.

(The custom worker also handles Whisper. If you prefer one endpoint for
everything, point `RUNPOD_ENDPOINT_ID` at it and set
`RUNPOD_WHISPER_WORKER=custom`.)

## Cost notes

- Serverless GPU (~24 GB class) is roughly $0.0004-0.0007/s, billed only
  while a worker is active.
- A full pass (Whisper large-v3 + MMS over 30 clips) is a few minutes of GPU
  time - **$0.10-0.50** plus cold starts.
- Min workers 0 means you pay nothing while idle.
- Keep your API key only in `.env` (git-ignored). If it leaks, revoke it in
  Settings → API Keys.

## Troubleshooting

- **Jobs stuck IN_QUEUE, health shows `throttled`** - the chosen GPU type
  has no capacity. Edit the endpoint and tick more GPU types.
- **`BadRequestError` / "Invalid route" on every clip** - you deployed a
  vLLM template. Delete it and deploy **Faster Whisper** (see warning above).
- **403 Forbidden when the app calls the endpoint** - the endpoint ID is
  wrong (copy it from the endpoint's page header) or your API key is
  restricted to different endpoints.
- **First clip slow, rest fast** - cold start; raise idle timeout to keep
  the worker warm through a run.
- **CUDA OOM on the custom worker** - pick a bigger GPU, or use Whisper
  medium instead of large-v3.
