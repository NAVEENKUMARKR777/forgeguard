import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

export function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend: (text: string) => void }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <main className="flex min-h-0 flex-col">
      <div ref={logRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-5">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-muted">
            Ask ForgeGuard about a release, an incident, or a service — try the sidebar for ideas.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </div>
      <Composer onSend={onSend} />
    </main>
  );
}
