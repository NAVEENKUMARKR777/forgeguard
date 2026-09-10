# ADR-018: `wrangler dev --local` for `npm run dev`/`dev:worker-only`

## Status
Accepted

## Context
`npm run dev` and `npm run dev:worker-only` ran plain `wrangler dev` (no
mode flag). On a real machine with no `CLOUDFLARE_API_TOKEN` and no prior
`wrangler login`, this crashed the Worker before it served a single
request:

```
⎔ Establishing remote connection...
✘ [ERROR] Failed to start the remote proxy session. Error reloading remote
server: In a non-interactive environment, it's necessary to set a
CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

The cause: plain `wrangler dev` runs in "mixed mode," where any binding
configured as remote-only — the `AI` binding always is; Workers AI has no
local simulation, full stop — gets an eager proxy connection established
*at server startup*, for every binding, regardless of whether the current
session ever calls it. With no credentials and no interactive terminal to
prompt a login flow, that eager connection attempt fails hard and takes
the whole dev server down with it — not a degraded chat feature, a Worker
that never starts.

This directly contradicted the project's own stated guarantee (README:
"Everything works with no external credentials except the model's
plain-language narration... the agent falls back to a short generated
message rather than crashing"). That promise was only ever true for the
scripts that happened to already pass `--local` —
`scripts/verify-mcp-server.mjs`, `scripts/record-eval-run.mjs`, and
`playwright.config.ts`'s `webServer` all do. The two scripts an actual
first-time user runs — `npm run dev` and `npm run dev:worker-only` — were
the only ones that didn't, and were never actually exercised end-to-end
without credentials during this project's own "clean clone" verification
pass (ADR-016's and completion-status.md's clean-checkout runs covered
typecheck/test/evals/verify:mcp/test:e2e — none of which start `npm run
dev` itself). Caught by a user actually running the documented quick-start
on a real machine, not by anything in this repo's own test suite.

## Decision
`dev` and `dev:worker-only` now run `wrangler dev --local`. Verified
directly: plain `wrangler dev` reproduces the crash above with no
`CLOUDFLARE_API_TOKEN` set; `wrangler dev --local` starts cleanly instead,
reporting the `AI` binding as unavailable rather than attempting (and
failing) an eager connection. Nothing else changes — `--local` doesn't
alter what happens when `AI.run()` is actually called; Workers AI remains
"always remote" per Cloudflare's own platform constraint either way, so a
session with real credentials (`wrangler login` done beforehand) still
gets real narration. `--local` only removes the unconditional, unnecessary
up-front handshake for a binding a given session might never touch.

## Consequences
- The per-request graceful-degradation path (`agents/model.ts#generateText()`
  catching a failed AI call and returning a short fallback message instead
  of throwing) was already being exercised correctly the entire time this
  project's `--local`-based e2e suite (ADR-016) ran against it — this fix
  doesn't touch that logic at all, it only stops the *startup* path from
  failing before any request-level fallback ever gets a chance to run.
- `npm run deploy`/`wrangler deploy` (real Cloudflare deployment) is
  unaffected — `--local` is a dev-server-only flag.
