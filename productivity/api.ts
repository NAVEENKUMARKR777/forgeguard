import { getProductivitySnapshot } from "./metrics";
import { engineeringMemoryStub } from "../durable-objects/engineering-memory";
import type { ProductivityWindow } from "../types/productivity";

function parseWindow(raw: string | null): ProductivityWindow {
  if (raw === "7d" || raw === "7") return 7;
  if (raw === "90d" || raw === "90") return 90;
  return 30;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" }
  });
}

/**
 * Serves /productivity/metrics — never bare /productivity itself, which is
 * the React page (see src/worker.ts: only /productivity/* sub-paths are
 * routed here, so a browser loading /productivity always gets the SPA via
 * the Assets binding, never this JSON). One real repo now, so there's no
 * per-service dimension left — see productivity/metrics.ts for the real
 * (`source: "live"`) data this serves.
 */
export async function productivityFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const window = parseWindow(url.searchParams.get("window"));
  const segments = url.pathname.split("/").filter(Boolean); // ["productivity", ...]

  if (segments[1] === "metrics") {
    const incidents = await engineeringMemoryStub(env).getAllIncidents();
    return json(await getProductivitySnapshot(env, window, incidents));
  }

  return json({ error: "Not found" }, 404);
}
