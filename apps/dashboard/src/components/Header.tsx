import { NavLink } from "react-router-dom";
import type { ConnectionStatus as Status } from "../hooks/useAgentSocket";
import { ConnectionStatus } from "./ConnectionStatus";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1 text-xs font-medium transition ${
    isActive ? "bg-panel-3 text-ink" : "text-muted hover:text-ink"
  }`;

export function Header({ status }: { status?: Status }) {
  return (
    <header className="col-span-full flex items-center gap-3 border-b border-border px-5 py-2.5">
      <span className="text-lg">🛡️</span>
      <h1 className="text-sm font-semibold text-ink">ForgeGuard</h1>
      <span className="hidden text-xs text-muted sm:inline">AI release &amp; incident commander</span>
      <nav className="ml-2 flex gap-1">
        <NavLink to="/" end className={linkClass}>
          Chat
        </NavLink>
        <NavLink to="/evals" className={linkClass}>
          Evals
        </NavLink>
        <NavLink to="/productivity" className={linkClass}>
          Productivity
        </NavLink>
      </nav>
      <div className="flex-1" />
      <a href="/mcp" className="text-xs text-accent hover:underline">
        MCP server
      </a>
      {status && <ConnectionStatus status={status} />}
    </header>
  );
}
