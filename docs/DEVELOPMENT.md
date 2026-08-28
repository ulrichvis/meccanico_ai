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

The current environment schema provides safe defaults, so `.env.local` is optional until database and Storage work begins.

## Standard commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the local development server. |
| `pnpm lint` | Run static analysis rules. |
| `pnpm i18n:check` | Verify locale catalog syntax and key parity. |
| `pnpm typecheck` | Check TypeScript without producing a build. |
| `pnpm build` | Verify the production build. |

Prisma commands will be added in Phase 1, point 2 when the database layer is implemented.

## Target Supabase configuration

1. Create a private bucket named `technical-sources`.
2. Deny public file access.
3. Generate server-side paths in the form `sources/<source-id>/<safe-file-name>`.
4. Use the service-role key only on the server.
5. Use temporary signed URLs for previews.
6. Document every added RLS policy.

## Migration conventions

- A change to `schema.prisma` requires an explicitly named migration.
- Never modify a migration already applied to a shared environment.
- Separate complex data migrations from structural migrations.
- Before production, verify a migration against both an empty database and a database containing representative examples.

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
