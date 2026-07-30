import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import GroupedBarChart, { type BarSeries } from "../components/GroupedBarChart";
import { Button, Card, EmptyState, LangChip, PageHeader, Spinner, pct } from "../components/ui";
import type { AlignOp, Comparisons, Language, SummaryRow } from "../types";
import { LANGUAGE_LABEL } from "../types";

/* Fixed categorical slots (dark-mode validated). Whisper prefers blue,
   MMS prefers orange; extra runs take the next free slot   color follows
   the run, never its position in a filtered view. */
const SLOTS = ["#3987e5", "#d95926", "#199e70", "#c98500"];

const LANG_ORDER = ["twi", "ewe", "cs", "all"];
const LANG_CHART_LABEL: Record<string, string> = {
  twi: "Twi", ewe: "Ewe", cs: "Code-switch", all: "All",
};

interface RunMeta {
  run_id: number;
  label: string;
  color: string;
}

export default function ResultsPage() {
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [metric, setMetric] = useState<"wer" | "cer">("wer");
  const [selected, setSelected] = useState<number[]>([]);
  const [params, setParams] = useSearchParams();
  const [comp, setComp] = useState<Comparisons | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [langFilter, setLangFilter] = useState<Language | "all">("all");
  const [exportMsg, setExportMsg] = useState("");

  const load = useCallback(() => { api.summary().then(setSummary).catch(() => setSummary([])); }, []);
  useEffect(load, [load]);

  // All runs present in the summary, colored by fixed slot assignment.
  const runMetas: RunMeta[] = useMemo(() => {
    if (!summary) return [];
    const seen = new Map<number, SummaryRow>();
    for (const row of summary) if (!seen.has(row.run_id)) seen.set(row.run_id, row);
    const runs = [...seen.values()].sort((a, b) => a.run_id - b.run_id);
    const used = new Set<string>();
    return runs.map((r) => {
      let color = r.system === "whisper" ? SLOTS[0] : SLOTS[1];
      if (used.has(color)) color = SLOTS.find((c) => !used.has(c)) ?? SLOTS[3];
      used.add(color);
      const name = r.system === "whisper" ? `Whisper ${r.model}` : "MMS 1b-all";
      return { run_id: r.run_id, label: `${name} · ${r.engine} · #${r.run_id}`, color };
    });
  }, [summary]);

  // Default selection: latest 4 runs (or the ?run= param's run).
  useEffect(() => {
    if (!runMetas.length || selected.length) return;
    const fromUrl = Number(params.get("run"));
    const ids = runMetas.map((r) => r.run_id);
    setSelected(fromUrl && ids.includes(fromUrl) ? [fromUrl] : ids.slice(-4));
  }, [runMetas, selected.length, params]);

  // Diff explorer follows ?run= or the first selected run.
  const compRunId = Number(params.get("run")) || selected[0];
  useEffect(() => {
    if (!compRunId) return;
    setCompLoading(true);
    api.comparisons(compRunId).then(setComp).catch(() => setComp(null)).finally(() => setCompLoading(false));
  }, [compRunId]);

  if (!summary) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  if (summary.length === 0) {
    return (
      <>
        <PageHeader title="Results" />
        <EmptyState
          title="No scored results yet"
          hint="A run only appears here after it finishes AND its clips have reference transcripts. Record → type references → launch a run."
        />
      </>
    );
  }

  const active = runMetas.filter((r) => selected.includes(r.run_id));
  const series: BarSeries[] = active.map((r) => ({ key: String(r.run_id), label: r.label, color: r.color }));
  const groups = LANG_ORDER
    .filter((lang) => summary.some((row) => row.language === lang && selected.includes(row.run_id)))
    .map((lang) => ({
      label: LANG_CHART_LABEL[lang],
      values: Object.fromEntries(
        active.map((r) => [
          String(r.run_id),
          summary.find((row) => row.run_id === r.run_id && row.language === lang)?.[metric] ?? null,
        ]),
      ),
    }));

  // Headline tiles: best (lowest) WER per language across all runs.
  const tiles = (["twi", "ewe", "cs"] as const).map((lang) => {
    const rows = summary.filter((r) => r.language === lang && r.wer != null);
    if (!rows.length) return { lang, best: null as SummaryRow | null };
    return { lang, best: rows.reduce((a, b) => (a.wer! <= b.wer! ? a : b)) };
  });

  const doExport = async () => {
    try {
      const r = await api.exportFindings();
      setExportMsg(`Saved to ${r.path}`);
      const blob = new Blob([r.markdown], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "findings.md";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setExportMsg(String(e instanceof Error ? e.message : e));
    }
  };

  return (
    <>
      <PageHeader
        title="Results"
        sub="Word and character error rates against your reference transcripts."
        right={<Button variant="ghost" onClick={doExport}>Export findings.md</Button>}
      />
      {exportMsg && <p className="-mt-3 mb-4 text-xs text-muted">{exportMsg}</p>}

      {/* Headline tiles */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map(({ lang, best }) => (
          <Card key={lang} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{LANGUAGE_LABEL[lang]}   best WER</p>
            <p className="mt-1 text-3xl font-semibold">{best ? pct(best.wer) : " "}</p>
            {best && (
              <p className="mt-1 text-xs text-muted">
                {best.system === "whisper" ? `Whisper ${best.model}` : "MMS 1b-all"} · {best.clips} clips
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5">
            {(["wer", "cer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`rounded-md px-3 py-1 text-xs font-medium uppercase ${
                  metric === m ? "bg-raised text-ink" : "text-muted hover:text-ink-2"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* Run picker */}
          <div className="flex flex-wrap gap-1.5">
            {runMetas.map((r) => {
              const on = selected.includes(r.run_id);
              return (
                <button
                  key={r.run_id}
                  type="button"
                  onClick={() =>
                    setSelected((s) => on
                      ? s.filter((id) => id !== r.run_id)
                      : s.length >= 4 ? s : [...s, r.run_id])
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    on ? "border-baseline bg-raised text-ink" : "border-hairline text-muted hover:text-ink-2"
                  }`}
                  title={selected.length >= 4 && !on ? "Up to 4 runs at once   deselect one first" : ""}
                >
                  <span className="h-2 w-2 rounded-sm" style={{ background: on ? r.color : "#383835" }} />
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
        {series.length && groups.length ? (
          <GroupedBarChart groups={groups} series={series} />
        ) : (
          <p className="py-8 text-center text-sm text-muted">Select at least one run.</p>
        )}
        {/* Table view of the same data (accessibility + exact values) */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink-2">Table view</summary>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-3 font-normal">Run</th>
                <th className="py-1 pr-3 font-normal">Language</th>
                <th className="py-1 pr-3 font-normal">Clips</th>
                <th className="py-1 pr-3 font-normal">WER</th>
                <th className="py-1 font-normal">CER</th>
              </tr>
            </thead>
            <tbody>
              {summary
                .filter((r) => selected.includes(r.run_id))
                .map((r) => (
                  <tr key={`${r.run_id}-${r.language}`} className="border-t border-hairline/60 text-ink-2">
                    <td className="py-1.5 pr-3">{runMetas.find((m) => m.run_id === r.run_id)?.label}</td>
                    <td className="py-1.5 pr-3">{LANG_CHART_LABEL[r.language]}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{r.clips}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{pct(r.wer)}</td>
                    <td className="py-1.5 tabular-nums">{pct(r.cer)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </Card>

      {/* Diff explorer */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Error explorer</h2>
            <p className="mt-0.5 text-xs text-muted">
              Reference vs. hypothesis, word by word.{" "}
              <span className="text-ink-2"><del className="text-critical no-underline line-through">deleted</del></span>{" · "}
              <span className="rounded bg-warning/15 px-1 text-warning">substituted</span>{" · "}
              <span className="rounded bg-good/15 px-1 text-good">inserted</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={compRunId ?? ""}
              onChange={(e) => setParams({ run: e.target.value })}
              className="rounded-lg border border-hairline bg-page px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              {runMetas.map((r) => <option key={r.run_id} value={r.run_id}>{r.label}</option>)}
            </select>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as Language | "all")}
              className="rounded-lg border border-hairline bg-page px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="all">All languages</option>
              <option value="twi">Twi</option>
              <option value="ewe">Ewe</option>
              <option value="cs">Code-switch</option>
            </select>
          </div>
        </div>

        {compLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !comp || comp.clips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No scored clips for this run.</p>
        ) : (
          <div className="space-y-4">
            {comp.clips
              .filter((c) => langFilter === "all" || c.language === langFilter)
              .sort((a, b) => b.wer - a.wer)
              .map((c) => (
                <div key={c.clip_id} className="rounded-xl border border-hairline bg-page/50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <code className="text-xs text-ink-2">{c.filename}</code>
                    <LangChip lang={c.language} />
                    <span className="text-xs tabular-nums text-muted">WER {pct(c.wer)} · CER {pct(c.cer)}</span>
                    {c.meta && <span className="text-xs text-muted">{c.meta}</span>}
                    <audio src={api.clipAudioUrl(c.clip_id)} controls preload="none" className="ml-auto h-8 w-56" />
                  </div>
                  <DiffLine ops={c.ops} />
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted hover:text-ink-2">raw texts</summary>
                    <p className="mt-1 text-sm text-ink-2"><span className="text-muted">ref:</span> {c.reference}</p>
                    <p className="mt-0.5 text-sm text-ink-2"><span className="text-muted">hyp:</span> {c.hypothesis || "(empty)"}</p>
                  </details>
                </div>
              ))}
          </div>
        )}
      </Card>
    </>
  );
}

function DiffLine({ ops }: { ops: AlignOp[] }) {
  return (
    <p className="text-[15px] leading-loose">
      {ops.map((o, i) => {
        if (o.op === "ok") return <span key={i} className="text-ink-2">{o.ref} </span>;
        if (o.op === "del")
          return <del key={i} className="text-critical no-underline line-through decoration-critical/70">{o.ref} </del>;
        if (o.op === "ins")
          return <span key={i} className="rounded bg-good/15 px-1 text-good">{o.hyp} </span>;
        return (
          <span key={i} className="rounded bg-warning/15 px-1 text-warning" title={`said: ${o.ref}`}>
            {o.hyp}<span className="text-warning/60 text-xs"> ({o.ref})</span>{" "}
          </span>
        );
      })}
    </p>
  );
}
