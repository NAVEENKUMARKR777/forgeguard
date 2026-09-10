import type { ObservabilityEvent, ObservabilityEventType } from "./events";

/**
 * One structured event per line (`console.log(JSON.stringify(...))`) —
 * Cloudflare's `observability.enabled` in wrangler.jsonc ships Worker logs
 * to the dashboard already, so a structured line here is queryable there
 * without any extra plumbing. Deliberately not a scattered
 * `console.log("did the thing")` — every call site passes the same event
 * shape, so these lines can be filtered/aggregated by `event` type.
 */
export function emit(event: Omit<ObservabilityEvent, "timestamp"> & { event: ObservabilityEventType }): void {
  const full: ObservabilityEvent = { ...event, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(full));
}

/** Wraps an async operation, always emitting one event with duration and success/failure. */
export async function withObservability<T>(
  event: ObservabilityEventType,
  fields: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    emit({ event, ...fields, durationMs: Date.now() - start, success: true });
    return result;
  } catch (error) {
    emit({ event, ...fields, durationMs: Date.now() - start, success: false, error: (error as Error).message });
    throw error;
  }
}
