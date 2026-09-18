# ADR 0019: Source-language structured extraction recap

## Status

Accepted on 2026-09-18.

## Context

Persisted automotive cases must be understandable and auditable from the source detail page. The frontend itself is bilingual, but translating extracted technical content would alter source evidence and could change domain meaning. The client component also requires serializable data and must not receive Prisma decimals, raw provider responses, or sensitive internal errors.

## Decision

The server-side source-detail repository reads the persisted relational graph and maps it to a serializable presentation DTO. The UI displays cases, vehicle applicability, DTCs, symptoms, causes, components, checks, measurements, solutions, procedures, outcomes, parts, and evidence.

English and Italian catalogs translate only interface-owned copy such as headings, labels, statuses, badges, and empty states. Extracted technical wording and identifiers are rendered directly in the source document language. The interface identifies explicit source facts and AI inferences, and displays `unreviewed` without making review a prerequisite.

Raw provider responses stay in the audit layer and are never included in the recap DTO. A persisted extraction with no cases receives an explicit zero-case state.

## Consequences

- Switching the interface locale does not change source-derived technical data.
- Evidence remains traceable and semantically faithful to the document.
- The read model is intentionally presentation-safe and separate from provider response shapes.
- Future translation of technical content, if introduced, must be an explicit additional representation and must never replace the original value.
