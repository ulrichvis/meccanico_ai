# ADR 0012 — Persist page-aware text with bounded retries and attempt ownership

## Status

Accepted and implemented for Phase 2 points 2.4 and 2.5.

## Context

The direct-PDF adapter previously returned validated text only in memory. The next slice must persist usable text, retain invalid responses, survive retry, and avoid duplicate documents or simultaneous paid work. Existing Source, Document, and ExtractionJob tables already support this without altering the automotive domain schema.

## Decision

- Use the configured primary model first. Allow optional escalation and exceptional tiers only after invalid/incomplete output or deterministic quality failure. Default to two attempts with an explicit range of one to three. Refusal, API/network, Storage, and persistence errors stop automatic retries.
- Reject completely empty output, invalid PostgreSQL text encoding, and systematic replacement-character corruption. Record partial/empty pages, isolated replacement characters, and repeated long text as warnings. Original text remains untouched, and usable partial content is persisted without human approval.
- Save every received response before validation. Store a JSON-string envelope so malformed output is recoverable in JSONB, and redact the signed URL if the provider echoes it.
- Lock Source before ExtractionJob in short transactions. Never hold a transaction during Storage or OpenAI calls. A source being processed returns `busy`; an existing document returns `already_processed`.
- Each attempt has a distinct job. A worker may update only its own running job while the source is extracting text. After ten minutes, a later invocation may fail an interrupted job and claim a replacement; superseded workers cannot finalize or fail the replacement.
- Finalize the document, source text/status, and completed job in one transaction. Preserve accepted documents and historical artifacts on subsequent invocations. Do not create domain records.
- Store `reviewStatus: unreviewed` in document metadata. Keep ambiguous dates as original strings and populate the timestamp only from a valid full ISO date.
- Provide a trusted CLI now; the bilingual extraction controls and persisted-data recap follow in point 2.7.

## Consequences and verification

No migration is required. Idempotency relies on all Phase 2 writers using the source-locking repository; the domain retains the ability for a Source to contain multiple Documents. Future writers must retain that lock discipline or introduce an explicit database invariant for their own representation.

The deterministic gate cannot prove source completeness or distinguish invented prose from faithful transcription. Native, scanned, and mixed-document comparisons remain necessary. Higher-tier model selection remains an operator configuration decision.

Integration verification uses isolated synthetic sources in the real database and the real response adapter with simulated provider responses. It covers schema failure, quality rejection, later retry, duplicate prevention, concurrency, stale ownership, raw-artifact preservation, and transaction rollback; all synthetic records are cleaned up.

An unavailable database cannot guarantee persistence of an in-flight response. Processing stops on storage failure, previously saved artifacts remain available, and an interrupted running job can be recovered after the stale-attempt window. This synchronous operator workflow does not introduce a background queue.
