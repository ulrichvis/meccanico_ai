# AI-first MVP cleanup verification

Date: 2026-10-01

Scope: remove human review and case editing, without starting Phase 6.3 or changing PDF transcription behavior. Architectural decisions and safe rollout are in [ADR 0027](decisions/0027-ai-first-mvp-without-human-review.md).

## Command results

| Command | Result |
| --- | --- |
| `pnpm db:generate` | Passed; client no longer contains review fields. |
| `pnpm db:validate` | Passed. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed after regenerating Next route types and correcting the verifier's BigInt literal. |
| `pnpm i18n:check` | Passed; 285 matching English/Italian keys. |
| `pnpm build` | Passed; deleted review and case mutation routes absent from route manifest. |
| `pnpm automotive-schema:verify` | Passed, including strict rejection of the removed review flag and immutable legacy adaptation. |
| `pnpm automotive-prompt:verify` | Passed; automatic storage and no-human-approval instructions present. |
| `pnpm automotive-adapter:verify` | Passed; mocked requests only, no OpenAI API call. |
| `pnpm automotive-normalizer:verify` | Passed without database access. |
| `pnpm automotive-persistence:verify` | Passed; synthetic fixtures cleaned up. |
| `pnpm automotive-graph:verify` | Passed; atomic graph persistence and rollback, synthetic fixtures cleaned up. |
| `pnpm automotive-orchestration:verify` | Passed; legacy-job reuse, immutable artifacts, no duplicate processing, synthetic fixtures cleaned up. |
| `pnpm extraction:verify` | Passed; document metadata has no new review status, synthetic fixtures cleaned up. |
| `pnpm structured-recap:verify` | Passed; complete persisted source-language graph, synthetic fixtures cleaned up. |
| `pnpm review-removal:verify` | Passed; exact migration executed against isolated fixtures and rolled back, live tables unchanged. |
| `git diff --check` | Passed. |

Initial `tsx` runs failed because Windows sandbox account lookup returned `ENOMEM`; focused scripts passed outside the sandbox with the pinned Node runtime. An initial local production HTTP check failed because sandbox database access was denied (`EACCES`); the check passed outside the sandbox. `pnpm exec next start` was unavailable in the command environment, so the installed Next entry point was invoked directly with Node.

## Read-only HTTP verification

Started the production build locally with `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3107`. Checked an existing case and its source, without editing records or calling OpenAI:

- `/cases` returned 200 with the existing active case and no review filter, review badge, or editor link.
- `/sources/<existing-source-id>` returned 200 with its persisted technical recap and original PDF download action, without review UI.
- The removed `/cases/<existing-case-id>/review` route returned 404.
- `PUT /api/cases/<existing-case-id>` returned 404; no mutation handler remains.
- Read-only Supabase verification found no leftover temporary verification schemas. Existing case count remained one.

These are HTTP/rendered-markup checks, not a full interactive browser or mobile-layout test. The temporary production server was stopped after verification.

## Manual acceptance procedure

1. Open `/cases` in English, then Italian. There must be no review button, review-state badge, or review filter. Search by a known DTC or vehicle and reload the URL.
2. Follow **View source**. The technical recap must stay in the original document language; headings and controls must follow the selected interface language.
3. Download the original PDF. Check that the file and read-only technical data remain available.
4. Open the former review URL: it must show the localized not-found page, not an editor.
5. On an approved test PDF, upload, extract the text, and run structured analysis. These actions call OpenAI and may incur cost. Cases must save automatically without an approval action; processing/quality feedback remains visible.
6. Check desktop and mobile layout, including the shortened search form and language selector.

## Rollout and next step

Shared Supabase has not been migrated yet. Deploy compatible application code first, confirm every client of that database is compatible and a recoverable backup exists, then apply the Prisma migration according to ADR 0027. Do not roll an old review-dependent application back onto the migrated database.

After this cleanup and coordinated rollout, the next feature remains Phase 6.3: a read-only complete case page. It has not been started.

Removed files are recoverable from Git. No original PDF, technical case, or immutable extraction artifact was deleted. Temporary synthetic verification records were removed by their own guarded scripts.

## Created and modified files

- Modified: `AGENTS.md`.
- Created: `docs/AI_FIRST_MVP_VERIFICATION.md`.
- Modified: `docs/ARCHITECTURE.md`.
- Modified: `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md`.
- Modified: `docs/DATA_MODEL.md`.
- Created: `docs/decisions/0027-ai-first-mvp-without-human-review.md`.
- Modified: `docs/DEVELOPMENT.md`.
- Modified: `docs/EXTRACTION_CONTRACT.md`.
- Modified: `docs/FUTURE_ASSISTANT.md`.
- Modified: `docs/PRODUCT.md`.
- Modified: `docs/ROADMAP.md`.
- Modified: `docs/TASKS.md`.
- Modified: `docs/TEXT_EXTRACTION.md`.
- Modified: `messages/en.json`.
- Modified: `messages/it.json`.
- Modified: `package.json`.
- Created: `prisma/migrations/20261001205043_remove_human_review/migration.sql`.
- Modified: `prisma/schema.prisma`.
- Modified: `README.md`.
- Modified: `scripts/verify-automotive-extraction-persistence.ts`.
- Modified: `scripts/verify-automotive-extraction-prompt.ts`.
- Modified: `scripts/verify-automotive-extraction-schema.ts`.
- Modified: `scripts/verify-automotive-graph-persistence.ts`.
- Modified: `scripts/verify-automotive-normalizer.ts`.
- Modified: `scripts/verify-automotive-orchestration.ts`.
- Deleted: `scripts/verify-case-edit-schema.mjs`.
- Deleted: `scripts/verify-case-review-save.ts`.
- Modified: `scripts/verify-extraction-persistence.ts`.
- Modified: `scripts/verify-live-automotive-extraction.ts`.
- Modified: `scripts/verify-openai-automotive-adapter.ts`.
- Created: `scripts/verify-review-removal.ts`.
- Modified: `scripts/verify-structured-recap.ts`.
- Deleted: `src/app/api/cases/[caseId]/route.ts`.
- Deleted: `src/app/cases/[caseId]/review/error.tsx`.
- Deleted: `src/app/cases/[caseId]/review/loading.tsx`.
- Deleted: `src/app/cases/[caseId]/review/not-found.tsx`.
- Deleted: `src/app/cases/[caseId]/review/page.tsx`.
- Modified: `src/app/globals.css`.
- Modified: `src/automotive-extraction/automotive-quality.ts`.
- Modified: `src/cases/case-browser-repository.ts`.
- Deleted: `src/cases/case-edit-draft.ts`.
- Deleted: `src/components/cases/case-review-form.tsx`.
- Modified: `src/components/cases/cases-dashboard.tsx`.
- Modified: `src/components/sources/source-detail.tsx`.
- Modified: `src/extraction/extraction-repository.ts`.
- Modified: `src/normalization/automotive-normalizer.ts`.
- Modified: `src/persistence/automotive-graph-repository.ts`.
- Deleted: `src/persistence/case-review-repository.ts`.
- Modified: `src/prompts/automotive-extraction.prompt.ts`.
- Modified: `src/schemas/automotive-extraction.schema.ts`.
- Modified: `src/schemas/case-browser-query.schema.ts`.
- Deleted: `src/schemas/case-edit.schema.ts`.
- Deleted: `src/schemas/case-lifecycle.schema.ts`.
- Deleted: `src/services/save-case-review.ts`.
- Deleted: `src/services/update-case-lifecycle.ts`.
- Modified: `src/sources/source-detail-repository.ts`.
