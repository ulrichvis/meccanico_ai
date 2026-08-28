# Development guide

## Prerequisites

- Node.js 24.19.0 LTS
- pnpm 11.19.0
- a Supabase project with PostgreSQL and Storage
- Git

Node.js and pnpm are pinned in `.nvmrc`, `.node-version`, `package.json`, and the lockfile.

## Installation

Install dependencies and start the current application with:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

On PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env.local
```

The current environment schema provides safe defaults for commands that do not access external services. `.env.local` is required before applying migrations or running database queries.

## Standard commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the local development server. |
| `pnpm lint` | Run static analysis rules. |
| `pnpm i18n:check` | Verify locale catalog syntax and key parity. |
| `pnpm typecheck` | Check TypeScript without producing a build. |
| `pnpm build` | Verify the production build. |
| `pnpm db:format` | Format `prisma/schema.prisma`. |
| `pnpm db:validate` | Validate the Prisma schema without connecting to PostgreSQL. |
| `pnpm db:generate` | Regenerate the typed Prisma client. |
| `pnpm db:migrate:dev --name <name>` | Create and apply a migration during development. |
| `pnpm db:migrate:deploy` | Apply committed migrations to the configured database. |
| `pnpm db:migrate:status` | Compare committed migrations with the configured database. |
| `pnpm db:verify` | Verify the live connection and a transactional `Source` create/read operation. |
| `pnpm db:studio` | Open Prisma Studio with the migration connection. |
| `pnpm storage:configure` | Idempotently create or update the private PDF bucket. |
| `pnpm storage:check` | Check server validation, opaque paths, and failed-persistence cleanup locally. |
| `pnpm storage:verify` | Verify a live upload, signed retrieval, and cleanup with a synthetic PDF. |

`pnpm build` and `pnpm install` regenerate Prisma Client automatically. Schema validation and client generation work while database variables are empty; migration and query commands require credentials.

## Supabase database setup

The repository intentionally contains no database credentials. When you are ready to connect the existing Supabase project:

1. Copy `.env.example` to `.env.local` if the local file does not already exist.
2. In the Supabase project dashboard, open **Connect** and copy the PostgreSQL connection strings.
3. Set `DATABASE_URL` to the transaction pooler connection string on port `6543` for serverless or auto-scaling application traffic. A persistent server may instead use its appropriate pooled connection.
4. Set `DIRECT_URL` to the direct connection string on port `5432`. If the development network cannot reach the IPv6 direct endpoint, use the Supavisor session pooler on port `5432`.
5. Keep both values server-side. Percent-encode special characters in the database password when required by URL syntax.
6. Apply the committed migration and run the live verification:

```bash
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:verify
```

The verification creates, reads, and removes a synthetic `Source` inside one transaction. It does not leave a test row behind. A successful run prints only a success message and never prints a connection string.

All application tables have row-level security enabled with no public policies. Prisma connects through the dedicated server-side `mecai_prisma` role; its credential exists only in `.env.local`. Do not put `DATABASE_URL` or `DIRECT_URL` in a `NEXT_PUBLIC_` variable.

Runtime PostgreSQL TLS is verified with Supabase's public production CA certificate stored at `certificates/supabase-prod-ca-2021.crt`. Do not add an `sslmode` query parameter to `DATABASE_URL`, because `pg-connection-string` can replace the explicit CA configuration when SSL parameters are present in the URL. Prisma CLI migration connections continue to use the SSL mode declared in `DIRECT_URL`.

## Supabase Storage setup

The application uses a private bucket named `technical-sources`. It accepts only `application/pdf` objects up to 25 MiB (26,214,400 bytes). The application repeats the same checks on the server and also verifies the `%PDF-` file signature.

Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DOCUMENTS_BUCKET` in `.env.local`, then run:

```bash
pnpm storage:configure
pnpm storage:check
pnpm storage:verify
```

`storage:configure` is idempotent. It creates the bucket when absent and otherwise restores its private access, PDF MIME restriction, and size limit. `storage:verify` uploads a synthetic PDF, retrieves it through a 60-second signed URL, and removes it in a `finally` block.

Storage paths use `sources/<source-id>/<random-uuid>.pdf`; the submitted filename is retained only as source metadata and never controls an object path. The service secret remains server-only. No `storage.objects` policy is added in this phase because browsers never access the bucket directly: trusted server code uploads, removes, and signs objects using the Supabase secret key. Any future direct client access requires a separate least-privilege RLS decision.

Supabase also applies a project-wide Storage file-size ceiling. The bucket-specific 25 MiB limit must remain at or below that global ceiling. Supabase Free projects currently allow a global limit up to 50 MB, so 25 MiB is supported.

## Migration conventions

- A change to `schema.prisma` requires an explicitly named migration.
- Never modify a migration already applied to a shared environment.
- Separate complex data migrations from structural migrations.
- Before production, verify a migration against both an empty database and a database containing representative examples.
- Add unsupported PostgreSQL features such as `CHECK` constraints directly to a create-only migration before applying it.
- Use `DIRECT_URL` for Prisma CLI operations and `DATABASE_URL` only for application runtime queries.

## Code conventions

- Use English for variables, functions, files, types, comments, technical documentation, logs, and internal error codes.
- Put every user-facing string in `messages/en.json` and `messages/it.json`; do not hard-code interface copy.
- Use `kebab-case` filenames and `PascalCase` React components.
- Suffix Zod schemas with `Schema`; infer types with `z.infer` where possible.
- Store dates in UTC and display them in the user's time zone.
- Use opaque identifiers; do not expose domain ordering through IDs.
- Avoid floating-point values when exact monetary or measurement precision matters.

## Localization workflow

- English (`en`) is the default locale and the canonical source for message intent.
- Italian (`it`) is required for every production message key.
- Add or modify the same key in both catalogs in one change.
- Use semantic hierarchical keys such as `upload.dropzone.title`, not English sentences as keys.
- Keep interpolation variables language-neutral and named in English.
- Format dates, numbers, and units through locale-aware formatters.
- Never translate domain identifiers, DTC codes, storage values, or original evidence excerpts.
- Automatic language selection uses URL, saved preference, and supported browser preferences; it does not use runtime machine translation.
- Run the catalog parity check before lint, type checking, and build verification.

## Change validation

While unit tests are deferred, every code change must pass at minimum:

```bash
pnpm i18n:check
pnpm lint
pnpm typecheck
pnpm build
```

Then add a manual check proportionate to the feature in `docs/TASKS.md`. Automated tests will be introduced after the first flows stabilize, without preventing testable design now.

## Data and secrets

- Commit `.env.example`, never `.env.local`.
- Never include a real customer document in Git fixtures.
- Use synthetic or anonymized PDFs for manual verification.
- Do not write Supabase or OpenAI keys to logs.
- Do not store user content in a third-party system not covered by the architecture.

## Definition of done for a phase

A phase is complete when:

- its acceptance criteria are satisfied;
- the i18n catalog check, lint, type checking, and the build pass;
- the documented manual journey has been executed;
- common errors produce actionable UI feedback;
- the schema and architecture decisions are up to date;
- `docs/TASKS.md` reflects the exact implementation status.
