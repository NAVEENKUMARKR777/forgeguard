import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { PolicyDocument, ProductionPolicy } from "./schema";

/** Node-native counterpart to policy/load.ts, for evals and vitest. */
const yamlPath = join(import.meta.dirname, "./policies.yaml");
const document = parse(readFileSync(yamlPath, "utf-8")) as PolicyDocument;

export function getProductionPolicy(): ProductionPolicy {
  return document.policies.production;
}
