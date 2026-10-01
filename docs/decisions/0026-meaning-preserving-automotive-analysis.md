# ADR 0026 — Meaning-preserving automotive analysis

Date: 2026-10-01

Status: Accepted

## Context

An otherwise usable analysis was rejected because a supporting passage crossed two PDF pages and did not match the indicated page verbatim. The product needs clear, machine-usable knowledge grounded in source meaning, not a second transcription. No invented facts remain the central constraint.

## Decision

- Keep Zod shape, required nullable fields, references, origin/confidence, numeric bounds, and database constraints blocking.
- Permit clearer source-language descriptions and supporting passages while preserving meaning, certainty, negation, identifiers, values, units, conditions, and variants.
- Turn evidence wording/page, uncertainty page, missing review flag, and confirmed-solution-without-outcome checks into advisory warning codes. A changed passage is not automatically deemed correct or invented.
- Store the warnings in existing `validatedOutput.quality.warnings`, with `accepted = true` and empty blocking `reasons`; log only codes and show translated explanations in source history.
- Remove the confirmed-solution/outcome requirement from the structural schema. Do not synthesize a missing outcome or silently change extracted values to suppress a warning.
- Use prompt version `automotive-structure-v2`. Reuse completed v1 jobs at claim and persistence boundaries; never reinterpret failed v1 artifacts as completed or overwrite old history. Retrying a failed source runs a fresh v2 attempt.
- Keep original Phase 2 text and raw AI responses immutable. Supporting passages are not rendered as guaranteed quotations.
- No migration, extra verification model call, fuzzy semantic matcher, or automatic human-review requirement.

## Consequences

Reformulated or cross-page support no longer blocks the entire analysis or triggers paid escalation. Structurally invalid output still fails safely and retains raw history. Prompt instructions and deterministic warnings cannot prove absence of invention; original-source comparison and optional correction remain available. Completed sources are not automatically reanalyzed when prompt versions change.

## Manual verification

1. Open a source with previously failed automotive analysis and existing extracted text.
2. Click Analyze and structure (or the retry action). This operator action makes a new OpenAI request.
3. Confirm persistence succeeds even when a supporting passage is reformulated or spans pages. Check the new attempt's advisory notes in history.
4. Compare data with expanded original text and the downloaded PDF, especially negations, certainty, values, units, and repair status.
5. Switch English/Italian without changing routes. Notes and labels change language; technical content does not. Verify mobile layout.
6. Retry a completed source and confirm no extra case or model call. Previous failed attempts remain visible.
7. Use the focused schema/adapter scripts to verify invalid references and out-of-range confidence still fail.

The next roadmap step remains Phase 6.3; it is not implemented here.

## Verification results

Passed on 2026-10-01:

- `pnpm automotive-schema:verify`: blocking invariants remain enforced; cross-page wording, page, review, and missing-outcome issues are advisory.
- `pnpm automotive-prompt:verify`: no-invention, clarity, source isolation, language, and certainty rules present.
- `pnpm automotive-adapter:verify`: request assembly and structural/provider failure boundaries preserved.
- `pnpm automotive-normalizer:verify`: typed references and normalization preserved.
- `pnpm automotive-persistence:verify`: warnings complete on the first attempt; structural failures still escalate; provider failures do not retry; completed v1 reuse and immutable history preserved.
- `pnpm automotive-orchestration:verify`: reformulated evidence persisted atomically with its warning; repeat processing made no additional model call; a legacy completed zero-case job was persisted without an AI request.
- `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check` (392 matching keys), `pnpm build`, and `git diff --check`.

The sandbox could not run `tsx` because Windows user-info access failed. Focused scripts were rerun outside that restriction with the pinned Node 24 runtime. All integration responses were synthetic; fixtures created by the verification scripts were removed. No existing source was reanalyzed, no migration or deployment was performed, and browser/mobile/source-fidelity acceptance remains the manual procedure above.

The Next.js/React guidance kept warning reads server-side and sent only serializable warning codes to the existing client view. The Supabase guidance kept audit notes in the existing JSONB artifact without schema or access-policy changes.

## Changed files

Created:

- `docs/decisions/0026-meaning-preserving-automotive-analysis.md`

Modified:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md`
- `docs/DATA_MODEL.md`
- `docs/DEVELOPMENT.md`
- `docs/EXTRACTION_CONTRACT.md`
- `docs/TASKS.md`
- `messages/en.json`
- `messages/it.json`
- `src/schemas/automotive-extraction.schema.ts`
- `src/prompts/automotive-extraction.prompt.ts`
- `src/automotive-extraction/automotive-quality.ts`
- `src/automotive-extraction/automotive-model-routing.ts`
- `src/automotive-extraction/process-automotive-source.ts`
- `src/automotive-extraction/automotive-extraction-repository.ts`
- `src/persistence/automotive-graph-repository.ts`
- `src/lib/automotive-extraction-logger.ts`
- `src/sources/source-detail-repository.ts`
- `src/components/sources/source-detail.tsx`
- `scripts/verify-automotive-extraction-schema.ts`
- `scripts/verify-automotive-extraction-prompt.ts`
- `scripts/verify-automotive-extraction-persistence.ts`
- `scripts/verify-automotive-orchestration.ts`
- `scripts/verify-live-automotive-extraction.ts`
