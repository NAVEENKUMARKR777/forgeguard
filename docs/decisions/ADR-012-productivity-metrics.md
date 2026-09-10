# ADR-012: Developer productivity metrics as real aggregation over generated data

## Status
Accepted

## Context
The plan asks for developer-productivity/ADLC metrics as "an actual
subsystem, not a static dashboard number," explicitly warning against
fabricated measurements. There's no real telemetry pipeline in this
scaffold to source them from.

## Decision
`productivity/fixtures.ts#generateDailyMetrics()` produces 90 days ×
4 services of daily metric rows from a small deterministic hash function
— not hand-typed "looks plausible" numbers, and not random (the same day
index always produces the same row). `productivity/aggregates.ts` filters
those rows to a requested window (7/30/90 days) and buckets them by day or
by ISO week; `productivity/metrics.ts#getProductivitySnapshot()` derives
every reported metric (deployment frequency, CI success rate, MTTR, AI
investigation volume, etc.) from that windowed data via real division/sums
— nothing is a stored final answer. Every snapshot carries `source:
"fixture"`, checked by a test (`tests/productivity.test.ts`) and rendered
directly in the React view (`ProductivityPage.tsx`) as a visible badge, not
just a code comment.

Exposed via `src/worker.ts` at `/productivity/overview`,
`/productivity/metrics`, and `/productivity/services/:service`, all
accepting `?window=7d|30d|90d`. (Originally bare `/productivity` served the
overview; moved to `/productivity/overview` by ADR-017 once that collided
with the React page at the same path.)

## Consequences
- A real bug surfaced and was fixed during testing: the window filter
  originally computed `windowDays` days back from today *inclusive of
  both ends*, so `window=7d` returned 8 calendar days, not 7. Fixed by
  subtracting `windowDays - 1`. Caught by
  `tests/productivity.test.ts`'s "produces one bucket per day for daily
  granularity" case, not by inspection — worth noting since it's exactly
  the kind of off-by-one an eyeballed review tends to miss.
- Because every number is generated from a formula, values vary
  realistically across services/windows (visible in
  `tests/productivity.test.ts`'s "computes ... as a ratio, not a hardcoded
  constant" case) rather than all landing on the same round number a
  hand-typed fixture would tend toward.
- No live telemetry source exists or is implied — connecting one later
  means writing an alternative to `productivity/fixtures.ts` with the same
  `DailyMetricRow` shape; `aggregates.ts` and `metrics.ts` don't change.
