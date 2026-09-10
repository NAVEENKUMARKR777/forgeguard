import type { CommitEntry, DiffEntry, PullRequest, PullRequestCheck, ReviewEntry } from "./types";

const GITHUB_API = "https://api.github.com";

interface GhFile {
  filename: string;
  additions: number;
  deletions: number;
}
interface GhReview {
  user?: { login?: string };
  state: string;
  body?: string;
}
interface GhCommit {
  sha: string;
  commit: { message: string; author?: { name?: string } };
  author?: { login?: string };
}
interface GhCheckRun {
  name: string;
  status: string;
  conclusion: string | null;
}
interface GhPullRequest {
  number: number;
  title: string;
  user?: { login?: string };
  changed_files?: number;
  head: { sha: string };
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

function mapCheckRun(run: GhCheckRun): PullRequestCheck {
  const status = run.status !== "completed" ? "pending" : run.conclusion === "success" ? "passed" : "failed";
  return { name: run.name, status, detail: status === "failed" ? (run.conclusion ?? undefined) : undefined };
}

function mapReview(review: GhReview): ReviewEntry {
  const state =
    review.state === "APPROVED" ? "approved" : review.state === "CHANGES_REQUESTED" ? "changes_requested" : "commented";
  return { reviewer: review.user?.login ?? "unknown", state, comment: review.body ?? "" };
}

function mapCommit(commit: GhCommit): CommitEntry {
  return {
    sha: commit.sha.slice(0, 7),
    message: commit.commit.message.split("\n")[0],
    author: commit.author?.login ?? commit.commit.author?.name ?? "unknown"
  };
}

/**
 * Fetches a real pull request from the GitHub REST API when `GITHUB_TOKEN`
 * is configured, mapping GitHub's response shape onto this app's internal
 * `PullRequest` type. Returns null on any failure (no token, 404, rate
 * limit) so callers fall back to the fixture set unchanged — see
 * mcp/github.ts#resolvePullRequest and ADR-002.
 *
 * `service`, `test_coverage_delta` have no GitHub equivalent: `service`
 * defaults to the repo name (so service-specific fixtures/policy simply
 * miss, same as any other unknown service), and coverage delta defaults to
 * 0 (unknown) rather than fabricating a number no tool actually reported.
 * `touches_production_config` / `touches_database_migration` are heuristics
 * over changed file paths, matching the pattern the fixtures already use.
 */
export async function fetchLivePullRequest(env: Env, number: number): Promise<PullRequest | null> {
  if (!env.GITHUB_TOKEN) return null;
  const repo = repoTarget(env);

  const pr = await githubGet<GhPullRequest>(env, `/repos/${repo}/pulls/${number}`);
  if (!pr) return null;

  const [files, reviews, commits, checkRunsRes] = await Promise.all([
    githubGet<GhFile[]>(env, `/repos/${repo}/pulls/${number}/files?per_page=100`),
    githubGet<GhReview[]>(env, `/repos/${repo}/pulls/${number}/reviews`),
    githubGet<GhCommit[]>(env, `/repos/${repo}/pulls/${number}/commits`),
    githubGet<{ check_runs: GhCheckRun[] }>(env, `/repos/${repo}/commits/${pr.head.sha}/check-runs`)
  ]);

  const fileList = files ?? [];
  const diff_summary: DiffEntry[] = fileList.map((f) => ({
    path: f.filename,
    additions: f.additions,
    deletions: f.deletions
  }));

  return {
    number: pr.number,
    title: pr.title,
    service: repo.split("/")[1] ?? "unknown",
    author: pr.user?.login ?? "unknown",
    files_changed: pr.changed_files ?? fileList.length,
    diff_summary,
    checks: (checkRunsRes?.check_runs ?? []).map(mapCheckRun),
    test_coverage_delta: 0,
    touches_production_config: fileList.some((f) => /production/i.test(f.filename)),
    touches_database_migration: fileList.some((f) => /migrations?\//i.test(f.filename)),
    commits: (commits ?? []).map(mapCommit),
    reviews: (reviews ?? []).map(mapReview)
  };
}
