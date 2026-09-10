import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { EvalRunHistory } from "../components/EvalRunHistory";
import type { EvalReport } from "../types";

function SuiteBar({ suite, passed, total }: { suite: string; passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const allPass = passed === total;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium capitalize text-ink">{suite}</span>
        <span className="tabular-nums text-muted">
          {passed}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-panel-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${allPass ? "bg-success" : "bg-danger"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/eval-results.json")
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then(setReport)
      .catch(() => setError(true));
  }, []);

  const bySuite = new Map<string, { passed: number; total: number }>();
  for (const r of report?.results ?? []) {
    const entry = bySuite.get(r.suite) ?? { passed: 0, total: 0 };
    entry.total += 1;
    if (r.ok) entry.passed += 1;
    bySuite.set(r.suite, entry);
  }

  return (
    <div className="grid h-full grid-cols-1 grid-rows-[auto_1fr]">
      <Header />
      <div className="mx-auto w-full max-w-3xl overflow-y-auto px-6 py-6">
        <p className="mb-4 text-xs text-muted">
          Deterministic checks against the actual risk/policy/memory/tool-selection code — no hand-typed numbers.
          Run <code className="rounded bg-panel-2 px-1 py-0.5">npm run evals</code> to refresh.
        </p>

        {error && (
          <p className="rounded-lg border border-border bg-panel p-4 text-sm text-muted">
            No eval-results.json found yet. Run <code className="rounded bg-panel-2 px-1 py-0.5">npm run evals</code>{" "}
            locally, then reload.
          </p>
        )}

        {report && (
          <>
            <div className="mb-6 flex items-center gap-4">
              <p className="text-xs text-muted">Last run: {new Date(report.ranAt).toLocaleString()}</p>
              <div className="flex gap-3">
                <span className="rounded-md border border-success/30 bg-success-dim/30 px-2.5 py-1 text-xs font-medium text-success">
                  {report.passed} passed
                </span>
                {report.failed > 0 && (
                  <span className="rounded-md border border-danger/30 bg-danger-dim/30 px-2.5 py-1 text-xs font-medium text-danger">
                    {report.failed} failed
                  </span>
                )}
              </div>
            </div>

            <div className="mb-8 flex flex-col gap-4">
              {[...bySuite.entries()].map(([suite, counts]) => (
                <SuiteBar key={suite} suite={suite} passed={counts.passed} total={counts.total} />
              ))}
            </div>

            <EvalRunHistory />

            <div className="flex flex-col gap-4">
              {[...bySuite.keys()].map((suite) => (
                <div key={suite}>
                  <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{suite}</h2>
                  <div className="divide-y divide-border/60 rounded-lg border border-border">
                    {report.results
                      .filter((r) => r.suite === suite)
                      .map((r) => (
                        <div key={r.name} className="flex items-baseline gap-2 px-3 py-2 text-xs">
                          <span className={r.ok ? "text-success" : "text-danger"}>{r.ok ? "✓" : "✗"}</span>
                          <span className="text-ink">{r.name}</span>
                          <span className="ml-auto truncate text-muted">{r.detail}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
