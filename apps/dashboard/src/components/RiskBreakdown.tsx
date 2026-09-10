import type { RiskComponent } from "../types";

function barColor(fraction: number): string {
  if (fraction >= 0.75) return "bg-danger";
  if (fraction >= 0.45) return "bg-warning";
  return "bg-success";
}

export function RiskBreakdown({ components }: { components: RiskComponent[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {components.map((c) => {
        const fraction = c.max > 0 ? c.score / c.max : 0;
        return (
          <div key={c.name} className="text-xs">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink capitalize">{c.name.replaceAll("_", " ")}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {c.score}/{c.max}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(fraction)}`}
                style={{ width: `${Math.min(100, fraction * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted">{c.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
