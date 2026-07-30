import { useRef, useState } from "react";
import { api } from "../api";
import { Spinner } from "./ui";
import type { Language } from "../types";
import { LANGUAGE_LABEL } from "../types";

interface FileStatus {
  name: string;
  state: "uploading" | "done" | "error";
  savedAs?: string;
  error?: string;
}

const ACCEPT = ".wav,.mp3,.m4a,.aac,.ogg,.opus,.flac,.wma,.amr,.3gp,.webm,audio/*";

/* Drag-and-drop / browse upload for audio that already exists (phone
   recordings, WhatsApp voice notes, field recordings). Files are converted
   to 16 kHz mono WAV server-side and renamed {lang}_{NN}.wav automatically. */
export default function UploadPanel({
  language, onUploaded,
}: {
  language: Language;
  onUploaded: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = files.some((f) => f.state === "uploading");

  const upload = async (list: File[]) => {
    if (!list.length || busy) return;
    setFiles(list.map((f) => ({ name: f.name, state: "uploading" as const })));
    for (let i = 0; i < list.length; i++) {
      try {
        const clip = await api.uploadClip(list[i], list[i].name, language, null);
        setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, state: "done", savedAs: clip.filename } : f)));
      } catch (e) {
        setFiles((fs) => fs.map((f, j) =>
          (j === i ? { ...f, state: "error", error: String(e instanceof Error ? e.message : e) } : f)));
      }
    }
    onUploaded();
  };

  const pick = (fileList: FileList | null) => {
    if (!fileList) return;
    upload([...fileList]);
  };

  return (
    <div className="mt-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-6 text-center transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-baseline hover:border-muted"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-muted">
          <path d="M12 3l4 4h-3v7h-2V7H8l4-4zM5 18h14v2H5v-2z" />
        </svg>
        <p className="text-sm text-ink-2">
          Already have recordings? <span className="text-accent">Drop audio files here</span> or click to browse
        </p>
        <p className="text-xs text-muted">
          m4a, mp3, wav, ogg, voice notes… added as <b>{LANGUAGE_LABEL[language]}</b> clips
          (switch tab to change), converted and renamed automatically
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm">
              {f.state === "uploading" ? <Spinner className="h-3.5 w-3.5" />
                : f.state === "done" ? <span className="text-good">✓</span>
                : <span className="text-critical">✕</span>}
              <span className="truncate text-ink-2">{f.name}</span>
              {f.savedAs && <code className="ml-auto shrink-0 text-xs text-muted">→ {f.savedAs}</code>}
              {f.error && <span className="ml-auto shrink-0 text-xs text-critical">{f.error}</span>}
            </li>
          ))}
          {!busy && files.some((f) => f.state === "done") && (
            <li className="pt-1 text-xs text-muted">
              Uploaded clips need reference transcripts, type them on the{" "}
              <a href="/clips" className="text-accent underline-offset-2 hover:underline">Clips page</a>.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
