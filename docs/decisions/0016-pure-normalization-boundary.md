# ADR 0016 — Normalize and resolve references before persistence

## Status

Accepted and implemented for Phase 4.1.

## Context

The Phase 3 artifact uses source wording and temporary references, while PostgreSQL uses normalized lookup values, database enum names, UUID foreign keys, and application-owned lifecycle defaults. Mixing these conversions into Prisma writes would make validation harder, lengthen transactions, and couple persistence to the current prompt.

## Decision

- Revalidate the complete Phase 3 artifact at the normalizer boundary.
- Keep normalization pure and synchronous, with no OpenAI, filesystem, network, or database access.
- Preserve every original extracted value in the normalized record while adding separate conservative lookup keys.
- Normalize DTC lookup codes with Unicode compatibility normalization, whitespace removal, and uppercase only.
- Normalize reusable text keys with Unicode compatibility normalization, collapsed whitespace, and lowercase only.
- Build vehicle lookup keys from supplied applicability fields. Give unidentified vehicles a case-local key instead of merging them globally.
- Map extraction enums to existing Prisma enum names.
- Assign `ACTIVE` and `UNREVIEWED` in application code; never request lifecycle or review state from the model.
- Resolve all temporary references to typed local targets before a persistence transaction begins.
- Keep causes, checks, solutions, procedures, outcomes, measurements, evidence, and generic relationships as separate structures.

## Consequences

- Invalid graphs fail before any relational row can be written.
- The normalizer can be tested without secrets or infrastructure.
- Phase 4.2 keeps its transaction focused on atomic UUID resolution and relational inserts.
- Conservative keys may leave near-duplicate reference data, which is preferable to incorrectly merging distinct technical concepts during the MVP.
- Original wording remains available in the normalized value and immutable validated extraction even when a lookup key is canonicalized.
