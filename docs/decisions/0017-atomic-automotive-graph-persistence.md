# ADR 0017 — Persist the automotive graph atomically

## Status

Accepted and implemented for Phase 4.2.

## Context

One accepted extraction may contain several cases and many dependent associations. Its temporary references must become database UUIDs without exposing a partial knowledge graph when a later row fails. Reusable reference entities also need a concurrency-safe identity, while case-specific wording and immutable extraction artifacts must remain traceable.

## Decision

- Persist every case from one normalized extraction inside a single Prisma interactive transaction.
- Lock the source row and verify that the source is processing, the document belongs to it, and the completed extraction job uses the accepted automotive prompt version.
- Reject an extraction job that already owns persisted cases.
- Use unique normalized keys and atomic upserts for vehicles, DTCs, symptoms, causes, solutions, and components.
- Add `vehicles.normalized_key` as a required unique column. The shared database required no backfill because the table was empty when the migration was applied.
- Keep case-specific descriptions, probabilities, origin, confidence, and applicability notes on case-owned rows or associations; preserve all other original wording in the accepted extraction artifact.
- Resolve typed temporary references to UUIDs inside the transaction. Use the case-solution association UUID for procedure and outcome links.
- Insert evidence before generic relationships, then resolve relationship-targeted evidence in a second pass inside the same transaction so the permitted evidence/relationship cycle remains atomic.
- Do not modify raw or validated `ExtractionJob` output in the repository.
- Keep the low-level graph-only method from changing source status. The Phase 4.3 application service selects the completion operation, whose repository transaction writes the graph and moves the source to `persisted` together.

## Consequences

- A failed constraint, missing reference, or ownership check leaves no partial case graph.
- Concurrent reference creation is protected by database uniqueness rather than read-then-insert logic.
- The transaction contains multiple dependent statements, but no OpenAI, Storage, or other network call.
- Vehicle identity is now explicit and stable enough for the current MVP, while intentionally conservative lookup keys may retain harmless near-duplicates.
- A valid zero-case extraction uses the persisted source state and completed extraction job as its explicit completion record because no case row exists.
