import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { PolicyDocument, ProductionPolicy } from "./schema";

/** Node-native counterpart to policy/load.ts, for evals and vitest. */
const yamlPath = fileURLToPath(new URL("./policies.yaml", import.meta.url));
const document = parse(readFileSync(yamlPath, "utf-8")) as PolicyDocument;

export function getProductionPolicy(): ProductionPolicy {
  return document.policies.production;
}
