import { compareRuns } from "./compare";
import type { EvalCaseRecord, EvalRunDetail, EvalRunSubmission, EvalRunSummary } from "./history-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json" } });
}

async function recordRun(db: D1Database, submission: EvalRunSubmission): Promise<Response> {
  const passed = submission.results.filter((r) => r.ok).length;
  const failed = submission.results.length - passed;

  const statements = [
    db
      .prepare("INSERT INTO eval_runs (run_id, ran_at, git_commit, model_provider, passed, failed) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(submission.runId, submission.ranAt, submission.gitCommit, submission.modelProvider, passed, failed),
    ...submission.results.map((r) =>
      db
        .prepare("INSERT INTO eval_cases (run_id, suite, name, ok, detail) VALUES (?, ?, ?, ?, ?)")
        .bind(submission.runId, r.suite, r.name, r.ok ? 1 : 0, r.detail)
    )
  ];
  await db.batch(statements);
  return json({ runId: submission.runId, passed, failed }, 201);
}

async function listRuns(db: D1Database, limit: number): Promise<Response> {
  const { results } = await db
    .prepare("SELECT run_id, ran_at, git_commit, model_provider, passed, failed FROM eval_runs ORDER BY ran_at DESC LIMIT ?")
    .bind(limit)
    .all<{ run_id: string; ran_at: string; git_commit: string | null; model_provider: string; passed: number; failed: number }>();

  const runs: EvalRunSummary[] = results.map((r) => ({
    runId: r.run_id,
    ranAt: r.ran_at,
    gitCommit: r.git_commit,
    modelProvider: r.model_provider,
    passed: r.passed,
    failed: r.failed
  }));
  return json({ runs });
}

async function getRunDetail(db: D1Database, runId: string): Promise<EvalRunDetail | null> {
  const run = await db
    .prepare("SELECT run_id, ran_at, git_commit, model_provider, passed, failed FROM eval_runs WHERE run_id = ?")
    .bind(runId)
    .first<{ run_id: string; ran_at: string; git_commit: string | null; model_provider: string; passed: number; failed: number }>();
  if (!run) return null;

  const { results } = await db
    .prepare("SELECT suite, name, ok, detail FROM eval_cases WHERE run_id = ?")
    .bind(runId)
    .all<{ suite: string; name: string; ok: number; detail: string }>();

  const cases: EvalCaseRecord[] = results.map((c) => ({ suite: c.suite, name: c.name, ok: c.ok === 1, detail: c.detail }));
  return {
    runId: run.run_id,
    ranAt: run.ran_at,
    gitCommit: run.git_commit,
    modelProvider: run.model_provider,
    passed: run.passed,
    failed: run.failed,
    cases
  };
}

/**
 * Serves the eval-history API backed by D1 (see
 * docs/decisions/ADR-015-eval-history.md for why D1 over KV/JSON
 * artifacts). Writing happens from `npm run evals:record`
 * (scripts/record-eval-run.mjs), which POSTs the same report
 * `npm run evals` already computes — the fast, infra-free `npm run evals`
 * used as the CI gate is unchanged and never touches D1.
 */
export async function evalHistoryFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean); // ["evals", "runs", ...]

  if (request.method === "POST" && segments[1] === "runs" && segments.length === 2) {
    const submission = (await request.json()) as EvalRunSubmission;
    return recordRun(env.EVAL_HISTORY_DB, submission);
  }

  if (request.method === "GET" && segments[1] === "runs" && segments.length === 2) {
    const limit = Number(url.searchParams.get("limit") ?? "20");
    return listRuns(env.EVAL_HISTORY_DB, limit);
  }

  if (request.method === "GET" && segments[1] === "runs" && segments[2]) {
    const detail = await getRunDetail(env.EVAL_HISTORY_DB, segments[2]);
    if (!detail) return json({ error: "Run not found" }, 404);
    return json(detail);
  }

  if (request.method === "GET" && segments[1] === "compare") {
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");
    if (!fromId || !toId) return json({ error: "Both ?from= and ?to= run ids are required" }, 400);
    const [from, to] = await Promise.all([getRunDetail(env.EVAL_HISTORY_DB, fromId), getRunDetail(env.EVAL_HISTORY_DB, toId)]);
    if (!from || !to) return json({ error: "One or both runs not found" }, 404);
    return json(compareRuns(from, to));
  }

  return json({ error: "Not found" }, 404);
}
