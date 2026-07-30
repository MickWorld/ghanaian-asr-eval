import type {
  Clip, Comparisons, EngineStatus, Prompt, RunDetail, Run, SummaryRow,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<{ ok: boolean; engines: EngineStatus }>("/api/health"),

  prompts: () => request<Prompt[]>("/api/prompts"),
  createPrompt: (p: Omit<Prompt, "id">) => request<Prompt>("/api/prompts", json(p)),
  deletePrompt: (id: number) => request(`/api/prompts/${id}`, { method: "DELETE" }),

  clips: () => request<Clip[]>("/api/clips"),
  uploadClip: (blob: Blob, filename: string, language: string, promptId?: number | null) => {
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("language", language);
    if (promptId != null) form.append("prompt_id", String(promptId));
    return request<Clip>("/api/clips", { method: "POST", body: form });
  },
  patchClip: (id: number, patch: { reference?: string; language?: string }) =>
    request<Clip>(`/api/clips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteClip: (id: number) => request(`/api/clips/${id}`, { method: "DELETE" }),
  clipAudioUrl: (id: number) => `/api/clips/${id}/audio`,

  runs: () => request<Run[]>("/api/runs"),
  run: (id: number) => request<RunDetail>(`/api/runs/${id}`),
  createRun: (body: { system: string; model: string; engine: string; clip_ids?: number[] }) =>
    request<RunDetail>("/api/runs", json(body)),
  cancelRun: (id: number) => request(`/api/runs/${id}/cancel`, { method: "POST" }),
  deleteRun: (id: number) => request(`/api/runs/${id}`, { method: "DELETE" }),

  summary: () => request<SummaryRow[]>("/api/results/summary"),
  comparisons: (runId: number) => request<Comparisons>(`/api/results/comparisons/${runId}`),
  exportFindings: () => request<{ path: string; markdown: string }>("/api/results/export", { method: "POST" }),
};
