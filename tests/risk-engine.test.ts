import { describe, expect, it } from "vitest";
import { assessRisk } from "../risk/engine";
import { evaluatePolicy } from "../policy/engine";
import { getProductionPolicy } from "../policy/load-node";
import type { PullRequest } from "../mcp/types";

function pr(overrides: Partial<PullRequest>): PullRequest {
  return {
    number: 1,
    title: "test",
    service: "svc",
    author: "test",
    files_changed: 1,
    diff_summary: [],
    checks: [],
    test_coverage_delta: 0,
    touches_production_config: false,
    touches_database_migration: false,
    ...overrides
  };
}

describe("assessRisk", () => {
  it("scores a trivial change as LOW", () => {
    const risk = assessRisk({ pr: pr({}), service: null, pipeline: null, incidents: [] });
    expect(risk.band).toBe("LOW");
  });

  it("raises the security component when production config is touched", () => {
    const risk = assessRisk({
      pr: pr({ touches_production_config: true }),
      service: null,
      pipeline: null,
      incidents: []
    });
    const security = risk.components.find((c) => c.name === "security");
    expect(security?.score).toBeGreaterThan(10);
  });
});

describe("evaluatePolicy", () => {
  it("requires approval when a database migration is present", () => {
    const testPr = pr({ touches_database_migration: true });
    const risk = assessRisk({ pr: testPr, service: null, pipeline: null, incidents: [] });
    const decision = evaluatePolicy({ pr: testPr, risk }, getProductionPolicy());
    expect(decision.approvalRequired).toBe(true);
    expect(decision.reasons.join(" ")).toMatch(/migration/);
  });

  it("does not require approval for a low-risk, fully-passing change", () => {
    const testPr = pr({
      checks: [
        { name: "unit-tests", status: "passed" },
        { name: "integration-tests", status: "passed" },
        { name: "security-scan", status: "passed" }
      ]
    });
    const risk = assessRisk({ pr: testPr, service: null, pipeline: null, incidents: [] });
    const decision = evaluatePolicy({ pr: testPr, risk }, getProductionPolicy());
    expect(decision.approvalRequired).toBe(false);
  });
});
