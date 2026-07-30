import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Button, Card, EmptyState, LangChip, PageHeader, Spinner } from "../components/ui";
import type { Clip } from "../types";

/* Characters used in Twi (Akan) and Ewe orthography that QWERTY keyboards lack. */
const SPECIAL_CHARS = ["ɛ", "ɔ", "ƒ", "ɖ", "ŋ", "ʋ", "Ɛ", "Ɔ", "Ƒ", "Ɖ", "Ŋ", "Ʋ"];

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savedFlash, setSavedFlash] = useState<number | null>(null);
  const [error, setError] = useState("");
  const focusedRef = useRef<{ id: number; el: HTMLTextAreaElement } | null>(null);

  const load = useCallback(() => {
    api.clips().then((cs) => {
      setClips(cs);
      setDrafts(Object.fromEntries(cs.map((c) => [c.id, c.reference])));
    }).catch((e) => setError(String(e.message ?? e)));
  }, []);
  useEffect(load, [load]);

  const save = async (clip: Clip) => {
    const text = drafts[clip.id] ?? "";
    if (text === clip.reference) return;
    try {
      await api.patchClip(clip.id, { reference: text });
      setClips((cs) => cs?.map((c) => (c.id === clip.id ? { ...c, reference: text } : c)) ?? null);
      setSavedFlash(clip.id);
      setTimeout(() => setSavedFlash((f) => (f === clip.id ? null : f)), 1500);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const insertChar = (ch: string) => {
    const focused = focusedRef.current;
    if (!focused) return;
    const { id, el } = focused;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + ch + el.value.slice(end);
    setDrafts((d) => ({ ...d, [id]: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const remove = async (clip: Clip) => {
    if (!window.confirm(`Delete ${clip.filename}? The audio file is removed too.`)) return;
    await api.deleteClip(clip.id);
    load();
  };

  if (!clips) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const missing = clips.filter((c) => !c.reference.trim()).length;

  return (
    <>
      <PageHeader
        title="Clips & References"
        sub={`Type exactly what was said in each clip, in proper orthography. ${
          missing ? `${missing} clip${missing > 1 ? "s" : ""} still need a reference.` : "All clips have references."
        }`}
      />

      {/* Orthography bar   stays visible while typing (mousedown avoids stealing focus) */}
      <div className="sticky top-0 z-10 mb-5 flex flex-wrap items-center gap-1.5 rounded-xl border border-hairline bg-surface/95 p-2 backdrop-blur">
        <span className="px-2 text-xs text-muted">Insert:</span>
        {SPECIAL_CHARS.map((ch) => (
          <button
            key={ch}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertChar(ch); }}
            className="h-8 w-8 rounded-lg border border-hairline bg-page text-sm text-ink-2 hover:border-accent hover:text-link"
          >
            {ch}
          </button>
        ))}
        <span className="ml-auto hidden px-2 text-xs text-muted sm:block">click a box while a reference field is focused</span>
      </div>

      {error && <p className="mb-4 text-sm text-critical">{error}</p>}

      {clips.length === 0 ? (
        <EmptyState
          title="No clips yet"
          hint="Record clips on the Record page   they will appear here for transcription."
        />
      ) : (
        <div className="space-y-3">
          {clips.map((clip) => (
            <Card key={clip.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <code className="text-sm text-ink">{clip.filename}</code>
                <LangChip lang={clip.language} />
                <span className="text-xs text-muted tabular-nums">{clip.duration_sec.toFixed(1)}s</span>
                {clip.prompt_text && (
                  <span className="max-w-72 truncate text-xs text-muted" title={clip.prompt_text}>
                    “{clip.prompt_text}”
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {savedFlash === clip.id && <span className="text-xs text-good">saved ✓</span>}
                  <button
                    type="button"
                    onClick={() => remove(clip)}
                    className="rounded px-2 py-1 text-xs text-muted hover:text-critical"
                  >
                    delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start">
                <audio src={api.clipAudioUrl(clip.id)} controls preload="none" className="h-10 w-full md:w-72 shrink-0" />
                <textarea
                  value={drafts[clip.id] ?? ""}
                  placeholder="Type exactly what was said   every word, in the orthography you intend as ground truth…"
                  onChange={(e) => setDrafts((d) => ({ ...d, [clip.id]: e.target.value }))}
                  onFocus={(e) => { focusedRef.current = { id: clip.id, el: e.currentTarget }; }}
                  onBlur={() => save(clip)}
                  rows={2}
                  className={`w-full flex-1 resize-y rounded-lg border bg-page px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted focus:border-accent ${
                    (drafts[clip.id] ?? "").trim() ? "border-hairline" : "border-warning/40"
                  }`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {clips.length > 0 && missing === 0 && (
        <p className="mt-6 rounded-lg border border-good/30 bg-good/5 px-4 py-3 text-sm text-ink-2">
          References complete   you can now launch an evaluation on the{" "}
          <a href="/runs" className="text-link underline-offset-2 hover:underline">Runs page</a>.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={load}>Refresh</Button>
      </div>
    </>
  );
}
