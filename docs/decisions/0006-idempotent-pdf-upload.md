# ADR 0006: Idempotent server-side PDF upload

- Status: Accepted
- Date: 2026-08-28

## Context

The PDF upload needs visible network progress, private Storage access, relational registration, and safe retry behavior. Server Actions support form uploads but do not expose browser upload progress as directly as an HTTP upload endpoint. A retry after a lost response could otherwise create a second source.

## Decision

Use `POST /api/sources` as a thin Next.js Route Handler and keep orchestration in `uploadPdfSource`.

- The browser sends multipart form data with one PDF and a randomly generated upload UUID.
- `XMLHttpRequest` reports upload progress and keeps the Supabase secret out of the browser bundle.
- The same upload UUID is retained for retries of the selected file and becomes the `Source` primary key.
- If that source already exists, the server returns the existing successful result.
- Concurrent requests with the same UUID use distinct opaque Storage paths. The first database insert wins; the losing upload is removed by compensation and returns the existing source.
- Server validation remains authoritative and checks extension, declared MIME type, size, and PDF signature before upload.
- Storage succeeds before the `Source` is created with `pdf` type and `uploaded` status. Database failure triggers object removal.
- Transport errors return stable language-neutral codes. The client maps those codes to English or Italian catalog entries.
- Successful uploads redirect to a language-neutral confirmation route.

## Consequences

The route and React component remain thin, while the same service can later be called from another transport. Repeating a request or retrying after a network interruption does not create an unintended second import as long as the selected file retains its upload UUID.

The current route buffers multipart data in the Next.js server process. This is acceptable at the 25 MB MVP limit. Resumable or direct signed uploads can be introduced later behind the existing Storage interface if deployment limits or unreliable connections require them.
