import type { PipelineStep } from "../types";

const TERMINAL_OK = new Set(["done", "complete"]);
const TERMINAL_ERROR = new Set(["error", "errored", "terminated"]);

function StatusIcon({ status }: { status: string }) {
  if (TERMINAL_OK.has(status)) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] text-bg">
        ✓
      </span>
    );
  }
  if (TERMINAL_ERROR.has(status)) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] text-bg">
        ✕
      </span>
    );
  }
  return (
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="absolute h-4 w-4 animate-ping rounded-full bg-warning/40" />
      <span className="h-2 w-2 rounded-full bg-warning" />
    </span>
  );
}

export function PipelinePanel({ steps }: { steps: PipelineStep[] }) {
  if (steps.length === 0) {
    return <p className="text-xs text-muted">No pipeline running. Ask ForgeGuard to analyze a PR to see it here.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => (
        <li key={step.name} className="animate-fade-in-up flex items-center gap-2 text-xs">
          <StatusIcon status={step.status} />
          <span className="font-medium text-ink">{step.name.replaceAll("-", " ")}</span>
          <span className="text-muted">— {step.status}</span>
        </li>
      ))}
    </ol>
  );
}
