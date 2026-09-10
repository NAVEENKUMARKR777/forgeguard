import { useMemo } from "react";
import { useAgentSocket } from "../hooks/useAgentSocket";
import { useOpenPullRequests } from "../hooks/useOpenPullRequests";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { ChatPanel } from "../components/ChatPanel";
import { InvestigationPanel } from "../components/InvestigationPanel";

const SESSION_ID_KEY = "forgeguard-session-id";

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "demo";
  }
}

/** A brand-new session id (and reload) is a genuinely fresh SessionAgent
 * Durable Object instance — same as opening the dashboard in an
 * incognito window, just without leaving your current one. */
function startNewChat(): void {
  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // localStorage unavailable — reloading still gets a fresh "demo" session
  }
  location.reload();
}

export function ChatPage() {
  const sessionId = useMemo(getSessionId, []);
  const { status, state, steps, send } = useAgentSocket(sessionId);
  const openPullRequests = useOpenPullRequests();

  return (
    <div className="grid h-full grid-cols-[220px_1fr_320px] grid-rows-[auto_1fr]">
      <Header status={status} onNewChat={startNewChat} />
      <Sidebar onSend={send} openPullRequests={openPullRequests} />
      <ChatPanel messages={state.messages} onSend={send} />
      <InvestigationPanel
        investigation={state.activeInvestigation}
        pendingApproval={state.pendingApproval}
        steps={steps}
        onApprove={() => send("approve")}
        onReject={() => send("reject")}
        onMerge={() => send("merge this pr")}
        onClose={() => send("close this pr")}
      />
    </div>
  );
}
