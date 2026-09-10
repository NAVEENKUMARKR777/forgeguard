import { routeAgentRequest } from "agents";
import { mcpFetch } from "../mcp/server";
import { productivityFetch } from "../productivity/api";
import { evalHistoryFetch } from "../evals/history-api";

export { SessionAgent } from "../agents/session-agent";
export { ReleaseWorkflow } from "../workflows/release-workflow";
export { IncidentWorkflow } from "../workflows/incident-workflow";
export { RemediationWorkflow } from "../workflows/remediation-workflow";
export { EngineeringMemoryStore } from "../durable-objects/engineering-memory";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      return mcpFetch(request, env, ctx);
    }
    // Note: bare /productivity and bare /evals are the React pages (fall
    // through to ASSETS below); only their API sub-paths are handled here.
    if (url.pathname.startsWith("/productivity/")) {
      return productivityFetch(request);
    }
    if (url.pathname.startsWith("/evals/runs") || url.pathname.startsWith("/evals/compare")) {
      return evalHistoryFetch(request, env);
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
