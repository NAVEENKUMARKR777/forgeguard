import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { StatTile } from "../components/StatTile";
import type { ProductivitySnapshot } from "../types";

const WINDOWS: { value: string; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" }
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function BucketChart({ buckets }: { buckets: ProductivitySnapshot["buckets"] }) {
  const max = Math.max(1, ...buckets.map((b) => b.deployments));
  return (
    <div className="flex h-24 items-end gap-1 rounded-lg border border-border bg-panel p-3">
      {buckets.map((b) => (
        <div key={b.date} className="group relative flex-1">
          <div
            className="w-full rounded-sm bg-accent/70 transition-all"
            style={{ height: `${Math.max(4, (b.deployments / max) * 64)}px` }}
            title={`${b.date}: ${b.deployments} deployment(s), ${b.incidents} incident(s)`}
          />
        </div>
      ))}
    </div>
  );
}

export function ProductivityPage() {
  const [window_, setWindow] = useState("30d");
  const [snapshot, setSnapshot] = useState<ProductivitySnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    fetch(`/productivity/metrics?window=${window_}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setSnapshot)
      .catch(() => setError(true));
  }, [window_]);

  return (
    <div className="grid h-full grid-cols-1 grid-rows-[auto_1fr]">
      <Header />
      <div className="mx-auto w-full max-w-4xl overflow-y-auto px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted">
            Development / CI/CD metrics for this repo —{" "}
            <span className="rounded bg-panel-2 px-1.5 py-0.5 font-medium text-success">source: live GitHub data</span>,
            not synthetic. A young, low-traffic repo will show mostly zero-activity days — that's real, not a bug.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-muted">
            Window
            <select
              value={window_}
              onChange={(e) => setWindow(e.target.value)}
              className="rounded-md border border-border-2 bg-panel px-2 py-1 text-ink"
            >
              {WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-muted">Could not load productivity data.</p>}

        {snapshot && (
          <>
            <Section title="Development">
              <StatTile label="PRs merged" value={snapshot.development.prThroughput} />
              <StatTile label="Avg cycle time" value={snapshot.development.avgCycleTimeHours} unit="h" />
              <StatTile label="Avg files changed" value={snapshot.development.avgFilesChangedPerPr} />
              <StatTile label="Avg commits/PR" value={snapshot.development.avgCommitsPerPr} />
            </Section>

            <Section title="CI/CD">
              <StatTile label="CI success rate" value={`${Math.round(snapshot.cicd.ciSuccessRate * 100)}%`} />
              <StatTile label="Deploy frequency" value={snapshot.cicd.deploymentFrequencyPerWeek} unit="/wk" />
              <StatTile label="Deploy success rate" value={`${Math.round(snapshot.cicd.deploymentSuccessRate * 100)}%`} />
              <StatTile label="Rollback frequency" value={snapshot.cicd.rollbackFrequencyPerWeek} unit="/wk" />
            </Section>

            <Section title="Reliability">
              <StatTile label="Incident frequency" value={snapshot.reliability.incidentFrequencyPerWeek} unit="/wk" />
            </Section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Deployments over time</h2>
              <BucketChart buckets={snapshot.buckets} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
