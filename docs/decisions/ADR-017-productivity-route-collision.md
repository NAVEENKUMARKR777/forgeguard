# ADR-017: `/productivity` sub-paths only — bare path is always the SPA

## Status
Accepted

## Context
`src/worker.ts` routed any request starting with `/productivity` — including
the bare path itself — to `productivity/api.ts#productivityFetch()`, which
returned a JSON overview for the bare path (`segments.length === 1`). This
looked, from the code alone, like it would break the React dashboard: a
browser loading `/productivity` should get `index.html`, not JSON.

It didn't break in practice, but only because of a Cloudflare platform
behavior this codebase never stated anywhere: with no `run_worker_first` set
in `wrangler.jsonc` (the default), a request Cloudflare classifies as a
*navigation* (a real browser loading a URL — refresh, address bar, a link)
is matched against the Assets binding's `single-page-application` fallback
**before the Worker's own `fetch()` handler ever runs**. `curl` and
`fetch()`/XHR calls aren't classified as navigations, so they *do* reach
the Worker. That split is exactly why `npm run verify:mcp`-style `curl`
checks and `tests/e2e/productivity.spec.ts`'s `page.goto()` disagreed about
what `/productivity` returns — confirmed directly: `curl` got a JSON body
(`content-type: application/json`), a real Playwright browser navigation
got `index.html`.

Nothing in this repository actually needed that behavior. The dashboard's
own client-side fetch already targets `/productivity/metrics`
(`apps/dashboard/src/pages/ProductivityPage.tsx`), never the bare path, and
grepping the whole tree found no other caller of the bare-path JSON
response.

## Decision
`src/worker.ts` now only routes `/productivity/` (trailing slash, i.e. real
sub-paths) to `productivityFetch()` — matching the pattern already used for
`/evals/runs` and `/evals/compare` (bare `/evals` was already scoped
correctly). The "aggregate snapshot across every service" handler that used
to answer the bare path moved to an explicit `GET /productivity/overview`.
Bare `/productivity` now falls through to `env.ASSETS.fetch()` like every
other SPA route, unconditionally — correctness no longer depends on
Cloudflare's navigation-vs-fetch request classification at all.

`tests/e2e/productivity.spec.ts` gained a second test using Playwright's
`request` fixture (`APIRequestContext`, a non-navigation fetch — the same
request shape that exposed this) asserting bare `/productivity` returns
`text/html`. The existing `page.goto()` test could never have caught this:
navigation requests were never affected by the bug in the first place.

## Consequences
- No behavior change for any real user or the dashboard itself — both
  request shapes now agree, deterministically, instead of by coincidence of
  which Cloudflare's request classifier happens to route where.
- If a real external API consumer of the bare-path overview JSON existed,
  it would need to move to `/productivity/overview` — none does today (this
  repo's own grep across every source file is the closest thing to a
  contract test this project has for that).
