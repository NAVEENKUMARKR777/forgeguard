const API_BASE = "https://api.cloudflare.com/client/v4";

function authHeaders(env: Env): HeadersInit {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is not set — see .dev.vars.example");
  }
  return { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" };
}

async function callCloudflareApi<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(env) });
  if (!res.ok) {
    throw new Error(`Cloudflare API request to ${path} failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { success: boolean; result: T; errors: unknown[] };
  if (!body.success) {
    throw new Error(`Cloudflare API error for ${path}: ${JSON.stringify(body.errors)}`);
  }
  return body.result;
}

/**
 * Real, direct calls to Cloudflare's REST API (account/worker/zone data) —
 * not fixtures. This is the one piece of ForgeGuard that reaches outside
 * its own account: it needs a real CLOUDFLARE_API_TOKEN (and
 * CLOUDFLARE_ACCOUNT_ID) to do anything, neither of which exist in this
 * development environment, so none of these functions have been exercised
 * against the live API. The request/response shapes follow Cloudflare's
 * published API v4 documentation. Not wired into SessionAgent's default
 * path — see docs/decisions/ADR-005 for why this stays opt-in.
 */
export async function getWorkerScript(env: Env, scriptName: string): Promise<unknown> {
  if (!env.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
  return callCloudflareApi(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`);
}

export async function getWorkerDeployments(env: Env, scriptName: string): Promise<unknown> {
  if (!env.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
  return callCloudflareApi(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}/deployments`);
}

export async function getZone(env: Env, zoneId: string): Promise<unknown> {
  return callCloudflareApi(env, `/zones/${zoneId}`);
}

export async function getSecurityEvents(env: Env, zoneId: string): Promise<unknown> {
  return callCloudflareApi(env, `/zones/${zoneId}/security/events`);
}
