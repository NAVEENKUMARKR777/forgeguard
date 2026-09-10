import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildContext } from "../../context/builder";

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

const MODEL_TS_SECRET_ENV_NAMES = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY"];
const ALL_SECRET_ENV_NAMES = [...MODEL_TS_SECRET_ENV_NAMES, "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];

describe("no secret env var ever flows into model-facing text", () => {
  it("agents/model.ts only uses secret env vars in request headers, never in message content", () => {
    const source = readSource("../../agents/model.ts");
    for (const name of MODEL_TS_SECRET_ENV_NAMES) {
      const usages = [...source.matchAll(new RegExp(`env\\.${name}`, "g"))];
      expect(usages.length).toBeGreaterThan(0); // sanity: the var is actually used somewhere
      // None of those usages should appear inside a `content:` field's template literal.
      const contentLines = source.split("\n").filter((line) => line.includes("content:"));
      for (const line of contentLines) {
        expect(line).not.toContain(`env.${name}`);
      }
    }
  });

  it("release-agent.ts and planner.ts never reference secret env vars at all", () => {
    for (const file of ["../../agents/release-agent.ts", "../../agents/planner.ts"]) {
      const source = readSource(file);
      for (const name of ALL_SECRET_ENV_NAMES) {
        expect(source).not.toContain(name);
      }
    }
  });

  it("buildContext output for a realistic investigation contains no bearer-token-shaped strings", () => {
    const built = buildContext(
      [
        { source: "pull_request", priority: 1, content: "Title: Add retry logic" },
        { source: "risk_assessment", priority: 2, content: "security: 18/20 (modifies production configuration)" }
      ],
      4000
    );
    expect(built.text).not.toMatch(/sk-[a-zA-Z0-9]{20,}/); // OpenAI-shaped key
    expect(built.text).not.toMatch(/Bearer [a-zA-Z0-9._-]{20,}/);
  });
});
