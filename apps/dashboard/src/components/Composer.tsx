import { useState, type FormEvent } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const { supported, listening, toggle } = useSpeechRecognition((transcript) => onSend(transcript));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask: Is PR #1842 safe to deploy?"
        autoComplete="off"
        className="flex-1 rounded-lg border border-border-2 bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      {supported && (
        <button
          type="button"
          onClick={toggle}
          title="Voice input"
          className={`rounded-lg border border-border-2 px-3 py-2 text-sm transition ${
            listening ? "border-danger bg-danger-dim" : "bg-panel-2 hover:bg-panel-3"
          }`}
        >
          🎤
        </button>
      )}
      <button
        type="submit"
        className="rounded-lg border border-border-2 bg-panel-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-panel-3"
      >
        Send
      </button>
    </form>
  );
}
