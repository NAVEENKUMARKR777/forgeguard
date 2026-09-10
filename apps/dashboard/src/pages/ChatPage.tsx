import { useMemo } from "react";
import { useAgentSocket } from "../hooks/useAgentSocket";
import { useOpenPullRequests } from "../hooks/useOpenPullRequests";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { ChatPanel } from "../components/ChatPanel";
import { InvestigationPanel } from "../components/InvestigationPanel";

function getSessionId(): string {
  try {
    const key = "forgeguard-session-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "demo";
  }
}

export function ChatPage() {
  const sessionId = useMemo(getSessionId, []);
  const { status, state, steps, send } = useAgentSocket(sessionId);
  const openPullRequests = useOpenPullRequests();

  return (
    <div className="grid h-full grid-cols-[220px_1fr_320px] grid-rows-[auto_1fr]">
      <Header status={status} />
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
