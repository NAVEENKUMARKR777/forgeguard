import pipeline1842 from "../fixtures/ci/payment-service-pipeline.json";
import type { Pipeline, PipelineJob } from "./types";

/**
 * Fixture-backed stand-in for a CI/CD MCP server: `get_pipeline`,
 * `get_job`, `get_test_results`, `get_artifacts`, `get_deployment`,
 * `get_deployment_health`. Lets ForgeGuard reason across the chain
 * PR → CI pipeline → jobs → tests → artifacts → deployment → health
 * instead of treating CI as one opaque boolean. See mcp/github.ts for the
 * same fixture/live-swap pattern.
 */
const PIPELINES_BY_PR: Record<number, Pipeline> = {
  1842: pipeline1842 as Pipeline
};

export function getPipeline(prNumber: number): Pipeline | null {
  return PIPELINES_BY_PR[prNumber] ?? null;
}

export function getJob(prNumber: number, jobName: string): PipelineJob | null {
  return getPipeline(prNumber)?.jobs.find((j) => j.name === jobName) ?? null;
}

/** Every job that actually ran tests, i.e. every job except a pure build/lint step. */
export function getTestResults(prNumber: number): PipelineJob[] {
  return getPipeline(prNumber)?.jobs.filter((j) => j.name.includes("test")) ?? [];
}

/** No artifact-storage fixture exists yet — returns `[]` for a known
 * pipeline (nothing tracked) or `null` for an unknown PR, rather than
 * fabricating build artifacts that don't exist anywhere else in this
 * scaffold. */
export function getArtifacts(prNumber: number): { name: string; url: string }[] | null {
  return getPipeline(prNumber) ? [] : null;
}

export function getDeployment(prNumber: number): Pipeline["deployment"] | null {
  return getPipeline(prNumber)?.deployment ?? null;
}

export function getDeploymentHealth(prNumber: number): string | null {
  return getPipeline(prNumber)?.deployment.health ?? null;
}
