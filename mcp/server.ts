import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { getService, resolvePullRequest, searchCode } from "./github";
import { getPipeline } from "./cicd";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import { withObservability } from "../observability/logger";

/** Wraps an MCP tool handler so every call emits a `tool.call` event with
 * duration and success/failure — without editing each handler by hand. */
function traced<A, R>(name: string, fn: (args: A) => Promise<R>): (args: A) => Promise<R> {
  return (args: A) => withObservability("tool.call", { tool: name }, () => fn(args));
}

/**
 * A real MCP server (JSON-RPC over HTTP, not a function stand-in) exposing
 * the same fixture-backed data mcp/github.ts and mcp/cicd.ts serve directly
 * to SessionAgent, plus the shared incident memory. Read-only by design —
 * see docs/decisions/ADR-005-shared-memory.md and
 * tests/security/unauthorized-tool.test.ts, which asserts no write/deploy
 * tool is ever registered here. Any MCP client (Claude Desktop, the MCP
 * Inspector, another agent) can point at /mcp and discover/call these tools.
 */
function buildServer(env: Env): McpServer {
  const server = new McpServer({ name: "forgeguard", version: "0.1.0" });

  server.registerTool(
    "get_pull_request",
    {
      title: "Get pull request",
      description: "Fetch metadata, diff summary and CI checks for a pull request by number.",
      inputSchema: { number: z.number().int().describe("Pull request number, e.g. 1842") }
    },
    traced("get_pull_request", async ({ number }) => {
      const pr = await resolvePullRequest(env, number);
      if (!pr) {
        return { content: [{ type: "text", text: `No pull request #${number} on record.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(pr, null, 2) }] };
    })
  );

  server.registerTool(
    "get_checks",
    {
      title: "Get CI checks",
      description: "Fetch CI pipeline job results for the given pull request number.",
      inputSchema: { number: z.number().int() }
    },
    traced("get_checks", async ({ number }) => {
      const pipeline = getPipeline(number);
      if (!pipeline) {
        return { content: [{ type: "text", text: `No CI pipeline on record for PR #${number}.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(pipeline, null, 2) }] };
    })
  );

  server.registerTool(
    "get_pull_request_files",
    {
      title: "Get pull request files",
      description: "Fetch the changed-file list (with +/- line counts) for a pull request.",
      inputSchema: { number: z.number().int() }
    },
    traced("get_pull_request_files", async ({ number }) => {
      const pr = await resolvePullRequest(env, number);
      if (!pr) {
        return { content: [{ type: "text", text: `No pull request #${number} on record.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(pr.diff_summary, null, 2) }] };
    })
  );

  server.registerTool(
    "get_reviews",
    {
      title: "Get reviews",
      description: "Fetch human code review state for a pull request.",
      inputSchema: { number: z.number().int() }
    },
    traced("get_reviews", async ({ number }) => {
      const pr = await resolvePullRequest(env, number);
      if (!pr) {
        return { content: [{ type: "text", text: `No pull request #${number} on record.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(pr.reviews ?? [], null, 2) }] };
    })
  );

  server.registerTool(
    "get_commits",
    {
      title: "Get commits",
      description: "Fetch the commit list for a pull request.",
      inputSchema: { number: z.number().int() }
    },
    traced("get_commits", async ({ number }) => {
      const pr = await resolvePullRequest(env, number);
      if (!pr) {
        return { content: [{ type: "text", text: `No pull request #${number} on record.` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(pr.commits ?? [], null, 2) }] };
    })
  );

  server.registerTool(
    "get_diff",
    {
      title: "Get diff",
      description: "Fetch the raw diff text for a pull request.",
      inputSchema: { number: z.number().int() }
    },
    traced("get_diff", async ({ number }) => {
      const pr = await resolvePullRequest(env, number);
      if (!pr) {
        return { content: [{ type: "text", text: `No pull request #${number} on record.` }], isError: true };
      }
      const diff = pr.diff_text ?? pr.diff_summary.map((d) => `${d.path} (+${d.additions}/-${d.deletions})`).join("\n");
      return { content: [{ type: "text", text: diff }] };
    })
  );

  server.registerTool(
    "search_code",
    {
      title: "Search code",
      description: "Search changed file paths across known pull requests.",
      inputSchema: { query: z.string().min(1) }
    },
    traced("search_code", async ({ query }) => {
      const results = searchCode(query);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    })
  );

  server.registerTool(
    "get_deployment",
    {
      title: "Get deployment status",
      description: "Fetch service metadata and deployment strategy for a given service id.",
      inputSchema: { service: z.string().describe("Service id, e.g. payment-service") }
    },
    traced("get_deployment", async ({ service }) => {
      const meta = getService(service);
      if (!meta) {
        return { content: [{ type: "text", text: `No service metadata on record for "${service}".` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(meta, null, 2) }] };
    })
  );

  server.registerTool(
    "get_incident_history",
    {
      title: "Get incident history",
      description: "Fetch prior incidents recorded for a service, from ForgeGuard's shared engineering memory.",
      inputSchema: { service: z.string() }
    },
    traced("get_incident_history", async ({ service }) => {
      const incidents = await engineeringMemoryStub(env).getIncidentsForService(service);
      return { content: [{ type: "text", text: JSON.stringify(incidents, null, 2) }] };
    })
  );

  return server;
}

export function mcpFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const handler = createMcpHandler(() => buildServer(env), { route: "/mcp" });
  return handler(request, env, ctx);
}
