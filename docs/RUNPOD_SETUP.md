# RunPod GPU setup (optional)

The workbench runs fully on your PC's CPU. Use RunPod when you want
**Whisper large-v3** (much better on low-resource/accented speech) or faster
MMS runs. Serverless billing is per-second — evaluating ~30 short clips
typically costs **well under $1**.

You need: a [runpod.io](https://www.runpod.io) account, ~$10 credit, and a
[Docker Hub](https://hub.docker.com) account (free) to host the worker image.

## 1. Build and push the worker image

On any machine with Docker (Docker Desktop on Windows works; the image is
~18 GB because both models are baked in):

```bash
cd worker
docker build -t YOUR_DOCKERHUB_USER/ghana-asr-worker:v1 .
docker push YOUR_DOCKERHUB_USER/ghana-asr-worker:v1
```

> No Docker locally? Use RunPod's GitHub integration instead: push this repo
> to GitHub, then in RunPod choose **Serverless → New Endpoint → GitHub Repo**,
> point it at the repo with `worker/Dockerfile` as the Dockerfile path, and
> RunPod builds the image for you.

## 2. Create the serverless endpoint

1. RunPod console → **Serverless** → **New Endpoint**.
2. Container image: `YOUR_DOCKERHUB_USER/ghana-asr-worker:v1`.
3. GPU: **24 GB (e.g. RTX 4090 / L4 / A5000)** is plenty; 16 GB also works.
4. Workers: min **0** (scale to zero = pay nothing while idle), max **3**
   (the backend sends up to 4 clips in parallel).
5. Container disk: **25 GB** (the image holds both models).
6. Idle timeout: 60s or more — keeps the worker warm between clips of a run.
7. Create, then copy the **Endpoint ID** from the endpoint page.

## 3. Get an API key

RunPod console → **Settings** → **API Keys** → create a key (Read/Write).

## 4. Configure the workbench

Copy `.env.example` to `.env` in the project root and fill in:

```
RUNPOD_API_KEY=rpa_xxxxxxxxxxxxxxxx
RUNPOD_ENDPOINT_ID=abc123def456
```

Restart the backend. The Runs page will now show the **RunPod GPU** engine as
available, and `whisper large-v3` becomes selectable. First request after idle
takes ~1–3 min (cold start pulls the worker up); after that, seconds per clip.

## Cost notes

- Serverless GPU (~24 GB class) ≈ $0.00044/s only while a worker is active.
- A full pass (Whisper large-v3 + MMS over 30 clips) ≈ a few minutes of GPU
  time ≈ **$0.10–0.50**, plus cold starts.
- Set max workers to 1 if you prefer slower-but-cheapest sequential runs.
- Your Docker Hub image is public by default; it contains only open models
  and this repo's handler — no secrets. Keep your API key only in `.env`.

## Troubleshooting

- **Job stuck IN_QUEUE then times out** — endpoint has 0 max workers, no
  GPUs of the chosen type available, or the image failed to pull (check the
  endpoint's Logs tab).
- **`Worker error: ...` in the UI** — the handler returned an error; the exact
  message is stored on the failed clip in the Runs page. CUDA OOM → pick a
  bigger GPU or set Whisper model to `medium`.
- **First clip slow, rest fast** — normal: model load on cold start. Raise
  idle timeout to keep workers warm during a run.
