# Phase 3 verification report

## Status

Phase 3 is complete and verified as of 2026-09-17. Phase 4 subsequently enabled automatic normalization and atomic relational persistence.

## What was verified

The verification exercised the strict automotive schema, versioned prompt, OpenAI Responses adapter, deterministic semantic checks, bounded retries, immutable attempt history, and provider-independent orchestration. Live requests received only synthetic page-aware text; no customer PDF or private Storage URL was sent during this verification.

## Live representative evaluation

The configured `gpt-5.6-luna` model was called with `medium` reasoning through the production Phase 3 adapter and strict Structured Outputs.

| Input | Expected boundary | Result |
| --- | --- | --- |
| Generic VAG/EA211 note | Keep applicability generic, do not invent a vehicle model, retain two related DTCs without forcing a primary code, distinguish a diagnostic check from a proposed repair, and preserve qualitative frequency without calculating a probability. | One case; generic VAG applicability; no model invented; no primary DTC forced; two related DTCs; check and proposal remained distinct; calculated probability remained null. |
| Two independent workshop cases | Preserve two cases, voltage and conditions, a confirmed repair outcome, a compression check, an unperformed proposal, and contradictory torque variants as uncertainty. | Two cases; measurement, confirmed outcome, diagnostic check, unconfirmed proposal, and uncertainty were preserved. |
| Visual-only unreadable page | Do not infer content from a photograph or diagram when no text was recovered. | Zero cases; uncertainty and advisory human-review flag returned. |

All evidence excerpts returned by the model passed exact source-text and page checks. Across the three calls, the provider reported 14,168 total tokens, including 4,696 output tokens and 1,380 reasoning tokens. The second and third requests reused 2,976 cached input tokens each.

## Persistence and failure safety

The synthetic Supabase integration verification confirmed:

- a measurable semantic failure can route once to a distinct configured model;
- each attempt receives a separate `ExtractionJob`;
- raw and validated artifacts, model, prompt version, timestamps, outcome, and usage remain inspectable;
- repeating a completed analysis is idempotent;
- request failures are not automatically retried;
- no `Case` or related normalized automotive row is created in Phase 3;
- temporary verification rows are removed after the test.

## Operator boundary

`pnpm automotive:process --list` lists eligible sources without making an OpenAI call. `pnpm automotive:process <source-id>` performs the second, billable AI call on saved Phase 2 text when needed, preserves the accepted Phase 3 result, and now continues through Phase 4 normalization and atomic relational persistence. Retrying a persisted source reuses its accepted artifact and makes no additional OpenAI call.

## Verification commands

The following commands passed:

```bash
pnpm automotive-schema:verify
pnpm automotive-prompt:verify
pnpm automotive-adapter:verify
pnpm automotive-persistence:verify
pnpm automotive-live:verify
pnpm automotive:process --list
pnpm i18n:check
pnpm lint
pnpm typecheck
pnpm build
```

## Remaining boundary

These examples provide evidence for the selected scenarios, not a guarantee that every future document will be perfectly classified. Phase 4 retains the validated extraction and evidence while atomically normalizing all cases as `unreviewed`. Human review remains optional and may correct the stored result later.
