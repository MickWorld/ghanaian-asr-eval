import type { ReactNode } from "react";
import type { Language } from "../types";
import { LANGUAGE_LABEL } from "../types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hairline bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, className = "", title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles = {
    primary:
      "bg-accent text-on-accent font-semibold hover:bg-accent-deep disabled:opacity-40 disabled:hover:bg-accent",
    ghost:
      "bg-transparent text-ink-2 border border-hairline hover:border-baseline hover:text-ink disabled:opacity-40",
    danger:
      "bg-transparent text-critical border border-hairline hover:border-critical disabled:opacity-40",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-2 text-sm transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

const LANG_DOT: Record<Language, string> = {
  twi: "bg-twi",
  ewe: "bg-ewe",
  cs: "bg-cs",
};

export function LangChip({ lang }: { lang: Language }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-2">
      <span className={`h-2 w-2 rounded-full ${LANG_DOT[lang]}`} />
      {LANGUAGE_LABEL[lang]}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-link ${className}`} viewBox="0 0 24 24" fill="none" aria-label="loading">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-baseline px-8 py-14 text-center">
      <p className="text-ink-2">{title}</p>
      {hint && <p className="max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function pct(v: number | null | undefined): string {
  if (v == null) return "–";
  return `${(v * 100).toFixed(1)}%`;
}

/** Full English name for an ISO language code ("lv" → "Latvian"). */
export function langName(code: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch { /* unknown/invalid code */ }
  return code.toUpperCase();
}

const ADAPTER_NAMES: Record<string, string> = { aka: "Akan", ewe: "Ewe" };

/** Renders a transcription's meta string as a human-readable badge.
    "detected:lv (p=0.29)" → what Whisper thought it heard;
    "adapter:aka" → which MMS adapter transcribed the clip. */
export function MetaBadge({ meta }: { meta: string }) {
  if (!meta) return null;

  const detected = meta.match(/detected:([A-Za-z-]+)(?:\s*\(p=([\d.]+)\))?/);
  if (detected) {
    const name = langName(detected[1]);
    const p = detected[2] ? Math.round(parseFloat(detected[2]) * 100) : null;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-series-1/40 bg-series-1/10 px-2.5 py-0.5 text-xs text-series-1"
        title="The language Whisper decided this clip was. It has no Akan or Ewe, so the misidentification is itself a finding."
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3.4a15.7 15.7 0 0 0-1.2-5.4A8 8 0 0 1 19.9 11zM12 4c.9 1.2 1.9 3.5 2.4 7H9.6C10.1 7.5 11.1 5.2 12 4zM8.7 5.6A15.7 15.7 0 0 0 7.5 11H4.1a8 8 0 0 1 4.6-5.4zM4.1 13h3.4c.2 2 .6 3.8 1.2 5.4A8 8 0 0 1 4.1 13zM12 20c-.9-1.2-1.9-3.5-2.4-7h4.8c-.5 3.5-1.5 5.8-2.4 7zm3.3-1.6c.6-1.6 1-3.4 1.2-5.4h3.4a8 8 0 0 1-4.6 5.4z" />
        </svg>
        heard as <b className="font-semibold">{name}</b>
        {p != null && <span className="opacity-75">· {p}% sure</span>}
      </span>
    );
  }

  const adapter = meta.match(/adapter:([A-Za-z]+)/);
  if (adapter) {
    const name = ADAPTER_NAMES[adapter[1]] ?? adapter[1];
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-series-2/40 bg-series-2/10 px-2.5 py-0.5 text-xs text-series-2"
        title="The MMS per-language adapter used for this clip. Code-switched clips use the Akan adapter - MMS has no code-switching mode."
      >
        <b className="font-semibold">{name}</b> adapter
      </span>
    );
  }

  return <span className="text-xs text-muted">{meta}</span>;
}

/** WER/CER chip, tinted by severity. The label keeps meaning color-free. */
export function RateChip({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 0.7 ? "border-critical/40 bg-critical/10 text-critical"
    : value >= 0.35 ? "border-warning/40 bg-warning/10 text-warning"
    : "border-good/40 bg-good/10 text-good";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs tabular-nums ${tone}`}>
      {label} {pct(value)}
    </span>
  );
}
