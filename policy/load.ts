import { parse } from "yaml";
import policiesYaml from "./policies.yaml";
import type { PolicyDocument, ProductionPolicy } from "./schema";

/**
 * Workers runtime loader — relies on the `Text` module rule in
 * wrangler.jsonc to bundle policies.yaml as a string. Use policy/load-node.ts
 * from plain Node tooling (evals, vitest) instead, since esbuild's Text rule
 * only applies inside wrangler's bundler.
 */
const document = parse(policiesYaml) as PolicyDocument;

export function getProductionPolicy(): ProductionPolicy {
  return document.policies.production;
}
