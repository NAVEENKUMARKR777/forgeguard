import { getPullRequest } from "./github";
import type { Pipeline, PipelineJob } from "./types";

const GITHUB_API = "https://api.github.com";

interface GhWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}
interface GhJob {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
}

function repoTarget(env: Env): string {
  return env.GITHUB_REPO || "NAVEENKUMARKR777/forgeguard";
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

function mapJob(job: GhJob): PipelineJob {
  const status = job.status !== "completed" ? "pending" : job.conclusion === "success" ? "passed" : "failed";
  const startedMs = new Date(job.started_at).getTime();
  const endedMs = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  return {
    name: job.name,
    status,
    duration_s: Math.max(0, Math.round((endedMs - startedMs) / 1000)),
    failure: status === "failed" ? (job.conclusion ?? undefined) : undefined
  };
}

/**
 * Real GitHub Actions data for a pull request's head commit — no fixture,
 * replaces the old `fixtures/ci/*.json`-backed lookup. This is deliberately
 * kept as a separate concept from `PullRequest.checks` (check-runs, a flat
 * pass/fail summary): this module gives job-level detail (per-job timing,
 * which specific job failed) across every workflow run for the commit.
 */
export async function getPipeline(env: Env, prNumber: number): Promise<Pipeline | null> {
  const pr = await getPullRequest(env, prNumber);
  if (!pr) return null;
  const repo = repoTarget(env);

  const runs = await githubGet<{ workflow_runs: GhWorkflowRun[] }>(
    env,
    `/repos/${repo}/actions/runs?head_sha=${pr.headSha}&per_page=10`
  );
  const workflowRuns = runs?.workflow_runs ?? [];
  if (workflowRuns.length === 0) return null;

  const jobLists = await Promise.all(
    workflowRuns.map((run) => githubGet<{ jobs: GhJob[] }>(env, `/repos/${repo}/actions/runs/${run.id}/jobs`))
  );
  const jobs = jobLists.flatMap((list) => list?.jobs.map(mapJob) ?? []);

  const anyFailed = jobs.some((j) => j.status === "failed");
  const anyPending = jobs.some((j) => j.status === "pending");
  const health = anyPending ? "in_progress" : anyFailed ? "unhealthy" : "healthy";

  return {
    service: pr.service,
    pipeline_id: String(workflowRuns[0].id),
    pr: prNumber,
    jobs,
    deployment: {
      environment: "production",
      strategy: "direct",
      health
    }
  };
}

export async function getJob(env: Env, prNumber: number, jobName: string): Promise<PipelineJob | null> {
  const pipeline = await getPipeline(env, prNumber);
  return pipeline?.jobs.find((j) => j.name === jobName) ?? null;
}

export async function getTestResults(env: Env, prNumber: number): Promise<PipelineJob[]> {
  const pipeline = await getPipeline(env, prNumber);
  return pipeline?.jobs.filter((j) => j.name.toLowerCase().includes("test") || j.name === "e2e" || j.name === "verify") ?? [];
}

/** No artifact-storage integration exists — returns `[]` for a known
 * pipeline (nothing tracked) or `null` for an unknown PR, rather than
 * fabricating build artifacts that don't exist anywhere else. */
export async function getArtifacts(env: Env, prNumber: number): Promise<{ name: string; url: string }[] | null> {
  return (await getPipeline(env, prNumber)) ? [] : null;
}

export async function getDeployment(env: Env, prNumber: number): Promise<Pipeline["deployment"] | null> {
  return (await getPipeline(env, prNumber))?.deployment ?? null;
}

export async function getDeploymentHealth(env: Env, prNumber: number): Promise<string | null> {
  return (await getPipeline(env, prNumber))?.deployment.health ?? null;
}
