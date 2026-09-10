import { getLatestDeployedCommit } from "../mcp/cloudflare";
import type { GitOpsState } from "../types/gitops";

const GITHUB_API = "https://api.github.com";
const WORKER_SCRIPT_NAME = "forgeguard";
const DEFAULT_BRANCH = "master";

/** Deliberately DEPLOY_REPO, not GITHUB_REPO: this module answers "is the
 * deployed Worker in sync with git", which is inherently about ForgeGuard's
 * own repo regardless of which repo GITHUB_REPO points investigations at —
 * see docs/decisions/ADR-021-demo-target-repo.md. */
function repoTarget(env: Env): string {
  return env.DEPLOY_REPO || "NAVEENKUMARKR777/forgeguard";
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

async function getBranchHeadSha(env: Env, branch: string): Promise<string | null> {
  const repo = repoTarget(env);
  const commit = await githubGet<{ sha: string }>(env, `/repos/${repo}/commits/${branch}`);
  return commit?.sha ?? null;
}

async function getLastSuccessfulCiCommit(env: Env): Promise<string | null> {
  const repo = repoTarget(env);
  const runs = await githubGet<{ workflow_runs: { head_sha: string }[] }>(
    env,
    `/repos/${repo}/actions/runs?branch=${DEFAULT_BRANCH}&status=success&per_page=1`
  );
  return runs?.workflow_runs[0]?.head_sha ?? null;
}

async function compareCommits(
  env: Env,
  base: string,
  head: string
): Promise<{ aheadBy: number; behindBy: number } | null> {
  const repo = repoTarget(env);
  const comparison = await githubGet<{ ahead_by: number; behind_by: number }>(
    env,
    `/repos/${repo}/compare/${base}...${head}`
  );
  return comparison ? { aheadBy: comparison.ahead_by, behindBy: comparison.behind_by } : null;
}

/**
 * Real GitOps state for the one real deployable thing this project has:
 * the `forgeguard` Worker deployed from this repo's `master` branch. No
 * fixture, no synthetic multi-service/multi-environment world — see
 * docs/decisions/ADR-009-gitops.md for the drift-scoring design this
 * feeds, which was written anticipating exactly this swap.
 */
export async function getGitOpsState(env: Env): Promise<GitOpsState | null> {
  const [desiredCommit, deployedCommit, ciCommit] = await Promise.all([
    getBranchHeadSha(env, DEFAULT_BRANCH),
    getLatestDeployedCommit(env, WORKER_SCRIPT_NAME),
    getLastSuccessfulCiCommit(env)
  ]);

  if (!desiredCommit && !deployedCommit) return null;

  const distance =
    desiredCommit && deployedCommit && desiredCommit !== deployedCommit
      ? await compareCommits(env, deployedCommit, desiredCommit)
      : null;

  return {
    service: "forgeguard",
    desiredCommit,
    deployedCommit,
    ciCommit,
    deploymentStatus: deployedCommit ? "succeeded" : "unknown",
    aheadBy: distance?.aheadBy ?? null,
    behindBy: distance?.behindBy ?? null
  };
}
