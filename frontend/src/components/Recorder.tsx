import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "./ui";

type Phase = "idle" | "recording" | "preview" | "saving";

export default function Recorder({
  title, subtitle, onSave, onClose,
}: {
  title: string;
  subtitle?: string;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<{
    stream: MediaStream; recorder: MediaRecorder; ctx: AudioContext; raf: number; timer: number;
  } | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const cleanup = useCallback(() => {
    const m = mediaRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      clearInterval(m.timer);
      m.stream.getTracks().forEach((t) => t.stop());
      m.ctx.close().catch(() => {});
      mediaRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    cleanup();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [cleanup, previewUrl]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, channelCount: 1 },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        blobRef.current = blob;
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setPhase("preview");
      };

      // Live waveform
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const g = canvas.getContext("2d")!;
          const { width, height } = canvas;
          analyser.getByteTimeDomainData(data);
          g.clearRect(0, 0, width, height);
          g.strokeStyle = "#eda100";
          g.lineWidth = 2;
          g.beginPath();
          const step = width / data.length;
          for (let i = 0; i < data.length; i++) {
            const y = (data[i] / 255) * height;
            if (i === 0) g.moveTo(0, y);
            else g.lineTo(i * step, y);
          }
          g.stroke();
        }
        if (mediaRef.current) mediaRef.current.raf = requestAnimationFrame(draw);
      };

      setSeconds(0);
      const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      mediaRef.current = { stream, recorder, ctx, raf: 0, timer };
      recorder.start();
      setPhase("recording");
      draw();
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError"
        ? "Microphone access denied   allow it in the browser and try again."
        : `Could not start recording: ${e}`);
    }
  };

  const stop = () => {
    mediaRef.current?.recorder.stop();
    cleanup();
  };

  const save = async () => {
    if (!blobRef.current) return;
    setPhase("saving");
    try {
      await onSave(blobRef.current);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("preview");
    }
  };

  const retake = () => {
    blobRef.current = null;
    setPhase("idle");
    setSeconds(0);
    start();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
        </div>

        <div className="rounded-xl border border-hairline bg-page p-4">
          {phase === "recording" ? (
            <>
              <canvas ref={canvasRef} width={440} height={80} className="w-full" />
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-critical">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-critical" /> Recording
                </span>
                <span className="text-sm tabular-nums text-ink-2">{mm}:{ss}</span>
              </div>
            </>
          ) : phase === "preview" && previewUrl ? (
            <div className="space-y-2">
              <audio src={previewUrl} controls className="w-full" />
              <p className="text-xs text-muted">Listen back   keep it only if the take is clean.</p>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              Speak naturally, as you would on the street or at home   not “radio voice”.
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-critical">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { cleanup(); onClose(); }}>Cancel</Button>
          {phase === "idle" && <Button onClick={start}>● Start recording</Button>}
          {phase === "recording" && <Button onClick={stop}>■ Stop</Button>}
          {phase === "preview" && (
            <>
              <Button variant="ghost" onClick={retake}>Retake</Button>
              <Button onClick={save}>Save clip</Button>
            </>
          )}
          {phase === "saving" && <Button disabled><span className="flex items-center gap-2"><Spinner /> Saving…</span></Button>}
        </div>
      </div>
    </div>
  );
}
