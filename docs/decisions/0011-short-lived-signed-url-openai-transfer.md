# ADR 0011 — Transfer private PDFs through short-lived signed URLs

## Status

Accepted for Phase 2.

## Context

Phase 2 must send an original private PDF directly to the OpenAI Responses API without adding a local PDF parser, OCR layer, or public Storage access. Supported OpenAI PDF inputs include a file URL or a separately uploaded provider file. A persistent provider upload would require an additional lifecycle and deletion path.

## Decision

The server verifies the source record and Supabase Storage object metadata, then creates a ten-minute signed URL for the private object. The OpenAI adapter passes that URL as an `input_file` to the Responses API with `store: false` and a strict JSON Schema response contract.

The signed URL, API key, and document content are never logged or returned to the browser. Filenames and PDF metadata remain untrusted. The adapter is replaceable if operational evidence later favors direct bytes or provider file uploads.

## Consequences

- OpenAI can retrieve the complete PDF while the bucket stays private.
- No persistent OpenAI file is created, so there is no provider-file deletion lifecycle in this path.
- Access expires automatically after ten minutes.
- OpenAI must retrieve the file before the URL expires, so request timeouts remain shorter than the URL lifetime.
- The original private PDF and later extraction-job history remain the audit sources.
