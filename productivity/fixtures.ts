import type { DailyMetricRow } from "../types/productivity";
import type { IncidentRow } from "../memory/incidents";

const GITHUB_API = "https://api.github.com";
const DAYS = 90;

interface GhPull {
  title: string;
  created_at: string;
  merged_at: string | null;
  changed_files?: number;
  commits?: number;
}
interface GhRun {
  created_at: string;
  conclusion: string | null;
}

function repoTarget(env: Env): string {
  return env.GITHUB_REPO || "NAVEENKUMARKR777/forgeguard-demo";
}

async function githubGet<T>(env: Env, path: string): Promise<T | null> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      authorization: `token ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "forgeguard"
    }
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Real daily engineering metrics for the one real repo this project has —
 * built from the actual GitHub PR/Actions history and real incident
 * memory, not a synthetic generator. A young, low-traffic repo will show
 * mostly zero-activity days; that's honest, not a bug — see
 * docs/decisions/ADR-012-productivity-metrics.md.
 */
export async function fetchDailyMetrics(env: Env, incidents: IncidentRow[]): Promise<DailyMetricRow[]> {
  const repo = repoTarget(env);
  const today = new Date();
  const days: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const rows = new Map<string, DailyMetricRow>(
    days.map((date) => [
      date,
      {
        date,
        deployments: 0,
        deploymentFailures: 0,
        rollbacks: 0,
        incidents: 0,
        prsOpened: 0,
        prsMerged: 0,
        cycleHoursSum: 0,
        filesChangedSum: 0,
        commitsSum: 0,
        ciRuns: 0,
        ciFailures: 0
      }
    ])
  );

  if (!env.GITHUB_TOKEN) return [...rows.values()];

  const [pulls, runs] = await Promise.all([
    githubGet<GhPull[]>(env, `/repos/${repo}/pulls?state=all&per_page=100&sort=created&direction=desc`),
    githubGet<{ workflow_runs: GhRun[] }>(env, `/repos/${repo}/actions/runs?branch=master&per_page=100`)
  ]);

  for (const pr of pulls ?? []) {
    const openedDay = dayKey(pr.created_at);
    if (rows.has(openedDay)) rows.get(openedDay)!.prsOpened += 1;

    if (pr.merged_at) {
      const mergedDay = dayKey(pr.merged_at);
      const row = rows.get(mergedDay);
      if (row) {
        row.prsMerged += 1;
        row.deployments += 1; // a real merge to master triggers a real CI deploy
        row.cycleHoursSum += (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000;
        row.filesChangedSum += pr.changed_files ?? 0;
        row.commitsSum += pr.commits ?? 0;
        if (/^revert/i.test(pr.title)) row.rollbacks += 1;
      }
    }
  }

  for (const run of runs?.workflow_runs ?? []) {
    const day = dayKey(run.created_at);
    const row = rows.get(day);
    if (row) {
      row.ciRuns += 1;
      if (run.conclusion && run.conclusion !== "success") {
        row.deploymentFailures += 1;
        row.ciFailures += 1;
      }
    }
  }

  for (const incident of incidents ?? []) {
    const day = dayKey(new Date(incident.created_at).toISOString());
    const row = rows.get(day);
    if (row) row.incidents += 1;
  }

  return [...rows.values()];
}
