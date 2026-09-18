# ADR 0020: Transactional case review save

## Status

Accepted on 2026-09-18.

## Context

An operator must be able to correct one persisted automotive case without creating partial data, overwriting a newer edit, changing reusable reference data used by another case, or altering the original AI audit artifacts. The MVP does not need drafts, autosave, editorial versions, or a generic patch protocol.

## Decision

The review form sends one complete Zod-validated case payload to a thin server endpoint. One application service revalidates the payload, compares it with the current persisted presentation, and delegates one atomic write to the review repository.

The repository uses the submitted `updatedAt` value as an optimistic-concurrency token. A technical change rebuilds the case-owned graph in one Prisma transaction and marks the case `corrected`; an unchanged first review marks it `reviewed`. Both transitions set `reviewedAt` and store optional review notes. A case already marked `corrected` is not downgraded by a later unchanged review.

Reusable vehicles, DTCs, symptoms, causes, components, and solutions are resolved through their conservative database keys. Existing shared rows are reused. A DTC or component whose shared attributes conflict with another case is rejected instead of being modified silently. Existing submitted associations retain their extraction provenance, while newly added records use `human_added` with no AI confidence.

The mutation never updates `Source`, `Document`, `ExtractionJob.rawAiOutput`, or `ExtractionJob.validatedOutput`.

## Consequences

- A failure at any point rolls back case metadata, review status, and the complete graph.
- An older browser tab receives a stale-edit response and must reload before saving.
- Shared reference safety takes priority over silently accepting an ambiguous edit.
- The immutable extraction remains the audit baseline; the current relational graph is the operator-corrected representation.
- Lifecycle actions remain separate and are implemented in Phase 5.5.
