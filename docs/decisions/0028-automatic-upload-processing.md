# ADR 0028: Automatic processing after PDF upload

Date: 2026-10-01

Status: accepted and implemented; live product acceptance pending.

## Decision

After an upload from the application succeeds, automatically call the existing text-extraction endpoint and then the existing structured-analysis endpoint. Keep the calls separate so each has its own duration budget. Both endpoints retain their current server services, transactions, audit history, validation, and idempotency safeguards.

A small framework-independent transport helper validates source identifiers and successful responses with Zod, reports the active stage, and short-circuits on every unsuccessful response or exception. It never calls OpenAI directly. React handles selection, progress, and per-file display only.

Limit the existing three workers across whole file pipelines rather than upload transfers alone. Success means graph persistence completed, not merely that a file reached Storage. Zero cases is a valid persisted result. A failed file does not prevent others from finishing. Retain the source ID after storage; processing failures link to existing manual controls rather than re-uploading the PDF. Keep all extraction and analysis source-page buttons.

For a successful single file, navigate to its saved source recap. For a batch, show each result and its source link after all workers finish. No new background execution system, schema, dependency, retry strategy, or provider prompt is needed.

## Limitations

The upload page must remain open until processing finishes. Navigation or reload may leave a stored PDF, accepted text, or an in-flight server stage without automatically starting the next stage. Recovery uses the source page and existing idempotent stage controls. Already completed server work is not discarded, but browser orchestration is not a durable job guarantee.

Direct API upload clients are unchanged: `POST /api/sources` stores only the source. The browser starts the remaining endpoints. A future requirement to continue after browser closure would justify a separately approved durable worker/queue, not an untracked background promise in this MVP.

This decision supersedes the upload-only UI behavior of ADR 0007 while preserving its limits, isolation, and idempotent transfers. It does not change the pending shared-database rollout described in ADR 0027.

## Verification and handoff

- `pnpm upload-pipeline:verify`: passed with mocked HTTP only. Covers accepted/already-processed text, persisted/already-persisted analysis, zero/nonzero cases, failure/busy responses, malformed success payloads, invalid UUIDs, network exceptions, exact endpoint order, and independent files.
- `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`, and `pnpm build`: passed. Catalogs contain 292 matching keys.
- No live OpenAI request, database mutation, deployment, or migration was performed for this increment.
- Browser interaction, actual upload-to-OpenAI fidelity, and mobile layout remain product acceptance checks, not claims made by the mocked verifier. Follow the manual procedure in `docs/DEVELOPMENT.md`.
- Next step: product acceptance of automatic uploads. Phase 6.3 remains outside this increment.

## Created files

- `src/upload/process-uploaded-source.ts`
- `scripts/verify-upload-pipeline.ts`
- `docs/decisions/0028-automatic-upload-processing.md`

## Modified files

- `src/components/upload/pdf-upload-form.tsx`
- `src/app/globals.css`
- `messages/en.json`
- `messages/it.json`
- `package.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/TASKS.md`
