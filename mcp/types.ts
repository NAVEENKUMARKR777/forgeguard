export interface PullRequestCheck {
  name: string;
  status: "passed" | "failed" | "pending";
  detail?: string;
}

export interface DiffEntry {
  path: string;
  additions: number;
  deletions: number;
}

export interface CommitEntry {
  sha: string;
  message: string;
  author: string;
}

export interface ReviewEntry {
  reviewer: string;
  state: "approved" | "changes_requested" | "commented";
  comment: string;
}

export interface PullRequest {
  number: number;
  title: string;
  service: string;
  author: string;
  files_changed: number;
  diff_summary: DiffEntry[];
  checks: PullRequestCheck[];
  test_coverage_delta: number;
  touches_production_config: boolean;
  touches_database_migration: boolean;
  commits?: CommitEntry[];
  reviews?: ReviewEntry[];
  diff_text?: string;
}

export interface ServiceMeta {
  id: string;
  owner: string;
  criticality: "low" | "medium" | "high";
  repository: string;
  deployment_strategy: string;
  common_failure_modes: string[];
  previous_incidents: string[];
}

export interface PipelineJob {
  name: string;
  status: "passed" | "failed" | "pending";
  duration_s: number;
  failure?: string;
}

export interface Pipeline {
  service: string;
  pipeline_id: string;
  pr: number;
  jobs: PipelineJob[];
  deployment: {
    environment: string;
    strategy: string;
    health: string;
  };
}

export interface IncidentFixture {
  id: string;
  service: string;
  cause: string;
  resolution: string;
  affected_service: string;
  learned_rule: string;
}
