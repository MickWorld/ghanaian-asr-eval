import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Recorder from "../components/Recorder";
import UploadPanel from "../components/UploadPanel";
import { Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { Language, Prompt } from "../types";
import { LANGUAGE_LABEL } from "../types";

const TABS: Language[] = ["twi", "ewe", "cs"];

export default function RecordPage() {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [tab, setTab] = useState<Language>("twi");
  const [recording, setRecording] = useState<Prompt | "free" | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.prompts().then(setPrompts).catch((e) => setError(String(e.message ?? e)));
  }, []);
  useEffect(load, [load]);

  const byTab = useMemo(
    () => (prompts ?? []).filter((p) => p.language === tab),
    [prompts, tab],
  );
  const doneCount = byTab.filter((p) => p.recorded_clip_id).length;

  const saveRecording = async (blob: Blob) => {
    const prompt = recording === "free" ? null : recording;
    await api.uploadClip(blob, "clip.webm", tab, prompt?.id ?? null);
    setRecording(null);
    load();
  };

  const addPrompt = async () => {
    if (!newTopic.trim()) return;
    await api.createPrompt({
      language: tab, category: newCategory.trim(), text: newTopic.trim(), position: byTab.length,
    });
    setNewTopic(""); setNewCategory(""); setAdding(false);
    load();
  };

  if (!prompts) {
    return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  }

  return (
    <>
      <PageHeader
        title="Record"
        sub="Speak a natural sentence for each topic, in your own words, or upload recordings you already have. You'll type exactly what was said afterwards, on the Clips page."
        right={<Button variant="ghost" onClick={() => setRecording("free")}>+ Free recording</Button>}
      />

      <div className="mb-5 flex items-center gap-1 rounded-lg border border-hairline bg-surface p-1">
        {TABS.map((t) => {
          const total = (prompts ?? []).filter((p) => p.language === t).length;
          const done = (prompts ?? []).filter((p) => p.language === t && p.recorded_clip_id).length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === t ? "bg-raised text-ink" : "text-muted hover:text-ink-2"
              }`}
            >
              {LANGUAGE_LABEL[t]}
              <span className="ml-2 text-xs text-muted tabular-nums">{done}/{total}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mb-4 text-sm text-critical">{error}</p>}

      {byTab.length === 0 ? (
        <EmptyState
          title={`No ${LANGUAGE_LABEL[tab]} prompts yet`}
          hint="Add a topic below, or use Free recording."
          action={<Button onClick={() => setAdding(true)}>+ Add topic</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {byTab.map((p) => (
            <Card key={p.id} className={`p-4 transition-colors hover:border-baseline ${p.recorded_clip_id ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {p.category && (
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{p.category}</p>
                  )}
                  <p className="text-sm leading-relaxed text-ink-2">{p.text}</p>
                </div>
                {p.recorded_clip_id ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-xs text-good">
                    ✓ {p.recorded_filename}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                {!p.recorded_clip_id && (
                  <button
                    type="button"
                    onClick={() => api.deletePrompt(p.id).then(load)}
                    className="rounded px-2 py-1 text-xs text-muted hover:text-critical"
                  >
                    remove
                  </button>
                )}
                <Button
                  variant={p.recorded_clip_id ? "ghost" : "primary"}
                  onClick={() => setRecording(p)}
                  className="!px-3 !py-1.5 !text-xs"
                >
                  {p.recorded_clip_id ? "Record again" : "● Record"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5">
        {adding ? (
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="category (optional)"
              className="w-40 rounded-lg border border-hairline bg-page px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPrompt()}
              placeholder={`New ${LANGUAGE_LABEL[tab]} topic   what should be said?`}
              className="min-w-60 flex-1 rounded-lg border border-hairline bg-page px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <Button onClick={addPrompt} disabled={!newTopic.trim()}>Add</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </Card>
        ) : (
          byTab.length > 0 && (
            <button type="button" onClick={() => setAdding(true)} className="text-sm text-muted hover:text-link">
              + Add another topic
            </button>
          )
        )}
      </div>

      <UploadPanel language={tab} onUploaded={load} />

      {doneCount === byTab.length && byTab.length > 0 && (
        <p className="mt-6 rounded-lg border border-good/30 bg-good/5 px-4 py-3 text-sm text-ink-2">
          All {LANGUAGE_LABEL[tab]} prompts recorded   next, type the references on the{" "}
          <a href="/clips" className="text-link underline-offset-2 hover:underline">Clips page</a>.
        </p>
      )}

      {recording && (
        <Recorder
          title={recording === "free" ? `Free recording (${LANGUAGE_LABEL[tab]})` : `Record   ${LANGUAGE_LABEL[tab]}`}
          subtitle={recording === "free"
            ? "Say anything natural in this language; you'll transcribe it afterwards."
            : recording.text}
          onSave={saveRecording}
          onClose={() => setRecording(null)}
        />
      )}
    </>
  );
}
