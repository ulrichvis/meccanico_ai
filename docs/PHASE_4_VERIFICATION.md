# Phase 4 verification report

## Status

Phase 4 is complete and verified as of 2026-09-18. Optional admin review and editing remain in Phase 5.

## What was verified

The verification exercised pure normalization, relational graph persistence, end-to-end application orchestration, and the structured source recap. No OpenAI request was made. Database checks used isolated synthetic records in the configured Supabase project and removed only those records after every run.

A final read-only Supabase query returned zero sources matching any Phase 4 verification filename prefix.

## Normalization boundary

The local normalizer verification confirmed:

- multiple cases and multiple DTC roles remain distinct;
- source wording is preserved while conservative lookup keys are generated separately;
- application-owned values start as `active` and `unreviewed`;
- explicit source facts and AI inferences remain distinguishable;
- dedicated measurement, procedure, outcome, evidence, and relationship references resolve to typed local targets;
- empty valid output is accepted without creating a placeholder case;
- invalid references and invalid confidence semantics are rejected before database access.

## Atomic Supabase persistence

The live graph verifier persisted two cases with two DTCs and a shared vehicle. It confirmed the complete dependent graph, including symptoms, causes, components, checks, measurements, solutions, procedures, outcomes, parts, evidence, and generic relationships.

It also confirmed:

- every new case is `active` and `unreviewed`;
- reusable references are shared through conservative unique keys;
- raw and validated extraction artifacts remain unchanged;
- a duplicate persistence attempt is rejected;
- a forced constraint failure rolls back the entire graph, including newly created reusable references;
- no partial case graph remains after failure.

## Orchestration and retries

The orchestration verifier confirmed that an accepted extraction flows through revalidation, normalization, graph persistence, and the final `persisted` source transition. The graph and final status share one transaction.

Retrying a completed source returned the same stored case without another extractor call or duplicate database row. A valid zero-case extraction also reached `persisted`, created no placeholder case, and remained idempotent on retry. Immutable extraction history was preserved in both paths.

## Structured recap

An isolated Italian fixture confirmed that the source-detail query returns the complete stored case and preserves Italian technical wording. Manual browser checks confirmed:

- English and Italian interface labels switch through the locale catalogs;
- extracted technical data remains unchanged in the source language;
- `unreviewed`, explicit-fact, and AI-inference indicators remain visible;
- desktop and 390 px mobile layouts have no horizontal overflow;
- no raw provider response or internal error appears in the interface;
- the browser reported no console warning or error.

## Verification commands

The following commands passed:

```bash
pnpm automotive-normalizer:verify
pnpm automotive-graph:verify
pnpm automotive-orchestration:verify
pnpm structured-recap:verify
pnpm i18n:check
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm build
git diff --check
```

The first normalizer invocation was blocked before test execution by a Windows sandbox `uv_os_get_passwd` error. The identical command passed in the approved project runtime; this was an environment error, not a test failure.

## Remaining boundary

Phase 4 establishes automatic unreviewed persistence and a read-only recap. It does not authorize admin edits, review-state transitions, search, RAG, embeddings, or the mechanic-facing assistant. Optional human review and correction begin in Phase 5.
