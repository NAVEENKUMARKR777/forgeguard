import type { Investigation } from "../types";

const RESOLVED_STATUSES = new Set(["resolved", "merged", "closed"]);

export function MergeControls({
  investigation,
  onMerge,
  onClose
}: {
  investigation: Investigation | null;
  onMerge: () => void;
  onClose: () => void;
}) {
  if (!investigation || !RESOLVED_STATUSES.has(investigation.status)) {
    return <p className="text-xs text-muted">Analyze and resolve a PR before deciding to merge or close it.</p>;
  }

  if (investigation.status === "merged") {
    return <p className="text-xs text-success">PR #{investigation.prNumber} merged.</p>;
  }
  if (investigation.status === "closed") {
    return <p className="text-xs text-danger">PR #{investigation.prNumber} closed.</p>;
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-2">
      <p className="text-xs text-ink">Decide what happens to PR #{investigation.prNumber} on GitHub.</p>
      <div className="flex gap-2">
        <button
          onClick={onMerge}
          className="flex-1 rounded-md border border-success/40 bg-success-dim px-3 py-1.5 text-xs font-medium text-success transition hover:brightness-125"
        >
          Merge PR
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-md border border-danger/40 bg-danger-dim px-3 py-1.5 text-xs font-medium text-danger transition hover:brightness-125"
        >
          Close PR
        </button>
      </div>
    </div>
  );
}
