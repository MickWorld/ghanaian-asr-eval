import { useState } from "react";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export interface BarGroup {
  label: string;
  values: Record<string, number | null>; // series key -> value
}

/* Grouped bar chart, dataviz-spec marks: thin bars, 4px rounded data end,
   2px surface gaps, hairline grid, muted axes, hover tooltip, legend above. */
export default function GroupedBarChart({
  groups, series, format = (v) => `${(v * 100).toFixed(1)}%`,
}: {
  groups: BarGroup[];
  series: BarSeries[];
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ g: number; s: string; x: number; y: number } | null>(null);

  const W = 640, H = 260;
  const M = { top: 12, right: 8, bottom: 26, left: 44 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const allValues = groups.flatMap((g) => series.map((s) => g.values[s.key] ?? 0)).filter((v): v is number => v != null);
  const rawMax = Math.max(0.1, ...allValues);
  // Nice ceiling in 25% steps (WER can exceed 100%)
  const max = Math.ceil(rawMax / 0.25) * 0.25;
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);

  const groupW = iw / Math.max(groups.length, 1);
  const barW = Math.min(28, (groupW * 0.72) / Math.max(series.length, 1));
  const y = (v: number) => M.top + ih - (v / max) * ih;

  const hovered = hover
    ? { group: groups[hover.g], serie: series.find((s) => s.key === hover.s)! }
    : null;

  return (
    <div className="relative">
      {/* Legend   always present for ≥2 series */}
      {series.length >= 2 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Error rate by language and system">
        {/* gridlines + tick labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#2c2c2a" strokeWidth={t === 0 ? 0 : 1} />
            <text x={M.left - 8} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="#898781">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {/* baseline */}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#383835" strokeWidth={1} />

        {groups.map((g, gi) => {
          const cx = M.left + groupW * gi + groupW / 2;
          const totalW = series.length * barW + (series.length - 1) * 2;
          return (
            <g key={g.label}>
              {series.map((s, si) => {
                const v = g.values[s.key];
                if (v == null) return null;
                const bx = cx - totalW / 2 + si * (barW + 2);
                const by = Math.min(y(v), y(0) - 2); // ≥2px mark even at ~0
                const isHover = hover?.g === gi && hover?.s === s.key;
                return (
                  <g key={s.key}>
                    {/* data-end rounding only: rect with top radius via path */}
                    <path
                      d={`M${bx},${y(0)} L${bx},${by + 4} Q${bx},${by} ${bx + 4},${by} L${bx + barW - 4},${by} Q${bx + barW},${by} ${bx + barW},${by + 4} L${bx + barW},${y(0)} Z`}
                      fill={s.color}
                      opacity={hover && !isHover ? 0.45 : 1}
                    />
                    {/* oversized hit target */}
                    <rect
                      x={bx - 2} y={M.top} width={barW + 4} height={ih}
                      fill="transparent"
                      onMouseEnter={() => setHover({ g: gi, s: s.key, x: bx + barW / 2, y: by })}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11.5} fill="#898781">{g.label}</text>
            </g>
          );
        })}
      </svg>

      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-hairline bg-raised px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100 - 2}%`, transform: "translate(-50%, -110%)" }}
        >
          <p className="mb-0.5 text-muted">{hovered.group.label}</p>
          <p className="flex items-center gap-1.5 text-ink">
            <span className="h-2 w-2 rounded-sm" style={{ background: hovered.serie.color }} />
            {hovered.serie.label}: <span className="font-semibold">{format(hovered.group.values[hovered.serie.key]!)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
