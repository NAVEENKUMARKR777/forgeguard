export interface EvalCaseRecord {
  suite: string;
  name: string;
  ok: boolean;
  detail: string;
}

export interface EvalRunSubmission {
  runId: string;
  ranAt: string;
  gitCommit: string | null;
  modelProvider: string;
  results: EvalCaseRecord[];
}

export interface EvalRunSummary {
  runId: string;
  ranAt: string;
  gitCommit: string | null;
  modelProvider: string;
  passed: number;
  failed: number;
}

export interface EvalRunDetail extends EvalRunSummary {
  cases: EvalCaseRecord[];
}

export interface SuiteDelta {
  suite: string;
  passedBefore: number;
  totalBefore: number;
  passedAfter: number;
  totalAfter: number;
}

export interface EvalRunComparison {
  from: EvalRunSummary;
  to: EvalRunSummary;
  passRateDelta: number;
  newlyFailing: { suite: string; name: string }[];
  newlyPassing: { suite: string; name: string }[];
  suiteDeltas: SuiteDelta[];
}
