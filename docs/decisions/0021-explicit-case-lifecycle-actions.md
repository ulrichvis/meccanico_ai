# ADR 0021: Explicit case lifecycle actions

## Status

Accepted on 2026-09-18.

## Context

The optional admin workflow needs simple ways to confirm, reject, or archive a persisted case. Review quality and retrieval eligibility are different concerns, and none of these operator actions may delete the case or weaken its traceability to the original extraction.

## Decision

The case endpoint accepts a separate Zod-validated lifecycle command through `PATCH`. The complete payload contains the case identifier, the current `updatedAt` value, and exactly one `review`, `reject`, or `archive` action. A dedicated application service delegates the command to the case review repository.

Every command uses `updatedAt` as an optimistic-concurrency token. Reviewing changes only `reviewStatus`, sets `reviewedAt`, and never downgrades `corrected` to `reviewed`. Rejecting and archiving change only lifecycle `status`; both are allowed from `active`, and a rejected case cannot be archived implicitly. The frontend asks for explicit confirmation before rejection or archival.

The database rows remain present. The source, document, relational case graph, `ExtractionJob.rawAiOutput`, and `ExtractionJob.validatedOutput` are not rewritten by lifecycle commands. Restore, hard deletion, approval chains, assignments, comments, and multi-user roles are not part of the MVP.

## Consequences

- Search can exclude non-active cases later without confusing lifecycle with data quality.
- Corrected knowledge retains its stronger review signal after an explicit review action.
- Stale browser tabs cannot overwrite a newer lifecycle decision.
- Rejected and archived cases remain auditable and linked to their original source.
- More elaborate editorial workflow states can be considered later without changing the extraction contract.
