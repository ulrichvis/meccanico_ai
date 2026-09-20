# ADR 0022: Bounded active case index

## Status

Accepted on 2026-09-18.

## Context

Operators need to browse persisted knowledge without opening source records individually. The first browsing slice must remain useful on the current dataset without introducing full-text search, embeddings, a generic grid framework, or an unbounded relational query.

## Decision

The `/cases` page uses a dedicated server-only Prisma read model. It selects presentation-safe case metadata, review status, source identity, up to four DTCs, and up to three vehicle applications. The default query includes only `active` cases, orders by `updatedAt` and identifier for deterministic output, and returns at most 50 rows.

The page links to the existing source-detail and optional correction routes. It does not expose raw provider output, validated extraction JSON, storage paths, or Prisma models. Interface copy is supplied in English and Italian while every technical value remains in its stored source language.

## Consequences

- The knowledge base is immediately browsable through a small, predictable query.
- Rejected and archived cases stay out of normal browsing by default.
- Search and explicit lifecycle filters can extend the repository through validated URL parameters in the next step.
- Pagination can be added later if real usage exceeds the initial bounded result.
- No database migration or new search infrastructure is required.
