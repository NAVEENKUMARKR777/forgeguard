import { DynamicWorkerExecutor, resolveProvider } from "@cloudflare/codemode";
import { getPullRequest, getService } from "../mcp/github";
import { getPipeline } from "../mcp/cicd";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { emit } from "../observability/logger";
import type { PullRequest, ServiceMeta, Pipeline } from "../mcp/types";
import type { IncidentRow } from "../memory/incidents";

export interface InvestigationEvidence {
  pr: PullRequest;
  service: ServiceMeta | null;
  pipeline: Pipeline | null;
  incidents: IncidentRow[];
}

// tools.* is a Proxy dispatched over Workers RPC to the fns below — see
// ToolDispatcher in @cloudflare/codemode. Positional args only (one per
// call here), matching how extractFns/ToolDispatcher invoke them: `fn(...args)`.
const INVESTIGATION_CODE = `
const pr = await tools.getPullRequest(__PR_NUMBER__);
const service = pr ? await tools.getService(pr.service) : null;
const pipeline = await tools.getPipeline(__PR_NUMBER__);
const incidents = service ? await tools.getIncidents(service.id) : [];
return { pr, service, pipeline, incidents };
`;

/**
 * Runs the multi-tool investigation (PR + service + CI + incident lookups)
 * inside a sandboxed Worker via Cloudflare Code Mode's standalone
 * `DynamicWorkerExecutor`, instead of SessionAgent calling each
 * fixture-backed function directly. This is deliberately the smallest real
 * slice of Code Mode — the stateless executor + resolveProvider, no Vite
 * plugin, no AI SDK / durable approval log (`createCodemodeRuntime`) — see
 * docs/decisions/ADR-007-code-mode.md for why the fuller runtime was out of
 * scope here.
 *
 * Requires a `worker_loaders` binding (`CODE_LOADER`), a beta Cloudflare
 * feature — verified working under `wrangler dev --local` (Miniflare
 * simulates Worker Loaders; unlike the AI binding, no account/login is
 * needed). Still, this path is inherently more failure-prone than a direct
 * function call (a sandboxed Worker has to spin up), so callers treat a
 * thrown error or `null` return as an expected, silent case and fall back
 * to direct calls (see agents/release-agent.ts#gatherEvidence).
 */
export async function investigateViaCodeMode(
  env: Env & { CODE_LOADER?: WorkerLoader },
  prNumber: number
): Promise<InvestigationEvidence | null> {
  if (!env.CODE_LOADER) return null;

  const executor = new DynamicWorkerExecutor({ loader: env.CODE_LOADER, globalOutbound: null, timeout: 10_000 });
  const provider = resolveProvider({
    name: "tools",
    tools: {
      getPullRequest: { execute: async (prNumberArg: unknown) => getPullRequest(env, prNumberArg as number) },
      getService: { execute: async (serviceId: unknown) => getService(serviceId as string) },
      getPipeline: { execute: async (prNumberArg: unknown) => getPipeline(env, prNumberArg as number) },
      getIncidents: {
        execute: async (serviceId: unknown) => engineeringMemoryStub(env).getIncidentsForService(serviceId as string)
      }
    }
  });

  const code = INVESTIGATION_CODE.replaceAll("__PR_NUMBER__", String(prNumber));
  const start = Date.now();
  const outcome = await executor.execute(code, [provider]);
  const durationMs = Date.now() - start;
  if (outcome.error || outcome.result == null) {
    emit({
      event: "tool.call",
      tool: "codemode_investigate",
      durationMs,
      success: false,
      error: outcome.error ? String(outcome.error) : "empty result"
    });
    return null;
  }
  emit({ event: "tool.call", tool: "codemode_investigate", durationMs, success: true });
  return outcome.result as InvestigationEvidence;
}
