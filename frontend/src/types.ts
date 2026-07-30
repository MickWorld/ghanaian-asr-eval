export type Language = "twi" | "ewe" | "cs";

export interface Prompt {
  id: number;
  language: Language;
  category: string;
  text: string;
  position: number;
  recorded_clip_id?: number | null;
  recorded_filename?: string | null;
}

export interface Clip {
  id: number;
  filename: string;
  language: Language;
  prompt_id: number | null;
  duration_sec: number;
  reference: string;
  created_at: string;
  prompt_text?: string | null;
  prompt_category?: string | null;
}

export interface Run {
  id: number;
  system: "whisper" | "mms";
  model: string;
  engine: "runpod" | "local";
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  error: string;
  created_at: string;
  finished_at: string | null;
  total?: number;
  done?: number;
  failed?: number;
}

export interface Transcription {
  id: number;
  run_id: number;
  clip_id: number;
  status: "pending" | "running" | "done" | "failed";
  hypothesis: string;
  meta: string;
  latency_ms: number | null;
  error: string;
  filename: string;
  language: Language;
  reference: string;
}

export interface RunDetail {
  run: Run;
  items: Transcription[];
}

export interface SummaryRow {
  run_id: number;
  system: string;
  model: string;
  engine: string;
  created_at: string;
  language: string; // twi | ewe | cs | all
  clips: number;
  wer: number | null;
  cer: number | null;
}

export interface AlignOp {
  op: "ok" | "sub" | "ins" | "del";
  ref: string | null;
  hyp: string | null;
}

export interface ComparisonClip {
  clip_id: number;
  filename: string;
  language: Language;
  reference: string;
  hypothesis: string;
  meta: string;
  latency_ms: number | null;
  duration_sec: number;
  wer: number;
  cer: number;
  word_counts: { ok: number; sub: number; ins: number; del: number };
  ops: AlignOp[];
}

export interface Comparisons {
  run: Run;
  clips: ComparisonClip[];
}

export interface EngineStatus {
  runpod_configured: boolean;
  local_whisper: boolean;
  local_mms: boolean;
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  twi: "Twi",
  ewe: "Ewe",
  cs: "Code-switch",
};
