# ADR 0013 — Keep extraction operations safe and build the recap from persisted data

## Status

Accepted and implemented for Phase 2 points 2.6 and 2.7.

## Context

Operators need to start or retry source-text extraction and understand what was saved. That interface must remain useful without exposing provider artifacts or creating a second AI-generated summary. Processing also needs enough telemetry to diagnose failures and track cost categories without logging private document content.

## Decision

- Use one server-side `processSource(sourceId)` service for the CLI and the HTTP action. The route validates the source identifier and maps internal failures to a small set of safe, retry-oriented error codes.
- Keep the processing route and React components thin. Database reads live in a server-only source-detail repository, while orchestration stays in the extraction service and pipeline.
- Build the extraction recap exclusively from persisted `Source`, `Document`, and `ExtractionJob` data. Do not call an AI model to summarize an extraction that has already been saved.
- Return page-aware original-language text, normalized document metadata, deterministic quality warnings, model and prompt version, timing, safe status/error categories, and available token counts.
- Never return raw provider responses, signed URLs, Storage paths, credentials, or internal provider messages to the browser. Do not pass those values to the centralized logger.
- Log structured extraction lifecycle events with identifiers, step, duration, model tier, prompt version, outcome, escalation reason, safe error code, and provider-reported token categories.
- Keep usage inside the existing JSON attempt artifact for the MVP. Add dedicated cost-reporting columns only if operational reporting later requires indexed or aggregate queries.
- Preserve the original private PDF as the future source for visual extraction. Phase 2 does not separately extract or interpret photographs and diagrams.

## Consequences and verification

No database migration is required. The UI reflects saved state and a page refresh remains authoritative. The synchronous endpoint can take as long as the configured extraction timeout; a future queue may replace delivery mechanics without changing the processor contract.

The detail interface must be manually verified in English and Italian, on desktop and mobile, and with expanded original-language page text. Repeating the endpoint for a completed source must return the existing document without a new model call. Representative native, scan-only, and mixed PDFs remain the final evidence needed to complete Phase 2.
