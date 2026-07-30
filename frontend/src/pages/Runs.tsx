import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Button, Card, EmptyState, MetaBadge, PageHeader, Spinner } from "../components/ui";
import type { EngineStatus, Run, RunDetail } from "../types";

const WHISPER_MODELS = ["tiny", "base", "small", "medium", "large-v3"];

const STATUS_STYLE: Record<Run["status"], string> = {
  queued: "text-muted border-baseline",
  running: "text-link border-accent/40",
  done: "text-good border-good/40",
  failed: "text-critical border-critical/40",
  cancelled: "text-muted border-baseline",
};

export default function RunsPage({ engines }: { engines: EngineStatus | null }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [system, setSystem] = useState<"whisper" | "mms">("whisper");
  const [model, setModel] = useState("small");
  const [engine, setEngine] = useState<"local" | "runpod">("local");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [openRun, setOpenRun] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);

  const load = useCallback(() => {
    api.runs().then(setRuns).catch((e) => setError(String(e.message ?? e)));
  }, []);
  useEffect(load, [load]);

  // Poll while anything is active (also refreshes the open detail view).
  const active = runs?.some((r) => r.status === "queued" || r.status === "running") ?? false;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      load();
      if (openRun != null) api.run(openRun).then(setDetail).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [active, load, openRun]);

  useEffect(() => {
    if (openRun == null) { setDetail(null); return; }
    api.run(openRun).then(setDetail).catch(() => {});
  }, [openRun]);

  const localAvailable = system === "whisper" ? !!engines?.local_whisper : !!engines?.local_mms;
  const runpodAvailable = system === "whisper" ? !!engines?.runpod_whisper : !!engines?.runpod_mms;

  // Don't leave an unavailable engine selected when the system changes.
  useEffect(() => {
    if (engine === "runpod" && !runpodAvailable) setEngine("local");
  }, [engine, runpodAvailable]);

  const launch = async () => {
    setLaunching(true);
    setError("");
    try {
      const body = {
        system,
        model: system === "mms" ? "mms-1b-all" : model,
        engine,
      };
      const d = await api.createRun(body);
      setOpenRun(d.run.id);
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Runs"
        sub="Transcribe every clip with a system, then compare on the Results page."
      />

      {/* Launch panel */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">System</p>
            <div className="flex gap-2">
              {(["whisper", "mms"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSystem(s)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    system === s ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-2 hover:border-baseline"
                  }`}
                >
                  {s === "whisper" ? "Whisper" : "Meta MMS"}
                  <span className="ml-2 text-xs text-muted">{s === "whisper" ? "OpenAI" : "1b-all"}</span>
                </button>
              ))}
            </div>
          </div>

          {system === "whisper" && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Model</p>
              <div className="flex gap-1.5">
                {WHISPER_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      model === m ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-2 hover:border-baseline"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Engine</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEngine("local")}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  engine === "local" ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-2 hover:border-baseline"
                }`}
              >
                Local CPU
                {!localAvailable && <span className="ml-2 text-xs text-warning">deps missing</span>}
              </button>
              <button
                type="button"
                onClick={() => runpodAvailable && setEngine("runpod")}
                disabled={!runpodAvailable}
                title={runpodAvailable ? ""
                  : system === "mms"
                    ? "MMS on RunPod needs this repo's custom worker (adapter switching). Set RUNPOD_MMS_ENDPOINT_ID in .env, or run MMS locally."
                    : "Set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID in .env, see docs/RUNPOD_SETUP.md"}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  engine === "runpod" ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-2 hover:border-baseline"
                }`}
              >
                RunPod GPU
                {!runpodAvailable && <span className="ml-2 text-xs text-muted">not configured</span>}
              </button>
            </div>
          </div>

          <div className="ml-auto">
            <Button onClick={launch} disabled={launching || (engine === "local" && !localAvailable)}>
              {launching ? <span className="flex items-center gap-2"><Spinner /> Launching…</span> : "▶ Launch run"}
            </Button>
          </div>
        </div>

        {engine === "local" && system === "whisper" && (model === "large-v3" || model === "medium") && (
          <p className="mt-3 text-xs text-warning">
            {model} on CPU is very slow (minutes per clip). Use RunPod for large models, or pick small/base locally.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
      </Card>

      {/* Run list */}
      {!runs ? (
        <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          hint="Record clips and add references first, then launch Whisper and MMS runs to compare them."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const total = run.total ?? 0;
            const done = (run.done ?? 0) + (run.failed ?? 0);
            const progress = total ? Math.round((done / total) * 100) : 0;
            const isOpen = openRun === run.id;
            return (
              <Card key={run.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenRun(isOpen ? null : run.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-raised/40"
                >
                  <span className="text-xs text-muted tabular-nums">#{run.id}</span>
                  <span className="font-medium">
                    {run.system === "whisper" ? `Whisper ${run.model}` : "MMS 1b-all"}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-muted">
                    {run.engine === "runpod" ? "RunPod GPU" : "Local CPU"}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[run.status]}`}>
                    {run.status}{run.status === "running" ? ` ${done}/${total}` : ""}
                  </span>
                  {(run.failed ?? 0) > 0 && (
                    <span className="text-xs text-critical">{run.failed} failed</span>
                  )}
                  <span className="ml-auto text-xs text-muted">{run.created_at} UTC</span>
                </button>
                {(run.status === "running" || run.status === "queued") && (
                  <div className="h-0.5 w-full bg-raised">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-hairline bg-page/40 px-4 py-3">
                    {run.error && <p className="mb-2 text-sm text-critical">{run.error}</p>}
                    <div className="mb-3 flex gap-2">
                      {(run.status === "running" || run.status === "queued") && (
                        <Button variant="ghost" onClick={() => api.cancelRun(run.id).then(load)} className="!px-3 !py-1 !text-xs">
                          Cancel
                        </Button>
                      )}
                      {run.status === "done" && (
                        <Link to={`/results?run=${run.id}`} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent-deep">
                          View results →
                        </Link>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => { api.deleteRun(run.id).then(() => { setOpenRun(null); load(); }); }}
                        className="!px-3 !py-1 !text-xs"
                      >
                        Delete run
                      </Button>
                    </div>
                    {detail?.run.id === run.id ? (
                      <table className="w-full text-sm">
                        <tbody>
                          {detail.items.map((it) => (
                            <tr key={it.id} className="border-t border-hairline/60">
                              <td className="py-1.5 pr-3 align-top"><code className="text-xs">{it.filename}</code></td>
                              <td className="py-1.5 pr-3 align-top">
                                {it.status === "running" ? <Spinner className="h-3.5 w-3.5" />
                                  : it.status === "failed" ? <span className="text-xs text-critical" title={it.error}>failed</span>
                                  : it.status === "pending" ? <span className="text-xs text-muted">queued</span>
                                  : <span className="text-xs text-good">✓</span>}
                              </td>
                              <td className="py-1.5 text-ink-2">
                                {it.status === "failed"
                                  ? <span className="text-xs text-critical/80">{it.error}</span>
                                  : it.hypothesis || <span className="text-muted"> </span>}
                                {it.meta && <span className="ml-2 inline-flex align-middle"><MetaBadge meta={it.meta} /></span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex justify-center py-4"><Spinner /></div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
