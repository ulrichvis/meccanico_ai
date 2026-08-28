# ADR 0004: Prisma and Supabase database foundation

- Status: Accepted
- Date: 2026-08-28

## Context

The product needs a source-independent relational knowledge base before PDF upload, extraction, and later mechanic-facing retrieval can be implemented. The Supabase PostgreSQL project already exists, but its credentials must remain local and were intentionally unavailable while the schema was prepared.

The data model also requires partial uniqueness, confidence ranges, immutable extraction artifacts, and a closed browser-access posture. Some of these requirements cannot be expressed completely in the Prisma Schema Language.

## Decision

Use Prisma ORM 7 with PostgreSQL and the `pg` driver adapter.

- `DATABASE_URL` is the pooled runtime connection used by the application.
- `DIRECT_URL` is the direct or session connection used by Prisma migrations and administrative tooling.
- Runtime TLS verifies the Supabase pooler against the committed Supabase production CA certificate instead of disabling certificate verification.
- The application and migration commands use a dedicated `mecai_prisma` login with only the database and `public` schema privileges needed by Prisma. It is a server-only role with `BYPASSRLS` and `CREATEDB`; its generated password is stored only in `.env.local`.
- Prisma configuration loads the same root `.env*` files as Next.js.
- Schema validation and client generation remain available when both variables are empty.
- Prisma models use English camel-case identifiers and map to snake-case PostgreSQL names.
- The initial schema includes ingestion, normalized automotive knowledge, evidence, and relationship tables needed by planned phases, without implementing their services.
- PostgreSQL `CHECK` constraints are maintained in migration SQL.
- The one-primary-DTC rule uses a partial unique index.
- All application tables enable row-level security without public policies. Database access remains server-side through a trusted role.
- `probability_stats`, embeddings, chat records, and retrieval logic remain outside the MVP database baseline.

## Consequences

The project can generate a typed database client and validate the complete schema before credentials are supplied. Applying migrations, checking migration status, and exercising CRUD require the developer to add private Supabase connection strings to `.env.local`.

Future migrations must not accidentally drop the manually maintained check constraints. If browser-side Supabase Data API access is introduced, it requires a separate decision and explicit least-privilege RLS policies.
