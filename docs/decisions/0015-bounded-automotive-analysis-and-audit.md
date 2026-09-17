# ADR 0015 — Bound automotive analysis and preserve every attempt

## Status

Accepted and implemented for Phase 3.4.

## Context

Structured automotive analysis needs safe retry, measurable quality checks, and complete audit history before Phase 4 may create relational domain data. The existing `Source`, `Document`, and `ExtractionJob` models already contain the required ownership, input, output, model, version, timing, and outcome fields. Adding a queue or stage-specific table would not improve the current single-worker MVP.

## Decision

- Consume only the latest persisted Phase 2 `Document` and validate it again at the boundary.
- Use short source-locking transactions for claim and state transitions; keep the provider call outside database transactions.
- Create one `ExtractionJob` for every model call and never reuse an earlier job for retry or escalation.
- Persist the complete raw provider envelope before response/schema validation, then preserve accepted structured content, deterministic quality results, response metadata, and token usage.
- Accept evidence only when its page exists and its exact excerpt appears in that page, or in the complete supplied text when no page is stated.
- Reject uncertainty page numbers outside the input and require the advisory review flag when Phase 2 already marked a page partial, unreadable, or uncertain.
- Retry only malformed, incomplete, schema-invalid, or deterministically rejected output. Do not automatically retry request failures or refusals.
- Move only to a distinct configured higher tier, with one to three total attempts and two by default.
- Keep the source in `processing` after accepted Phase 3 output. Phase 4 owns normalized relational persistence and the transition to `persisted`.
- Write no `Case` or related domain row during Phase 3.

## Consequences

- Raw and validated attempt history remains independently inspectable and retries cannot erase earlier evidence.
- Escalation cost is bounded and tied to an explicit failure code.
- Human review remains optional; requiring a truthful advisory flag does not require a human to approve persistence.
- An interrupted attempt can be reclaimed after ten minutes, while ownership checks prevent an older worker from overwriting its replacement.
- The MVP requires no migration, queue, background worker, or new infrastructure for this step.
