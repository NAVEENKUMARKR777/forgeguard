import type { EvalCaseRecord, EvalRunComparison, EvalRunDetail } from "./history-types";

function passRate(run: { passed: number; failed: number }): number {
  const total = run.passed + run.failed;
  return total === 0 ? 0 : run.passed / total;
}

/**
 * Pure diff between two eval runs — no D1, no network, fully unit-testable
 * (see tests/eval-comparison.test.ts). The Worker-side API
 * (evals/history-api.ts) is just "fetch two runs from D1, hand them to
 * this function."
 */
export function compareRuns(from: EvalRunDetail, to: EvalRunDetail): EvalRunComparison {
  const key = (c: EvalCaseRecord) => `${c.suite}::${c.name}`;
  const fromByKey = new Map(from.cases.map((c) => [key(c), c]));
  const toByKey = new Map(to.cases.map((c) => [key(c), c]));

  const newlyFailing: { suite: string; name: string }[] = [];
  const newlyPassing: { suite: string; name: string }[] = [];

  for (const [k, toCase] of toByKey) {
    const fromCase = fromByKey.get(k);
    if (!fromCase) continue; // a brand-new case, not a regression/fix
    if (fromCase.ok && !toCase.ok) newlyFailing.push({ suite: toCase.suite, name: toCase.name });
    if (!fromCase.ok && toCase.ok) newlyPassing.push({ suite: toCase.suite, name: toCase.name });
  }

  const suites = new Set([...from.cases, ...to.cases].map((c) => c.suite));
  const suiteDeltas = [...suites].map((suite) => {
    const beforeCases = from.cases.filter((c) => c.suite === suite);
    const afterCases = to.cases.filter((c) => c.suite === suite);
    return {
      suite,
      passedBefore: beforeCases.filter((c) => c.ok).length,
      totalBefore: beforeCases.length,
      passedAfter: afterCases.filter((c) => c.ok).length,
      totalAfter: afterCases.length
    };
  });

  return {
    from: { runId: from.runId, ranAt: from.ranAt, gitCommit: from.gitCommit, modelProvider: from.modelProvider, passed: from.passed, failed: from.failed },
    to: { runId: to.runId, ranAt: to.ranAt, gitCommit: to.gitCommit, modelProvider: to.modelProvider, passed: to.passed, failed: to.failed },
    passRateDelta: Math.round((passRate(to) - passRate(from)) * 1000) / 1000,
    newlyFailing,
    newlyPassing,
    suiteDeltas
  };
}
