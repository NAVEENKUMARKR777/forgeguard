import { withObservability } from "../observability/logger";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";
// Groq deprecated llama-3.3-70b-versatile (2026-08-16); this is Groq's own
// documented replacement (console.groq.com/docs/deprecations). Workers AI's
// Llama 3.3 (WORKERS_AI_MODEL above) is unaffected — the deprecation is
// Groq-side only, not a statement about Llama 3.3 itself.
const GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Provider-agnostic text generation. `MODEL_PROVIDER` (wrangler.jsonc `vars`,
 * overridable per-developer via `.dev.vars`) defaults to "workers-ai", which
 * the rest of this codebase always exercises (no credentials needed beyond
 * `wrangler login`/a Cloudflare account) — this stays the default for a
 * deployed instance. "openai" and "anthropic" are implemented against each
 * provider's public REST API but untested in this environment — no API key
 * here to call them with. "groq" is the one alternative actually verified
 * end-to-end with a real key (see ADR-019) — its Chat Completions API is
 * OpenAI-compatible, so `generateWithGroq` only differs from
 * `generateWithOpenAI` by base URL, key, and model. See
 * docs/decisions/ADR-006-model-providers.md, ADR-019, and .dev.vars.example.
 * Do not add an SDK dependency for any of these; a single `fetch` call is
 * all each API needs.
 */
export async function generateText(env: Env, messages: ChatTurn[]): Promise<string> {
  const provider = (env.MODEL_PROVIDER as string) || "workers-ai";
  const approxPromptTokens = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);

  return withObservability("llm.call", { provider, approxPromptTokens }, async () => {
    switch (provider) {
      case "workers-ai":
        return generateWithWorkersAI(env, messages);
      case "openai":
        return generateWithOpenAI(env, messages);
      case "anthropic":
        return generateWithAnthropic(env, messages);
      case "groq":
        return generateWithGroq(env, messages);
      default:
        throw new Error(`Unknown MODEL_PROVIDER "${provider}" — expected workers-ai, openai, anthropic, or groq.`);
    }
  });
}

async function generateWithWorkersAI(env: Env, messages: ChatTurn[]): Promise<string> {
  const output = await env.AI.run(WORKERS_AI_MODEL, { messages });
  return extractWorkersAiText(output);
}

function extractWorkersAiText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "response" in output) {
    const response = (output as { response?: unknown }).response;
    return typeof response === "string" ? response : "";
  }
  return "";
}

async function generateWithOpenAI(env: Env, messages: ChatTurn[]): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("MODEL_PROVIDER=openai requires OPENAI_API_KEY — see .dev.vars.example");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages })
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message.content ?? "";
}

async function generateWithGroq(env: Env, messages: ChatTurn[]): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new Error("MODEL_PROVIDER=groq requires GROQ_API_KEY — see .dev.vars.example");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages })
  });
  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message.content ?? "";
}

async function generateWithAnthropic(env: Env, messages: ChatTurn[]): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("MODEL_PROVIDER=anthropic requires ANTHROPIC_API_KEY — see .dev.vars.example");
  }
  const system = messages.find((m) => m.role === "system")?.content;
  const conversation = messages
    .filter((m): m is ChatTurn & { role: "user" | "assistant" } => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system, messages: conversation })
  });
  if (!res.ok) {
    throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.find((c) => c.type === "text")?.text ?? "";
}
