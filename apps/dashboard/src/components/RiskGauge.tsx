import type { RiskBand } from "../types";

const BAND_COLOR: Record<RiskBand, string> = {
  LOW: "#3ecf6e",
  MEDIUM: "#e0b23c",
  HIGH: "#e8823c",
  CRITICAL: "#e05c5c"
};

export function RiskGauge({ score, band, size = 128 }: { score: number; band: RiskBand; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = BAND_COLOR[band];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums" style={{ color }}>
          {clamped}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted">/ 100</span>
        <span className="mt-0.5 text-xs font-medium uppercase tracking-wide" style={{ color }}>
          {band}
        </span>
      </div>
    </div>
  );
}
