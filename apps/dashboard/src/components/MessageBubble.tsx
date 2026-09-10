import type { ChatMessage } from "../types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`animate-fade-in-up max-w-[70ch] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser ? "self-end bg-accent-dim text-ink" : "self-start border border-border bg-panel-3 text-ink"
      }`}
    >
      {message.text}
    </div>
  );
}
