import type { ConnectionStatus as Status } from "../hooks/useAgentSocket";

const LABEL: Record<Status, string> = {
  connecting: "Connecting…",
  open: "Connected",
  closed: "Disconnected",
  reconnecting: "Reconnecting…"
};

const DOT: Record<Status, string> = {
  connecting: "bg-warning animate-pulse-dot",
  open: "bg-success",
  closed: "bg-danger",
  reconnecting: "bg-warning animate-pulse-dot"
};

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </div>
  );
}
