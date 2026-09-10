import { useEffect, useState } from "react";
import type { OpenPullRequest } from "../types";

const POLL_INTERVAL_MS = 30000;

/** Polls the real, live list of open pull requests — the dashboard's only
 * timer-based fetch (everything else is WebSocket push); see
 * src/worker.ts's `/pull-requests` route and
 * mcp/github.ts#fetchOpenPullRequests (which caches the actual GitHub
 * call server-side, since every connected dashboard polling independently
 * would otherwise multiply both Workers requests and GitHub rate-limit
 * spend on the free plan). Paused while the tab isn't visible, for the
 * same reason. */
export function useOpenPullRequests(): OpenPullRequest[] {
  const [prs, setPrs] = useState<OpenPullRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      fetch("/pull-requests")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (!cancelled) setPrs(data);
        })
        .catch(() => {
          /* keep showing the last known list on a transient fetch error */
        });
    };

    const start = () => {
      if (interval) return;
      load();
      interval = setInterval(load, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const onVisibilityChange = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) start();

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return prs;
}
