import pr1842 from "../fixtures/pull-requests/pr-1842.json";
import paymentService from "../fixtures/services/payment-service.json";
import { fetchLivePullRequest } from "./github-live";
import type { CommitEntry, DiffEntry, PullRequest, ReviewEntry, ServiceMeta } from "./types";

/**
 * Fixture-backed stand-in for a GitHub MCP server. Same call shapes a real
 * `get_pull_request` / `get_pull_request_files` / `get_reviews` /
 * `get_commits` / `get_diff` / `search_code` MCP tool would have — swapping
 * this module for a live MCP client is the only change a real integration
 * needs (see docs/decisions/ADR-002-mcp-vs-direct-tools.md).
 */
const PULL_REQUESTS: Record<number, PullRequest> = {
  1842: pr1842 as PullRequest
};

const SERVICES: Record<string, ServiceMeta> = {
  "payment-service": paymentService as ServiceMeta
};

export function getPullRequest(number: number): PullRequest | null {
  return PULL_REQUESTS[number] ?? null;
}

/**
 * Fixture first, real GitHub API second. Keeps the demo PR (#1842)
 * instant and deterministic while letting any other PR number resolve
 * against the real repo when `GITHUB_TOKEN` is configured — see
 * mcp/github-live.ts and ADR-002.
 */
export async function resolvePullRequest(env: Env, number: number): Promise<PullRequest | null> {
  return getPullRequest(number) ?? fetchLivePullRequest(env, number);
}

export function getService(id: string): ServiceMeta | null {
  return SERVICES[id] ?? null;
}

export function getPullRequestFiles(number: number): DiffEntry[] | null {
  return getPullRequest(number)?.diff_summary ?? null;
}

export function getReviews(number: number): ReviewEntry[] | null {
  const pr = getPullRequest(number);
  if (!pr) return null;
  return pr.reviews ?? [];
}

export function getCommits(number: number): CommitEntry[] | null {
  const pr = getPullRequest(number);
  if (!pr) return null;
  return pr.commits ?? [];
}

export function getDiff(number: number): string | null {
  const pr = getPullRequest(number);
  if (!pr) return null;
  return pr.diff_text ?? pr.diff_summary.map((d) => `${d.path} (+${d.additions}/-${d.deletions})`).join("\n");
}

/** Substring search over changed file paths across every known PR fixture. */
export function searchCode(query: string): { prNumber: number; path: string }[] {
  const normalized = query.toLowerCase();
  const results: { prNumber: number; path: string }[] = [];
  for (const pr of Object.values(PULL_REQUESTS)) {
    for (const entry of pr.diff_summary) {
      if (entry.path.toLowerCase().includes(normalized)) {
        results.push({ prNumber: pr.number, path: entry.path });
      }
    }
  }
  return results;
}
