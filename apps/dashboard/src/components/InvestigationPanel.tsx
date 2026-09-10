import type { Investigation, PendingApproval, PipelineStep } from "../types";
import { RiskGauge } from "./RiskGauge";
import { RiskBreakdown } from "./RiskBreakdown";
import { PolicyCard } from "./PolicyCard";
import { PipelinePanel } from "./PipelinePanel";
import { ApprovalControls } from "./ApprovalControls";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function InvestigationPanel({
  investigation,
  pendingApproval,
  steps,
  onApprove,
  onReject
}: {
  investigation: Investigation | null;
  pendingApproval: PendingApproval | null;
  steps: PipelineStep[];
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <aside className="flex flex-col gap-6 overflow-y-auto border-l border-border p-4">
      <Section title="Pipeline">
        <PipelinePanel steps={steps} />
      </Section>

      <Section title="Approval">
        <ApprovalControls pendingApproval={pendingApproval} onApprove={onApprove} onReject={onReject} />
      </Section>

      {investigation && (
        <>
          <Section title={`Release risk — PR #${investigation.prNumber}`}>
            <div className="flex justify-center py-1">
              <RiskGauge score={investigation.risk.total} band={investigation.risk.band} />
            </div>
            <div className="mt-3">
              <RiskBreakdown components={investigation.risk.components} />
            </div>
          </Section>

          <Section title="Policy">
            <PolicyCard policy={investigation.policy} />
          </Section>
        </>
      )}
    </aside>
  );
}
