const GITHUB_API = "https://api.github.com";

function repoTarget(env: Env): string {
  return env.GITHUB_REPO || "NAVEENKUMARKR777/forgeguard";
}

async function githubRequest(env: Env, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      authorization: `token ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "forgeguard"
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

export interface MergeResult {
  ok: boolean;
  message: string;
}

/**
 * The one real write path in this codebase — kept in its own file,
 * separate from the read-only `mcp/github.ts`, so it's obvious at a
 * glance which module can change something on GitHub. Never registered as
 * an MCP tool (`mcp/server.ts` stays read-only by design, see
 * docs/decisions/ADR-005-shared-memory.md and
 * tests/security/unauthorized-tool.test.ts) — called directly from
 * `agents/release-agent.ts`, and only ever for the PR number stored in
 * the calling session's own `activeInvestigation`, never a number parsed
 * fresh from chat text (see tests/security/workflow-authorization.test.ts
 * for the same principle already enforced for approve/reject).
 */
export async function mergePullRequest(env: Env, number: number): Promise<MergeResult> {
  if (!env.GITHUB_TOKEN) return { ok: false, message: "GITHUB_TOKEN is not configured" };
  const repo = repoTarget(env);
  const res = await githubRequest(env, "PUT", `/repos/${repo}/pulls/${number}/merge`, {
    merge_method: "squash"
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: body.message ?? (res.ok ? "merged" : `GitHub returned ${res.status}`) };
}

export async function closePullRequest(env: Env, number: number): Promise<MergeResult> {
  if (!env.GITHUB_TOKEN) return { ok: false, message: "GITHUB_TOKEN is not configured" };
  const repo = repoTarget(env);
  const res = await githubRequest(env, "PATCH", `/repos/${repo}/pulls/${number}`, {
    state: "closed"
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: body.message ?? (res.ok ? "closed" : `GitHub returned ${res.status}`) };
}
