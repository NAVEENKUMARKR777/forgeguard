import type { CommitEntry, DiffEntry, OpenPullRequest, PullRequest, PullRequestCheck, ReviewEntry, ServiceMeta } from "./types";

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
  started_at: string;
}
interface GhPullRequest {
  number: number;
  title: string;
  user?: { login?: string };
  changed_files?: number;
  head: { sha: string };
  updated_at: string;
}

const FORGEGUARD_SERVICE: ServiceMeta = {
  id: "forgeguard",
  owner: "NAVEENKUMARKR777",
  criticality: "medium",
  repository: "NAVEENKUMARKR777/forgeguard",
  deployment_strategy: "direct",
  common_failure_modes: ["Workers AI model unavailable", "D1 migration mismatch"],
  previous_incidents: []
};

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

/** A commit can carry multiple check-runs under the same name (manual
 * re-runs, a workflow re-triggering) — keep only the most recent one per
 * name so policy evaluation sees current status, not a stale run that
 * happens to sort earlier in GitHub's response. */
function latestPerName(runs: GhCheckRun[]): GhCheckRun[] {
  const latest = new Map<string, GhCheckRun>();
  for (const run of runs) {
    const existing = latest.get(run.name);
    if (!existing || new Date(run.started_at) > new Date(existing.started_at)) {
      latest.set(run.name, run);
    }
  }
  return [...latest.values()];
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
 * Real GitHub REST API client for `NAVEENKUMARKR777/forgeguard` (or
 * whatever `GITHUB_REPO` names) — no fixtures, no offline fallback. Every
 * function returns null on any failure (missing token, 404, rate limit)
 * rather than throwing, so callers can render "not found" instead of a
 * crash. See docs/decisions/ADR-002-mcp-vs-direct-tools.md for how this
 * module used to be fixture-backed and why that's no longer the design.
 */
export async function getPullRequest(env: Env, number: number): Promise<PullRequest | null> {
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
    headSha: pr.head.sha,
    files_changed: pr.changed_files ?? fileList.length,
    diff_summary,
    checks: latestPerName(checkRunsRes?.check_runs ?? []).map(mapCheckRun),
    test_coverage_delta: 0,
    touches_production_config: fileList.some((f) => /production/i.test(f.filename)),
    touches_database_migration: fileList.some((f) => /migrations?\//i.test(f.filename)),
    commits: (commits ?? []).map(mapCommit),
    reviews: (reviews ?? []).map(mapReview)
  };
}

/** The single real service this app describes — static facts about how
 * this actual repo is deployed, not fixture demo data. Returns null for
 * any other id, same "unknown service" semantics the old fixture map had. */
export function getService(id: string): ServiceMeta | null {
  return id === FORGEGUARD_SERVICE.id ? FORGEGUARD_SERVICE : null;
}

export async function getPullRequestFiles(env: Env, number: number): Promise<DiffEntry[] | null> {
  return (await getPullRequest(env, number))?.diff_summary ?? null;
}

export async function getReviews(env: Env, number: number): Promise<ReviewEntry[] | null> {
  const pr = await getPullRequest(env, number);
  if (!pr) return null;
  return pr.reviews ?? [];
}

export async function getCommits(env: Env, number: number): Promise<CommitEntry[] | null> {
  const pr = await getPullRequest(env, number);
  if (!pr) return null;
  return pr.commits ?? [];
}

export async function getDiff(env: Env, number: number): Promise<string | null> {
  const pr = await getPullRequest(env, number);
  if (!pr) return null;
  return pr.diff_text ?? pr.diff_summary.map((d) => `${d.path} (+${d.additions}/-${d.deletions})`).join("\n");
}

const OPEN_PRS_CACHE_TTL_MS = 30_000;
let openPrsCache: { repo: string; expiresAt: number; data: OpenPullRequest[] } | null = null;

/** Real open pull requests on the repo — powers the dashboard's live
 * sidebar list (polled, see apps/dashboard/src/hooks/useOpenPullRequests.ts).
 * Cached in-isolate for OPEN_PRS_CACHE_TTL_MS: every connected dashboard
 * polls independently, and on the Workers free plan that's both extra
 * requests and extra GitHub API rate-limit spend for data that doesn't
 * change second-to-second. Best-effort only (a fresh isolate starts with
 * an empty cache) — that's fine, this is a UI convenience, not anything
 * correctness-sensitive. */
export async function fetchOpenPullRequests(env: Env): Promise<OpenPullRequest[]> {
  if (!env.GITHUB_TOKEN) return [];
  const repo = repoTarget(env);
  if (openPrsCache && openPrsCache.repo === repo && openPrsCache.expiresAt > Date.now()) {
    return openPrsCache.data;
  }

  const prs = await githubGet<GhPullRequest[]>(env, `/repos/${repo}/pulls?state=open&per_page=20`);
  const data = (prs ?? []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login ?? "unknown",
    headSha: pr.head.sha,
    updatedAt: pr.updated_at
  }));
  openPrsCache = { repo, expiresAt: Date.now() + OPEN_PRS_CACHE_TTL_MS, data };
  return data;
}

/** Substring search over changed file paths across currently open pull
 * requests — the real equivalent of the old "search across every known PR
 * fixture" (real code search over the whole repo needs a different,
 * separately-rate-limited endpoint and returns file content matches, not
 * this "which open PR touches this path" question). */
export async function searchCode(env: Env, query: string): Promise<{ prNumber: number; path: string }[]> {
  const normalized = query.toLowerCase();
  const openPrs = await fetchOpenPullRequests(env);
  const results: { prNumber: number; path: string }[] = [];
  for (const summary of openPrs) {
    const files = await getPullRequestFiles(env, summary.number);
    for (const entry of files ?? []) {
      if (entry.path.toLowerCase().includes(normalized)) {
        results.push({ prNumber: summary.number, path: entry.path });
      }
    }
  }
  return results;
}
