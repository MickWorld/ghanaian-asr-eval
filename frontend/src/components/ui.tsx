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
      "bg-accent text-page font-semibold hover:bg-accent-deep disabled:opacity-40 disabled:hover:bg-accent",
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
      className={`rounded-lg px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
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
    <svg className={`animate-spin text-accent ${className}`} viewBox="0 0 24 24" fill="none" aria-label="loading">
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
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
