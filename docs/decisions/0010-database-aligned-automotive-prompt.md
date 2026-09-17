# ADR 0010 — Align the automotive prompt with the application contract

## Status

Accepted and verified. The strict contract, versioned prompt, provider adapter, quality gates, persistence orchestration, and representative live evaluation are complete through Phase 3.5.

## Context

The supplied automotive prompt correctly defines source-only extraction, diagnostic separation, uncertainty, evidence, DTC roles, measurements, procedures, outcomes, and probability rules. Its prose is intentionally independent from a concrete JSON Schema, while the existing PostgreSQL model has specific cardinalities, non-null fields, graph node types, and dedicated foreign-key relationships.

Using the prompt text without an explicit mapping would create avoidable mismatches, including singular vehicles or outcomes, nullable evidence excerpts, mixed camel-case and snake-case names, unsupported generic graph nodes, or a review recommendation interpreted as a persistence gate.

## Decision

Adopt the supplied prompt as the semantic baseline for `automotive-structure-v1` with these application-contract rules:

- Phase 2 transcription and Phase 3 automotive analysis remain separate model calls and prompts.
- The model returns several vehicles and several repair outcomes when supported.
- JSON properties use the camelCase Zod contract; Prisma maps them to snake-case database columns.
- Every evidence item has an exact non-empty excerpt; otherwise the evidence item is omitted.
- Generic relationships use only node types represented by `RelationshipNodeType`.
- Measurements, repair procedures, and repair outcomes use dedicated temporary references that become database foreign keys.
- `requiresHumanReview` and uncertainties are preserved in the validated extraction artifact.
- `requiresHumanReview` is advisory and never blocks persistence of an otherwise valid normalized case.
- Database identifiers, normalization, status, and review status remain application responsibilities.

## Consequences

- The prompt can evolve without coupling the relational schema to its exact JSON shape.
- The normalizer has an explicit mapping for every supported link.
- The existing schema is sufficient for the initial implementation.
- Some procedure subtype detail remains in original wording until real extraction results justify a dedicated database field.
- Prompt regression scenarios must cover multiple cases, vehicles, DTCs, outcomes, evidence, uncertainty, measurements, and contradictory variants.
- `src/schemas/automotive-extraction.schema.ts` is the canonical exchange contract. Its generated JSON Schema and inferred TypeScript type must remain mechanically aligned.
- `src/prompts/automotive-extraction.prompt.ts` keeps stable developer instructions separate from deterministic, validated dynamic source input. The JSON Schema is supplied separately through Structured Outputs.
- Temporary references are unique within a case. Generic graph references are type-checked, and dedicated measurement, procedure, and outcome references are validated separately.
