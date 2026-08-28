# ADR 0007: Limited-concurrency PDF batches

- Status: Accepted
- Date: 2026-08-28

## Context

Operators may need to ingest many technical PDFs. Selecting and waiting for every file individually creates unnecessary work, while sending an unbounded number of large requests at once can exhaust browser, application-server, database, or Storage resources.

## Decision

Support batches of up to 20 PDFs with a 20 MiB limit applied independently to each file.

- Keep the server API unitary: one request, Storage object, idempotency UUID, and `Source` per PDF.
- Maintain a browser-side queue with independent validation, progress, success, and error state for every file.
- Run no more than three upload requests concurrently.
- Continue processing valid files when another file is invalid or a transfer fails.
- Preserve each file's upload UUID when retrying a failed transfer.
- Ignore duplicate browser selections identified by filename, size, and last-modified timestamp within the current batch. This is a user-interface safeguard, not content deduplication.
- Show an English or Italian batch summary and allow the operator to clear completed results before starting another batch.
- Preserve the single-file confirmation redirect when the batch contains exactly one successful PDF.

## Consequences

The existing server validation, idempotency, compensation, and private Storage behavior remain unchanged and independently protect every PDF. A partial batch failure never rolls back successful documents.

Browser-side batch limits do not constitute authorization or rate limiting. Authentication, tenant quotas, abuse controls, and content-hash deduplication remain separate future concerns.
