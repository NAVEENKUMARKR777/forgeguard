import type { PendingApproval } from "../types";

export function ApprovalControls({
  pendingApproval,
  onApprove,
  onReject
}: {
  pendingApproval: PendingApproval | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!pendingApproval) {
    return <p className="text-xs text-muted">Nothing waiting on a human right now.</p>;
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-2">
      <p className="text-xs text-ink">
        A <span className="font-medium">{pendingApproval.kind}</span> workflow is paused, waiting for your decision.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 rounded-md border border-success/40 bg-success-dim px-3 py-1.5 text-xs font-medium text-success transition hover:brightness-125"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 rounded-md border border-danger/40 bg-danger-dim px-3 py-1.5 text-xs font-medium text-danger transition hover:brightness-125"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
