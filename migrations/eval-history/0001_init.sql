CREATE TABLE eval_runs (
  run_id TEXT PRIMARY KEY,
  ran_at TEXT NOT NULL,
  git_commit TEXT,
  model_provider TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL
);

CREATE TABLE eval_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES eval_runs(run_id),
  suite TEXT NOT NULL,
  name TEXT NOT NULL,
  ok INTEGER NOT NULL,
  detail TEXT
);

CREATE INDEX idx_eval_cases_run_id ON eval_cases(run_id);
CREATE INDEX idx_eval_runs_ran_at ON eval_runs(ran_at);
