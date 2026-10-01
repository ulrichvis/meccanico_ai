# ADR 0027: AI-first MVP without human review

Date: 2026-10-01

Status: accepted; compatible application code implemented, shared-database rollout pending.

## Context

The product owners do not want a manual approval or correction workflow in the initial MVP. Previously optional human review still created unnecessary UI, database fields, and maintenance work.

## Decision

- Remove the case-review page, form, mutation endpoint, edit services/repository, review filters/badges, and associated translations and verification scripts.
- Keep `/cases`, URL-based search, the read-only source recap, original PDF download, and automatic extraction/normalization/persistence.
- Remove `Case.reviewStatus`, `reviewedAt`, `reviewNotes`, and the review enum. Stop writing document review metadata and remove the legacy JSON key through migration.
- Keep processing/job states, existing case lifecycle states, source-reported repair confirmation, and historical `human_added` provenance. None is a human approval status. No lifecycle mutation UI remains.
- Use `automotive-structure-v3` without `requiresHumanReview`. Preserve uncertainties, no-invention instructions, structural Zod validation, explicit-versus-inferred origin, and automatic transactional persistence.
- Reuse completed v1/v2 jobs by removing only their legacy recommendation from an in-memory copy before normalization. Never rewrite immutable raw or validated artifacts or reprocess an already persisted source. Hide the obsolete advisory review-flag warning in historical presentation.
- Do not add an alternative approval system, another AI verification call, automatic semantic certification, chat, or RAG.

Automatic persistence is not proof that an AI interpretation is correct. Existing traceability and uncertainty remain useful without requiring a human to approve every case.

This decision supersedes review-related provisions of ADRs 0002, 0010, 0015, 0016, 0019–0023, and 0026. Historical ADRs and progress logs remain intact as records of previous decisions.

## Migration and safe rollout

The repository uses Prisma migrations, not Supabase CLI migrations. The existing migration workflow is retained; no additional CLI or migration system is introduced.

1. Confirm a recoverable database backup and inspect whether review notes or dates appeared since the preflight. The preflight found one existing case, no human-review notes/dates or non-default review state, and two document metadata keys. Do not assume these counts remain current.
2. Deploy the compatible application code first. It no longer selects or writes review fields and works with the old schema because its extra review column has a default.
3. Confirm that every deployment/process still allowed to access this shared database uses compatible code. Older Vercel previews, rollback deployments, and local clients can also depend on removed columns.
4. Run `pnpm db:migrate:status`, then `pnpm db:migrate:deploy` against the intended database. Migration `20261001205043_remove_human_review` drops only the review fields/type, replaces the dependent index with `(status, created_at DESC)`, and removes only `documents.metadata_json.reviewStatus`. It uses a transaction and a five-second lock timeout; failure rolls back the changes. Do not use cascade or rewrite original migrations.
5. Recheck `/cases`, source recap, original download, and one approved extraction. Case data, source files, and immutable extraction history must remain available.

The shared live migration has deliberately not been applied during implementation: it would break the currently deployed review-dependent version. Applying it requires a coordinated deployment, not a blind schema update. A rollback to old application code after migration is unsafe without restoring the required schema and recovering deleted review metadata from backup.

## Verification

- Schema, prompt, mocked OpenAI adapter, normalizer, synthetic graph persistence, automotive persistence/orchestration, text persistence, and structured recap checks passed.
- Legacy recommendation adaptation is non-mutating; new strict output rejects the removed field. Orchestration reuses a completed legacy job without another model call.
- `pnpm review-removal:verify` executed the exact migration in an isolated temporary schema and rolled the entire transaction back. It checked column/type/index removal, retained case wording/count, retained unrelated document metadata, and nullable metadata. Existing application tables were not modified.
- All synthetic fixture scripts removed only their own records. No billable OpenAI call or Vercel deployment was performed.
- Windows sandbox `tsx` initially failed in `os.userInfo`; rerunning with the pinned Node runtime outside the sandbox passed. A verifier's TypeScript BigInt literal incompatibility was corrected before final checks.

See the [increment verification report](../AI_FIRST_MVP_VERIFICATION.md) for changed files, final command results, and the manual acceptance procedure. Phase 6.3 remains outside this cleanup.
