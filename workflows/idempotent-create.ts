/**
 * Structural subset of Cloudflare's real `Workflow<P>`/`WorkflowInstance`
 * types — deliberately not importing those (Workers-only globals) so this
 * function has no Workers-only dependency and can be unit tested with a
 * plain mock. A real `Workflow<P>` binding satisfies this interface as-is
 * (it has strictly more methods/properties), so callers pass
 * `ctx.env.RELEASE_WORKFLOW` etc. directly with no adapter needed.
 */
export interface WorkflowLike<P> {
  create(options: { id?: string; params?: P }): Promise<{ id: string }>;
  get(id: string): Promise<{ id: string }>;
}

/**
 * Cloudflare Workflows already reject `create()` when the given `id`
 * already exists (see WorkflowInstanceCreateOptions) — that's a real,
 * built-in idempotency primitive this codebase wasn't using: every
 * `startWorkflow`/`startIncidentWorkflow` call created a fresh
 * random-id instance, so asking the agent to "start the workflow" twice in
 * a row (a double click, a retried request) started two independent
 * workflows for the same PR/incident. This wraps `create()` so a
 * deterministic key (`release-<prNumber>`, `incident-<service>-<hour>`,
 * `remediation-<prNumber>`) reuses the in-flight instance instead. See
 * docs/decisions/ADR-010-audit-and-idempotency.md and
 * tests/security/replay-idempotency.test.ts.
 */
export async function createIdempotent<P>(
  workflow: WorkflowLike<P>,
  idempotencyKey: string,
  params: P
): Promise<{ instance: { id: string }; reused: boolean }> {
  try {
    const instance = await workflow.create({ id: idempotencyKey, params });
    return { instance, reused: false };
  } catch (error) {
    console.warn(`[idempotency] create("${idempotencyKey}") failed, falling back to get(): ${(error as Error).message}`);
    // Cloudflare Workflows throw when an instance with this id already
    // exists — that collision *is* the idempotency check succeeding.
    const instance = await workflow.get(idempotencyKey);
    return { instance, reused: true };
  }
}
