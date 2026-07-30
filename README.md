# Ghana ASR Workbench

**How well do today's speech recognition models actually handle Ghanaian languages?**

This is a complete research workbench for answering that question with real
evidence. You record yourself speaking **Twi (Akan)**, **Ewe**, and the natural
**Twi–English code-switching** heard every day in Accra, then run two of the
world's most widely used multilingual speech recognition systems over your
recordings and see — precisely, word by word — what they got right and where
they fall apart.

The two systems under test:

| System | Who makes it | Claim about Ghanaian languages |
| --- | --- | --- |
| **Whisper** | OpenAI | Akan and Ewe are **not on its language list at all** — so we let it guess, and what it guesses is itself a finding |
| **MMS** (mms-1b-all) | Meta | Claims support for 1,100+ languages **including Akan (`aka`) and Ewe (`ewe`)** via per-language adapters |

Marketing claims and reality are not the same thing. This tool measures the gap.

---

## What this app actually is

A small website that runs entirely **on your own computer**. Nothing is
uploaded anywhere unless you choose to plug in RunPod (explained below). It has
four pages, which follow the four stages of the work:

### 1. Record

Prompt cards suggest a topic ("Bargain for tomatoes at the market", "Explain a
MoMo failed transaction") in three groups: Twi, Ewe, and code-switch. Click
**Record**, speak a natural sentence *in your own words*, listen back, retake
if needed, save. The app converts every recording to the 16 kHz mono WAV
format the models expect and names files automatically (`twi_01.wav`,
`ewe_01.wav`, `cs_01.wav`, …).

The prompts are deliberately *topics in English*, not scripts to read aloud.
Read-aloud speech sounds unnatural, and any script I bake in could contain
wrong orthography. You speak naturally; you are the ground truth.

You can add your own topics, remove seeded ones, or use **Free recording** to
say anything at all.

### 2. Clips & References

For each clip, play it back and type **exactly what you said** — every word,
in proper orthography. This typed text is the *reference transcript*: the
"correct answer" the models are graded against, so type it carefully.
A character bar at the top inserts the letters a QWERTY keyboard lacks:
**ɛ ɔ ƒ ɖ ŋ ʋ** (and capitals). Click into a reference box, then click a
character to insert it at the cursor. Text saves automatically when you click
away.

### 3. Runs

Pick a system (Whisper or MMS), a model size (Whisper only: tiny → large-v3),
and an engine (Local CPU or RunPod GPU), then **Launch run**. The app
transcribes every clip and shows live per-clip progress. You can cancel a run,
inspect any clip's raw output, and see the exact error message if a clip fails.

Two behaviours are intentional and worth understanding:

- **Whisper is never told what language the audio is.** It has no Akan or Ewe
  mode, so we let it auto-detect and record what it *thought* it heard
  (shown as e.g. `detected:en (p=0.42)`). When Whisper labels your Twi as
  English or Swahili, that is data, not a bug.
- **Code-switched clips run MMS with the Akan adapter.** MMS has no
  code-switching mode — you must pick one language adapter. How the Akan
  adapter mangles the English words inside your Twi sentences is exactly one
  of the things this project measures.

### 4. Results

Once a run finishes (and its clips have references), you get:

- **Best-WER tiles** — the headline number per language.
- **A comparison chart** — WER or CER per language, up to 4 runs side by side
  (e.g. Whisper small vs. Whisper large-v3 vs. MMS), with an exact-values
  table view.
- **The error explorer** — every clip shown word by word:
  ~~deleted words~~ in red strikethrough (the model dropped them),
  substituted words in amber with what you actually said in brackets,
  inserted words in green (the model hallucinated them). The audio player sits
  right next to the text so you can listen while you read.
- **Export findings.md** — one click generates a Markdown report (summary
  table + every reference/hypothesis pair) you can commit to a repo, send to a
  supervisor, or paste into a paper draft.

---

## The numbers, in plain language

- **WER (Word Error Rate)** — out of the words you actually said, what
  fraction did the model get wrong? Wrong = substituted + deleted + inserted,
  divided by the number of words in your reference. **Lower is better.**
  0% = perfect. **It can exceed 100%** — a model that outputs lots of made-up
  extra words is penalised for every one of them.
- **CER (Character Error Rate)** — the same idea counted letter by letter.
  CER is kinder to near-misses (`ɛ`→`e` is one wrong character but one whole
  wrong word), so a low CER with a high WER usually means "close but the
  orthography is off", while both being high means genuine failure.

Before comparing, both texts are lowercased and stripped of punctuation —
but **Ghanaian letters are never touched**: `ɛ`, `ɔ`, `ƒ`, `ɖ`, `ŋ`, `ʋ`
count as themselves, so writing `ɔ` when the model output `o` is correctly
counted as an error. Per-language scores are aggregated corpus-style (total
errors ÷ total words across clips), the standard method in ASR research. The
same word alignment that produces the numbers also produces the coloured
diffs, so the chart and the highlights always agree with each other.

---

## Getting started

### What you need

- **Windows, macOS, or Linux** with [Python 3.10+](https://www.python.org/downloads/)
  and [Node.js 18+](https://nodejs.org/)
- **ffmpeg** on PATH ([download](https://ffmpeg.org/download.html)) — does the
  audio conversion
- A **microphone** and a quiet room
- **Disk space:** ~1 GB for the app's dependencies, plus models on first use
  (Whisper small ≈ 500 MB; MMS ≈ 3.9 GB — downloaded once, then cached)
- **No GPU required.** Everything runs on an ordinary laptop CPU.

### Easiest start (Windows)

Double-click **`start.bat`** in the project folder. First run installs
everything (be patient); afterwards it just opens two terminal windows
(backend + frontend) and your browser at <http://localhost:5173>.

### Manual start (any OS)

```bash
# Terminal 1 — backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The bottom of the sidebar shows three status
dots — Backend, Local CPU engine, RunPod GPU engine — so you always know what
is available.

---

## Local CPU vs. RunPod GPU

| | Local CPU (default) | RunPod GPU (optional) |
| --- | --- | --- |
| Cost | Free | ~$0.10–0.50 per full evaluation pass |
| Setup | None | RunPod account + deploy the worker once |
| Whisper sizes | tiny/base/small are fine; medium/large-v3 are *painfully* slow (minutes per clip) | **large-v3 at full speed** — the model that actually represents the state of the art |
| MMS | Works, ~10–60 s per clip | Seconds per clip |
| Privacy | Audio never leaves your machine | Clips are sent to your RunPod endpoint for transcription |

**Recommendation:** do your whole workflow locally with Whisper *small* first.
When your clips and references are final, deploy the RunPod worker
(step-by-step guide: **[docs/RUNPOD_SETUP.md](docs/RUNPOD_SETUP.md)**) and
re-run with Whisper **large-v3** — small models failing on low-resource
languages is expected; large-v3 failing is the publishable finding.

To enable RunPod: copy `.env.example` to `.env`, fill in `RUNPOD_API_KEY` and
`RUNPOD_ENDPOINT_ID`, restart the backend. The RunPod button on the Runs page
lights up by itself.

---

## What you can do

- Record, re-record, and delete clips; add and remove prompt topics
- Edit any reference at any time — scores are recomputed live from the stored
  outputs, no re-run needed
- Run the same system several times (e.g. every Whisper size) and compare all
  of them on one chart
- Mix engines freely — a local MMS run and a RunPod Whisper run compare fine
- Delete bad runs; cancel stuck ones
- Export `findings.md` whenever — it always reflects the current state
- Use it fully offline once models are downloaded (local engine only)

## What it does **not** do (yet)

- **No speaker management** — it assumes one speaker (you). A multi-speaker
  benchmark is the future research programme, not this tool.
- **No automatic transcription of references** — the whole point is that *you*
  are the ground truth; there is no shortcut around typing what you said.
- **No fine-tuning or model improvement** — this measures models as shipped;
  it does not train anything.
- **No cloud storage or sharing** — the database and audio live in `data/` on
  your machine. Back that folder up if the recordings matter to you.
- **Whisper cannot be forced into Twi/Ewe** — those languages don't exist in
  it; auto-detection is the honest (and only) option.
- **MMS treats code-switching as Akan** — a limitation of MMS itself, kept
  deliberately visible because measuring it is the point.

---

## Things worth knowing before you start

- **First run of each model is slow** — the model downloads once (Whisper
  small ≈ 500 MB, MMS ≈ 3.9 GB) and is cached afterwards. On a flaky
  connection the download may fail and the clip shows an error; just launch
  the run again.
- **A run only appears on the Results page when its clips have references.**
  If Results looks empty after a run, you probably skipped step 2.
- **Speak naturally.** Radio-announcer clarity makes the models look better
  than they are for real users. Street-natural speech is the honest test.
- **References must match what was said, not what you meant to say.** If you
  stumbled or repeated a word, transcribe the stumble.
- **Empty hypothesis = 100% WER.** If a model outputs nothing for a clip,
  every reference word counts as deleted. That's correct scoring, not a glitch.
- **Your data lives in `data/`** — `workbench.db` (references, runs, results)
  plus `audio/raw/` (originals) and `audio/wav/` (converted). Delete `data/`
  and you start completely fresh. It is `.gitignore`d, so committing this repo
  never publishes your voice.
- **Keep `.env` private** — it holds your RunPod API key. It is `.gitignore`d
  already; don't paste it into screenshots.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Sidebar says *Backend offline* | The backend terminal isn't running — start it (or run `start.bat` again) |
| *Local CPU engine* dot is grey | `pip install -r backend/requirements.txt` didn't finish — run it again in the venv |
| Record button does nothing / mic error | The browser blocked the microphone — allow mic access for `localhost` |
| Upload fails with an ffmpeg error | ffmpeg isn't on PATH — install it and reopen the terminal |
| RunPod run stuck then fails with timeout | Endpoint cold start or no workers — check the endpoint's Logs tab on RunPod; see the troubleshooting section of [docs/RUNPOD_SETUP.md](docs/RUNPOD_SETUP.md) |
| A clip failed inside a run | Open the run row — the exact error is shown on that clip; fix and launch a fresh run |

## Project layout

```text
backend/    FastAPI app — clips, prompts, runs, scoring, engines (Python)
frontend/   The web UI — Vite + React + Tailwind (TypeScript)
worker/     RunPod serverless GPU worker (Whisper large-v3 + MMS) + Dockerfile
docs/       RunPod deployment guide
data/       YOUR data: SQLite DB + audio — never committed
start.bat   One-click launcher (Windows)
```

## Why this matters

Ghanaian languages are spoken by tens of millions of people, yet they sit at
the margins of mainstream speech technology. This workbench produces the
concrete, reproducible evidence of that gap — and it is the seed of a larger
research direction: a culturally grounded, multi-speaker, human-evaluated
spoken benchmark for conversational AI in Ghanaian languages.

This is a directional probe, not a benchmark: single speaker, small clip
count, phone-grade microphone, self-transcribed references. Those limitations
are stated openly because the honest version of this result is the useful one.

## Author

**Michael Tawiah** — software developer & UI/UX designer, Accra, Ghana.
Speaker of Twi and Ewe.
[Portfolio](https://michael-tawiah-portfolio.vercel.app/) ·
[GitHub](https://github.com/MickWorld)

MIT licensed — see [LICENSE](LICENSE).
