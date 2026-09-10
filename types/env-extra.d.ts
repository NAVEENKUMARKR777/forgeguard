// Secrets set via `wrangler secret put NAME` in production (not `vars` in
// wrangler.jsonc, so `wrangler types` can't discover them from
// wrangler.jsonc alone). Declared as required `string`, matching how a real
// `wrangler secret put` binding always looks in production, even though
// locally they're usually genuinely absent — every call site already
// guards with `if (!env.X) throw ...` regardless of the declared type, so
// this doesn't weaken that check. Deliberately NOT optional: if a
// developer's own gitignored `.dev.vars` happens to define one of these
// (see .dev.vars.example), `wrangler types` detects it there and adds a
// required `string` member to the generated Cloudflare.Env — an optional
// declaration here would then conflict with that at every place `Env` is
// used as a type constraint (e.g. `Agent<Env, State>` in session-agent.ts).
// See docs/decisions/ADR-006-model-providers.md and ADR-019.
interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GROQ_API_KEY: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}
