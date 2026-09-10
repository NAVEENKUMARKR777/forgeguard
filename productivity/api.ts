import { getProductivitySnapshot, listServices } from "./metrics";
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
 * Serves /productivity/overview, /productivity/metrics,
 * /productivity/services/:service — never bare /productivity itself, which
 * is the React page (see src/worker.ts: only /productivity/* sub-paths are
 * routed here, so a browser loading /productivity always gets the SPA via
 * the Assets binding, never this JSON). Every response carries
 * `source: "fixture"` (see productivity/metrics.ts) — this is synthetic
 * engineering-metrics data, never live telemetry.
 */
export function productivityFetch(request: Request): Response {
  const url = new URL(request.url);
  const window = parseWindow(url.searchParams.get("window"));
  const segments = url.pathname.split("/").filter(Boolean); // ["productivity", ...]

  if (segments[1] === "overview") {
    // GET /productivity/overview — aggregate snapshot across every known service
    const snapshots = listServices().map((service) => getProductivitySnapshot(service, window));
    return json({ services: listServices(), window, snapshots });
  }

  if (segments[1] === "metrics") {
    const service = url.searchParams.get("service") ?? "all";
    const snapshot = getProductivitySnapshot(service, window);
    if (!snapshot) return json({ error: `Unknown service "${service}"` }, 404);
    return json(snapshot);
  }

  if (segments[1] === "services" && segments[2]) {
    const snapshot = getProductivitySnapshot(segments[2], window);
    if (!snapshot) return json({ error: `Unknown service "${segments[2]}"` }, 404);
    return json(snapshot);
  }

  return json({ error: "Not found" }, 404);
}
