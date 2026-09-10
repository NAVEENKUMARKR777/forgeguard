import type { PolicyDecision } from "../types";

export function PolicyCard({ policy }: { policy: PolicyDecision }) {
  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        policy.approvalRequired ? "border-danger/40 bg-danger-dim/40" : "border-success/30 bg-success-dim/30"
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className={policy.approvalRequired ? "text-danger" : "text-success"}>
          {policy.approvalRequired ? "Approval required" : "No approval needed"}
        </span>
      </div>
      {policy.reasons.length > 0 && (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted">
          {policy.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {policy.violations.length > 0 && (
        <div className="mt-2 border-t border-border/60 pt-1.5">
          <p className="font-medium text-danger">Policy violations</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted">
            {policy.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
