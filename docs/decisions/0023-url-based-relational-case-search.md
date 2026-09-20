# ADR 0023: URL-based relational case search

## Status

Accepted on 2026-09-18.

## Context

Operators need to find a stored case by familiar workshop identifiers and distinguish its review and lifecycle state. The first MVP dataset does not justify a separate search engine, ranking system, embeddings, or a new database index without measured query evidence.

## Decision

The `/cases` page uses a native GET form and a Zod-validated URL query contract. One optional search term matches case titles, DTC codes, vehicle makes, models, engine codes, and engine descriptions through relational Prisma filters. Review status and lifecycle status are explicit filters; review defaults to all values and lifecycle defaults to active.

Invalid, overlong, or repeated parameters resolve to safe defaults. Search remains case-insensitive substring matching, results remain ordered by `updatedAt` and identifier, and every query returns at most 50 cases. Technical values are displayed exactly as stored while filter labels and statuses use the English and Italian catalogs.

## Consequences

- Search and filter state is reloadable, bookmarkable, and shareable without client-side routing state.
- The implementation reuses PostgreSQL and the current relational model without a migration or external service.
- The default view still excludes rejected and archived cases, while operators can select either state explicitly.
- Matching is intentionally simple: there is no fuzzy spelling correction, relevance score, stemming, or full-text ranking.
- Query performance should be measured against real data before adding indexes, pagination, or dedicated search infrastructure.
