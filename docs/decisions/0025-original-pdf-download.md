# ADR 0025: On-demand original PDF download

- Date: 2026-10-01
- Status: Accepted

## Decision

Add an English/Italian download button to the source-detail heading. Generate a five-minute signed URL on click through a thin UUID-validated route and server service. Extend the existing replaceable Storage interface with an optional download filename; existing extraction links retain their behavior. The source ID resolves the path server-side, so clients cannot request arbitrary Storage objects.

Supabase supplies the attachment response with the original filename. Keep the bucket private and return `Cache-Control: private, no-store` from the application endpoint. Never log signed URLs or credentials. No PDF viewer, new dependency, schema migration, or AI call is required.

The endpoint inherits the operator-only deployment boundary of existing source pages. It does not introduce user authentication or per-user permissions.

## Manual verification

1. Open an existing PDF under `/sources`, then select Download original PDF.
2. Confirm the downloaded file keeps its original filename and matches the uploaded document.
3. Switch to Italian and repeat using Scarica il PDF originale.
4. Confirm pending/error feedback, mobile button layout, and that extraction remains available.
5. Confirm invalid and missing source identifiers return safe 400/404 responses without Storage URLs.
