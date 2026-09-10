import { useCallback, useEffect, useRef, useState } from "react";
import type { InboundMessage, PipelineStep, SessionState } from "../types";

export type ConnectionStatus = "connecting" | "open" | "closed" | "reconnecting";

const INITIAL_STATE: SessionState = {
  messages: [],
  activeInvestigation: null,
  pendingApproval: null
};

function agentSocketUrl(sessionId: string): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/agents/session-agent/${sessionId}`;
}

/**
 * Owns the WebSocket connection to a SessionAgent Durable Object: session
 * state (synced automatically by the Agents SDK via cf_agent_state, plus
 * our own explicit "state" message on connect), the live pipeline step
 * timeline (ephemeral — reset on every new outbound message), and
 * reconnection with backoff.
 */
export function useAgentSocket(sessionId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus((prev) => (prev === "open" ? "reconnecting" : "connecting"));
      const ws = new WebSocket(agentSocketUrl(sessionId));
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        retryDelay.current = 1000;
        setStatus("open");
      });

      ws.addEventListener("message", (event) => {
        let msg: InboundMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === "state" || msg.type === "cf_agent_state") {
          setState(msg.state as SessionState);
        } else if (msg.type === "pipeline_step") {
          const { step, status: stepStatus } = msg as { step: string; status: string };
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.name === step);
            const next = [...prev];
            const entry = { name: step, status: stepStatus, updatedAt: Date.now() };
            if (idx === -1) next.push(entry);
            else next[idx] = entry;
            return next;
          });
        }
      });

      ws.addEventListener("close", () => {
        if (cancelled) return;
        setStatus("reconnecting");
        reconnectTimer.current = setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 1.6, 15000);
      });

      ws.addEventListener("error", () => ws.close());
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [sessionId]);

  const send = useCallback((text: string) => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setSteps([]);
    wsRef.current.send(JSON.stringify({ type: "user_message", text }));
  }, []);

  return { status, state, steps, send };
}
