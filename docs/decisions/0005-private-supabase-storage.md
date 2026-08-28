# ADR 0005: Private Supabase Storage for source documents

- Status: Accepted
- Date: 2026-08-28

## Context

Phase 1 needs to preserve original PDF sources without exposing technical documents publicly or coupling object names to untrusted submitted filenames. A database write can fail after an object upload, so the flow also needs an explicit compensation boundary.

The first upload route is not implemented yet, but its Storage contract must be stable before the UI and route are added.

## Decision

Use the private Supabase Storage bucket `technical-sources` through a server-only adapter.

- Restrict the bucket to `application/pdf` objects no larger than 25 MiB (26,214,400 bytes).
- Repeat extension, declared MIME type, byte size, and `%PDF-` signature validation on the application server.
- Generate object paths as `sources/<source-id>/<random-uuid>.pdf`. The submitted filename is metadata only.
- Keep the Supabase secret key in server-only environment configuration and disable client auth-session persistence on the service client.
- Do not add browser-facing `storage.objects` policies during this phase. Trusted server code uses the secret key; the bucket remains private by default.
- Upload without `upsert` so an existing object is never silently overwritten.
- If the injected database persistence operation fails after upload, remove the new object and preserve the original persistence error. Raise a distinct compensation error if cleanup also fails.
- Provide signed URLs with a default five-minute lifetime and a maximum lifetime of one hour.
- Maintain idempotent configuration and live verification scripts. The live check uses a synthetic PDF and removes it after signed retrieval.

## Consequences

The PDF upload route can use one application service for validation, upload, relational persistence, and compensating cleanup. Storage implementation details remain replaceable behind the `SourceStorage` interface.

The 25 MiB application limit is also enforced by Supabase, but it cannot exceed the project's global Storage limit. Standard Supabase uploads are sufficient for the current adapter; the upload phase should evaluate resumable transfer behavior for larger or unreliable connections without changing the storage contract.

Direct browser uploads or reads are not authorized by this decision. Introducing them later requires explicit RLS policies and a separate security review.
