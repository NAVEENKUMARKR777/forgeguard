import type { OpenPullRequest } from "../types";

const SUGGESTIONS = [
  "Why is it risky?",
  "What should I fix first?",
  "Start the remediation workflow",
  "merge this pr",
  "close this pr",
  "Investigate the forgeguard incident",
  "Remember that forgeguard uses direct deployment"
];

function SidebarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted transition hover:bg-panel-2 hover:text-ink"
    >
      {label}
    </button>
  );
}

export function Sidebar({
  onSend,
  openPullRequests
}: {
  onSend: (text: string) => void;
  openPullRequests: OpenPullRequest[];
}) {
  return (
    <nav className="flex flex-col gap-5 overflow-y-auto border-r border-border p-3">
      <div>
        <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Open pull requests</h2>
        <div className="flex flex-col gap-0.5">
          {openPullRequests.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted">No open PRs right now.</p>
          ) : (
            openPullRequests.map((pr) => (
              <SidebarButton
                key={pr.number}
                label={`#${pr.number} ${pr.title}`}
                onClick={() => onSend(`Is PR #${pr.number} safe to deploy?`)}
              />
            ))
          )}
        </div>
      </div>
      <div>
        <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Try</h2>
        <div className="flex flex-col gap-0.5">
          {SUGGESTIONS.map((s) => (
            <SidebarButton key={s} label={s} onClick={() => onSend(s)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
