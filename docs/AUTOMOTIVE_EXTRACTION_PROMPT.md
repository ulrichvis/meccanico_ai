# Automotive extraction prompt specification

## Status and scope

The supplied automotive diagnostic-structure prompt is accepted as the semantic baseline for Phase 3 under version `automotive-structure-v1`.

It is not the Phase 2 transcription prompt. Phase 2 sends the original PDF to OpenAI and stores faithful page-aware text. Phase 3 receives that validated text and reconstructs the automotive diagnostic structure. Keeping these prompts separate makes transcription failures distinguishable from domain-analysis failures.

The prompt is compatible with the current database after the contract adaptations documented below. No database migration is required before the first implementation.

## Required model behavior

The versioned implementation prompt must preserve all of these rules:

1. Use only information supported by the supplied source text. Never complete gaps from general automotive knowledge.
2. Treat filenames and upload metadata as non-authoritative source metadata.
3. Extract zero, one, or several useful cases without merging unrelated cases or fragmenting one coherent diagnosis unnecessarily.
4. Preserve generic vehicle applicability and leave unsupported vehicle fields `null`.
5. Distinguish one optional primary DTC from related DTCs and classify each related code using the supported relationship types.
6. Separate explicit source facts from AI inferences. Every AI inference requires extraction confidence between 0 and 1; that confidence is not a failure probability.
7. Keep symptoms, causes, components, diagnostic checks, measurements, solutions, procedures, parts, and outcomes distinct.
8. Create diagnostic or causal links only when supported by the source context. Proximity alone is insufficient.
9. Populate `probabilitySource` only from an explicit probability or frequency in the source. Keep `probabilityCalculated` `null` throughout the MVP.
10. Distinguish a proposed repair, attempted repair, successful repair, and confirmed repair.
11. Preserve measurement wording, units, signs, pressure basis, temperature scale, ranges, tolerances, and operating conditions. Normalize numerically only when unambiguous.
12. Preserve procedure order and variant conditions. Do not merge contradictory procedures.
13. Attach short, exact source excerpts and original page numbers to important facts and relationships whenever available.
14. Never upgrade the documented evidence level beyond what the source supports.
15. Re-scan the full supplied text for omitted relevant information before returning.
16. Report unreadable, incomplete, contradictory, or ambiguous content as uncertainty.
17. Return only data conforming to the supplied strict Structured Output schema, with unknown scalars as `null` and unknown collections as `[]`.

## Contract adaptations required by the database

The prompt describes the correct business behavior, but the Structured Output schema must use the application contract rather than mirroring PostgreSQL rows.

| Prompt concept | Application contract | Database behavior |
| --- | --- | --- |
| vehicle applicability | `vehicles: VehicleApplicability[]` | Normalized through `vehicles` and `case_vehicles`; one case may apply to several vehicles. |
| repair outcomes | `repairOutcomes: RepairOutcome[]` | Stored as multiple `repair_outcomes` rows when present. |
| procedures | `repairProcedures: RepairProcedure[]` | Diagnostic operations become `diagnostic_checks`; ordered repair, adaptation, programming, and verification wording is preserved in `repair_procedures`. |
| evidence | an evidence item requires a non-empty exact `excerpt`; `pageNumber` may be `null` | `source_evidence.excerpt` is non-null. Omit an evidence item when no exact excerpt can be supplied. |
| uncertainty | `documentAnalysis.uncertainties: Uncertainty[]` | Preserved in `extraction_jobs.validated_output`; it is not normalized into an invented domain fact. |
| review recommendation | `documentAnalysis.requiresHumanReview: boolean` | Advisory only. It never blocks normalization or persistence of otherwise valid data. |
| JSON naming | camelCase properties matching the TypeScript/Zod contract | Prisma maps application names to snake-case PostgreSQL columns. The model must not mix both naming conventions. |

The model must not generate database UUIDs, normalized database labels, timestamps, lifecycle state, or review state. Temporary references connect extracted entities until the application resolves database identifiers.

## Relationship mapping

The generic `relationships` output is limited to node types supported by the current `RelationshipNodeType` enum:

- `dtc`;
- `symptom`;
- `cause`;
- `diagnostic_check`;
- `solution`;
- `repair_outcome`.

Other supported links use dedicated contract references and relational foreign keys:

- a measurement may reference its diagnostic check;
- a repair procedure may reference its solution;
- a repair outcome may reference its solution;
- evidence may reference an extracted target;
- a vehicle is linked to its case through vehicle applicability;
- a component is linked to its case with its role.

The prompt may describe these links conceptually, but the Structured Output schema must not emit an unsupported generic graph node type.

## Uncertainty and human review

Use `requiresHumanReview = true` when important meaning cannot be established reliably, including unreadable content, unresolved contradictions, ambiguous case boundaries, or unsupported references.

This flag prioritizes later admin attention. It does not change the core persistence policy:

- machine-invalid output is not normalized;
- machine-valid output is stored as `active` and `unreviewed`;
- human review remains optional and asynchronous.

An uncertainty is not permission to invent a value. The affected scalar remains `null`, the affected collection remains `[]`, or the uncertain relationship is omitted.

## Structured Output requirements

- Generate JSON Schema from, or keep it mechanically aligned with, the strict Zod contract.
- Require every schema property, using nullable types where a scalar may be unknown.
- Disallow additional properties.
- Use temporary references that are unique within one case.
- Require inference confidence and reject confidence outside 0 to 1.
- Require explicit facts to use `relationOrigin = "explicit_source"` and a `null` confidence.
- Validate all references, bounds, case counts, and primary-DTC uniqueness after schema parsing.
- Preserve the complete raw model response before validation.

The Responses API supports PDF file input and JSON Schema Structured Outputs. Phase 3 should still consume the stored Phase 2 text so each stage remains independently auditable. Official references: [PDF file input](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create) and [Structured Outputs in Responses](https://developers.openai.com/api/reference/cli/resources/beta/subresources/responses).

## Prompt assembly

The model request should contain these separately versioned inputs:

1. the system instruction implementing this specification;
2. the strict JSON Schema;
3. ordered page-aware source text;
4. non-authoritative source metadata such as the original filename;
5. the prompt version recorded as `automotive-structure-v1`.

Do not embed database credentials, signed Storage URLs, internal errors, normalized reference data, or prior human corrections into the prompt unless a later feature explicitly requires them.

## Manual acceptance scenarios

Before enabling automatic normalization, verify the prompt against representative documents covering:

- generic VAG applicability without an invented model;
- several vehicles and engine variants in one case;
- multiple independent cases in one document;
- multiple DTCs with no defensible primary code;
- explicit facts mixed with contextual inferences;
- qualitative frequency without an invented percentage;
- diagnostic checks that must not become repairs;
- proposed, attempted, successful, and confirmed repairs;
- measurements with conditions, ranges, and units;
- contradictory variant procedures;
- unreadable or incomplete pages requiring an uncertainty;
- exact evidence excerpts and page references;
- unsupported graph links that must use dedicated references or be omitted.
