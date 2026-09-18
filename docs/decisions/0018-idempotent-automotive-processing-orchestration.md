# ADR 0018 — Orchestrate accepted automotive processing idempotently

## Status

Accepted and implemented for Phase 4.3.

## Context

Phase 3 preserves accepted structured output but intentionally stops with the source in `processing`. Phase 4.1 and 4.2 can normalize and persist that output, but they need one application boundary that can complete a new analysis, resume a previously accepted job, and safely handle a valid extraction containing no cases.

## Decision

- Use `processAutomotiveKnowledgeSource` as the shared application service for the trusted command and future transports.
- Run or reuse the existing bounded Phase 3 processor first. Continue to persistence only after a completed accepted job; return busy and failed results unchanged.
- Load the newest completed `automotive-structure-v1` job and newest document for the source, then revalidate the saved `validatedOutput.content` and its accepted quality flag.
- Normalize the saved artifact without an additional provider call.
- Persist the graph and move the source from `processing` to `persisted` in the same transaction.
- Lock the source during completion so concurrent retries serialize.
- Treat a source already marked `persisted` with the expected case count as an idempotent success and return existing case identifiers.
- For a valid zero-case extraction, create no placeholder case. The `persisted` source and immutable completed extraction job record completion.
- Keep raw and validated extraction artifacts immutable during normalization, persistence, and retry.

## Consequences

- A crash before graph completion leaves the source in `processing`; retry reuses the accepted job and does not call OpenAI again.
- A successful transaction cannot expose a complete graph with a stale processing status.
- Normal and zero-case retries create neither duplicate cases nor duplicate jobs.
- The trusted `automotive:process` command now runs the full knowledge-processing path, while UI integration remains a separate Phase 4.4 concern.
