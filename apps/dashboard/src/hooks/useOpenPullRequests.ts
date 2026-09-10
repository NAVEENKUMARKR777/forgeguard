import { useEffect, useState } from "react";
import type { OpenPullRequest } from "../types";

const POLL_INTERVAL_MS = 15000;

/** Polls the real, live list of open pull requests — the dashboard's only
 * timer-based fetch (everything else is WebSocket push); see
 * src/worker.ts's `/pull-requests` route and mcp/github.ts#fetchOpenPullRequests. */
export function useOpenPullRequests(): OpenPullRequest[] {
  const [prs, setPrs] = useState<OpenPullRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
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
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return prs;
}
