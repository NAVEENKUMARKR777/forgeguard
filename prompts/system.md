# System prompt

The canonical copy is `agents/prompts.ts` (`SYSTEM_PROMPT`) — this file is
documentation, not the source the code loads.

Design intent: the model is told explicitly that risk and policy are
already decided before it ever sees them, and that its job is to explain,
not recompute. See `docs/decisions/ADR-003-policy-vs-llm.md` for why that
split matters. Response length is capped in the prompt itself (under 150
words unless asked for detail) to keep the dashboard chat readable and the
context budget (`context/builder.ts`) predictable.
