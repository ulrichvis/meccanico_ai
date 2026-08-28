# ADR 0009 — Separate text recovery from knowledge extraction

## Status

Accepted for planning; implementation has not started.

## Context

Uploaded PDFs range from native documents with a reliable text layer to scans and documents containing useful diagrams or photographs. The Responses API accepts PDF file input directly. Adding a local PDF parser before every model request would introduce an extra dependency and processing path without being required for the selected first implementation.

## Decision

Use two independently validated stages:

1. Phase 2 sends the original private PDF directly to OpenAI and produces faithful, page-aware text. It does not use a local PDF-reading, OCR, or preflight library. OpenAI performs text extraction only, with bounded retry or escalation.
2. Phase 3 consumes the stored page text and produces the structured automotive extraction contract.

OpenAI never writes directly to Supabase. The application validates each boundary and controls persistence.

Phase 2 may transcribe text visible on scanned pages, but it does not describe or interpret diagrams and photographs. The original private PDF is retained so a future multimodal adapter can extract visual assets with page and region traceability. No visual-asset schema is added now.

## Consequences

- Native, scanned, and mixed PDFs follow one file-input path.
- The implementation has fewer dependencies and no duplicate PDF-reading pipeline.
- Independent completeness checks are more limited, so the original PDF and extraction artifacts remain essential for audit and retries.
- Text quality failures and automotive-structure failures have separate histories.
- Page references remain stable for later evidence records.
- The structured prompt can be optimized against the domain schema without also solving PDF parsing.
- Future source adapters can emit the same page-aware content representation.
- Future image work requires its own adapter, storage conventions, contract, and migration.
