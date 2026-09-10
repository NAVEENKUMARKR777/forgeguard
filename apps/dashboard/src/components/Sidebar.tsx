const SERVICES = [
  { name: "payment-service", prompt: "Is PR #1842 safe to deploy?" },
  { name: "checkout-service", prompt: "How should we deploy checkout-service?" },
  { name: "identity-service", prompt: "How should we deploy identity-service?" },
  { name: "notifications-service", prompt: "How should we deploy notifications-service?" }
];

const SUGGESTIONS = [
  "Is PR #1842 safe to deploy?",
  "Why is it risky?",
  "What should I fix first?",
  "Start the remediation workflow",
  "Investigate the payment-service incident",
  "Payments are returning 500s, investigate",
  "Remember that payments uses canary deployment"
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

export function Sidebar({ onSend }: { onSend: (text: string) => void }) {
  return (
    <nav className="flex flex-col gap-5 overflow-y-auto border-r border-border p-3">
      <div>
        <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Services</h2>
        <div className="flex flex-col gap-0.5">
          {SERVICES.map((s) => (
            <SidebarButton key={s.name} label={s.name} onClick={() => onSend(s.prompt)} />
          ))}
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
