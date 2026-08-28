# ADR 0008: Recent sources dashboard

- Status: Accepted
- Date: 2026-08-28

## Context

Operators need a simple place to confirm which documents have been registered after single or batch upload. The root page already serves as the product landing page, and the domain is designed to support formats beyond PDF.

## Decision

Use `/sources` as the language-neutral route for the ingestion dashboard.

- Keep `/` as the product overview and `/upload` as the ingestion action.
- Name the route after the source-agnostic `Source` domain entity rather than the current PDF adapter.
- Query at most the 50 newest sources from a Server Component through the Prisma repository.
- Select only fields required by the view and serialize timestamps before crossing the server/client boundary.
- Sort by `created_at DESC, id DESC` for deterministic ordering and support it with `sources_created_at_id_idx`.
- Display filename, source identifier, type, status, and locale-formatted creation time.
- Resolve every label and enum display value through the English and Italian catalogs.
- Use route-level loading and error boundaries plus an in-page empty state.
- Convert the desktop table into stacked cards at narrow viewports.

## Consequences

The dashboard remains useful when email, text, audio, or diagnostic-report adapters are introduced. The bounded query and matching index provide a stable MVP read path without introducing pagination controls yet.

The page is currently an operational list, not document management. Opening, downloading, deleting, filtering, pagination, and admin editing remain outside this step.
