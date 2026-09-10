import { Agent, type Connection, type WSMessage } from "agents";
import { plan } from "./planner";
import { ensureAuditSchema, type SqlFn } from "../memory/sql";
import type { AgentContext, SessionState } from "./types";

/**
 * Thin Durable Object shell: owns the WebSocket protocol, synced state, and
 * this session's own SQL (audit log only — incident/engineering memory is
 * shared across sessions, see durable-objects/engineering-memory.ts). All
 * actual behavior lives in agents/planner.ts and the release-agent /
 * incident-agent modules it dispatches to.
 */
export class SessionAgent extends Agent<Env, SessionState> {
  initialState: SessionState = { messages: [], activeInvestigation: null, pendingApproval: null };

  /** Agent#sql relies on its own `this` internally, so a bare `this.sql`
   * reference breaks once handed to a helper — wrap it once here instead. */
  private readonly sqlFn: SqlFn = (strings, ...values) => this.sql(strings, ...values);

  async onStart(): Promise<void> {
    ensureAuditSchema(this.sqlFn);
  }

  onConnect(connection: Connection): void {
    connection.send(JSON.stringify({ type: "state", state: this.state }));
  }

  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    if (typeof message !== "string") return;
    let parsed: { type?: string; text?: string };
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    if (parsed.type === "user_message" && typeof parsed.text === "string") {
      await this.handleUserMessage(connection, parsed.text);
    }
  }

  private async handleUserMessage(connection: Connection, text: string): Promise<void> {
    this.appendMessage("user", text);
    const ctx: AgentContext = {
      env: this.env,
      sql: this.sqlFn,
      requestId: crypto.randomUUID(),
      sessionId: this.name,
      getState: () => this.state,
      setState: (state) => this.setState(state),
      emitStep: (step, status) => connection.send(JSON.stringify({ type: "pipeline_step", step, status })),
      send: (replyText) => {
        this.appendMessage("assistant", replyText);
        connection.send(JSON.stringify({ type: "assistant_message", text: replyText }));
      }
    };
    await plan(ctx, text);
  }

  private appendMessage(role: "user" | "assistant", text: string): void {
    this.setState({
      ...this.state,
      messages: [...this.state.messages, { role, text, ts: Date.now() }]
    });
  }
}
