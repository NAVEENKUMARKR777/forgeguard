import { useEffect, useState } from "react";
import type { EvalRunComparison, EvalRunSummary } from "../types";

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted">no change</span>;
  const pct = (value * 100).toFixed(1);
  return (
    <span className={value > 0 ? "text-success" : "text-danger"}>
      {value > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

export function EvalRunHistory() {
  const [runs, setRuns] = useState<EvalRunSummary[] | null>(null);
  const [comparison, setComparison] = useState<EvalRunComparison | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    fetch("/evals/runs?limit=10")
      .then((r) => {
        if (!r.ok) throw new Error("history unavailable");
        return r.json();
      })
      .then((data) => setRuns(data.runs))
      .catch(() => setUnavailable(true));
  }, []);

  useEffect(() => {
    if (!runs || runs.length < 2) return;
    const [latest, previous] = runs;
    fetch(`/evals/compare?from=${previous.runId}&to=${latest.runId}`)
      .then((r) => r.json())
      .then(setComparison)
      .catch(() => {});
  }, [runs]);

  if (unavailable) {
    return (
      <p className="mb-8 text-xs text-muted">
        No recorded run history yet. Run <code className="rounded bg-panel-2 px-1 py-0.5">npm run evals:record</code>{" "}
        (spins up a temporary local Worker and persists the run to D1 — see{" "}
        <code className="rounded bg-panel-2 px-1 py-0.5">docs/decisions/ADR-015-eval-history.md</code>).
      </p>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <p className="mb-8 text-xs text-muted">
        No recorded runs yet. Run <code className="rounded bg-panel-2 px-1 py-0.5">npm run evals:record</code> to
        start building history.
      </p>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Run comparison</h2>
      {comparison ? (
        <div className="mb-4 rounded-lg border border-border bg-panel p-3 text-xs">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-muted">Pass rate change:</span>
            <DeltaBadge value={comparison.passRateDelta} />
            <span className="text-muted">
              ({comparison.from.runId.slice(0, 12)} → {comparison.to.runId.slice(0, 12)})
            </span>
          </div>
          {comparison.newlyFailing.length > 0 && (
            <p className="text-danger">
              Newly failing: {comparison.newlyFailing.map((c) => `${c.suite}::${c.name}`).join(", ")}
            </p>
          )}
          {comparison.newlyPassing.length > 0 && (
            <p className="text-success">
              Newly passing: {comparison.newlyPassing.map((c) => `${c.suite}::${c.name}`).join(", ")}
            </p>
          )}
          {comparison.suiteDeltas
            .filter((d) => d.passedBefore !== d.passedAfter || d.totalBefore !== d.totalAfter)
            .map((d) => (
              <p key={d.suite} className="text-muted">
                {d.suite}: {d.passedBefore}/{d.totalBefore} → {d.passedAfter}/{d.totalAfter}
              </p>
            ))}
          {comparison.newlyFailing.length === 0 &&
            comparison.newlyPassing.length === 0 &&
            comparison.suiteDeltas.every((d) => d.passedBefore === d.passedAfter && d.totalBefore === d.totalAfter) && (
              <p className="text-muted">No case-level changes between these two runs.</p>
            )}
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted">Only one run recorded so far — nothing to compare yet.</p>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Previous runs</h2>
      <div className="divide-y divide-border/60 rounded-lg border border-border">
        {runs.map((run) => (
          <div key={run.runId} className="flex items-center gap-3 px-3 py-2 text-xs">
            <span className="text-ink">{new Date(run.ranAt).toLocaleString()}</span>
            <span className="text-muted">{run.gitCommit ?? "no commit"}</span>
            <span className="ml-auto text-success">{run.passed} passed</span>
            {run.failed > 0 && <span className="text-danger">{run.failed} failed</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
