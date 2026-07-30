import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import type { EngineStatus } from "./types";
import RecordPage from "./pages/Record";
import ClipsPage from "./pages/Clips";
import RunsPage from "./pages/Runs";
import ResultsPage from "./pages/Results";

const NAV = [
  { to: "/", label: "Record", icon: "M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm7-4a7 7 0 0 1-6 6.93V21h-2v-3.07A7 7 0 0 1 5 11h2a5 5 0 0 0 10 0h2z" },
  { to: "/clips", label: "Clips & References", icon: "M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" },
  { to: "/runs", label: "Runs", icon: "M8 5v14l11-7L8 5z" },
  { to: "/results", label: "Results", icon: "M5 9h3v10H5V9zm5.5-5h3v15h-3V4zM16 12h3v7h-3v-7z" },
];

export default function App() {
  const [engines, setEngines] = useState<EngineStatus | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api.health()
        .then((h) => { if (alive) { setEngines(h.engines); setBackendUp(true); } })
        .catch(() => { if (alive) setBackendUp(false); });
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-hairline bg-surface">
        {/* Kente stripe */}
        <div className="flex h-1">
          <div className="flex-1 bg-critical" />
          <div className="flex-1 bg-accent" />
          <div className="flex-1 bg-good" />
        </div>
        <div className="px-5 pb-2 pt-5">
          <p className="text-[15px] font-semibold leading-tight">Ghana ASR Workbench</p>
          <p className="mt-0.5 text-xs text-muted">Twi · Ewe · code-switch evaluation</p>
        </div>
        <nav className="mt-3 flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60 hover:text-ink"
                }`
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current opacity-80">
                <path d={n.icon} />
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t border-hairline px-5 py-4 text-xs">
          <StatusDot ok={backendUp === true} label={backendUp === false ? "Backend offline" : "Backend"} />
          <StatusDot ok={!!(engines?.local_whisper || engines?.local_mms)} label="Local CPU engine" />
          <StatusDot ok={!!engines?.runpod_configured} label="RunPod GPU engine" dim={!engines?.runpod_configured} />
        </div>
      </aside>

      <main className="ml-60 min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl">
          <Routes>
            <Route path="/" element={<RecordPage />} />
            <Route path="/clips" element={<ClipsPage />} />
            <Route path="/runs" element={<RunsPage engines={engines} />} />
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function StatusDot({ ok, label, dim }: { ok: boolean; label: string; dim?: boolean }) {
  return (
    <p className={`flex items-center gap-2 ${dim ? "text-muted" : "text-ink-2"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-good" : "bg-baseline"}`} />
      {label}
      {!ok && dim && <span className="text-muted">(not configured)</span>}
    </p>
  );
}
