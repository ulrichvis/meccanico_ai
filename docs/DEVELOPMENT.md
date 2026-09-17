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
| `pnpm upload:verify` | Verify the running upload endpoint, database persistence, retry idempotency, invalid-content rejection, and cleanup. |
| `pnpm openai:verify-pdf [source-id]` | Send one eligible private PDF directly to OpenAI and validate its page-aware text response without persisting it. |
| `pnpm source:process --list` | List recent PDF source identifiers and statuses for operator selection. |
| `pnpm source:process <source-id>` | Extract one private PDF and persist validated text, pages, metadata, and attempt history. |
| `pnpm extraction:verify` | Verify persistence, retries, concurrency, stale recovery, and rollback in Supabase using synthetic responses and temporary records; no OpenAI charge. |
| `pnpm automotive-schema:verify` | Verify the strict automotive extraction contract and cross-reference invariants locally. |
| `pnpm automotive-prompt:verify` | Verify prompt semantics and page-input isolation locally. |
| `pnpm automotive-adapter:verify` | Verify the OpenAI automotive Structured Outputs adapter with synthetic responses; no OpenAI charge. |
| `pnpm automotive-persistence:verify` | Verify Phase 3 quality gates, bounded escalation, audit history, idempotency, and zero domain writes in Supabase using temporary records; no OpenAI charge. |
| `pnpm automotive-live:verify` | Run three representative structured-analysis checks against the configured OpenAI model; this makes billable API calls. |
| `pnpm automotive:process --list` | List sources whose saved Phase 2 text is eligible for structured automotive analysis. |
| `pnpm automotive:process <source-id>` | Send one source's saved page-aware text to OpenAI and preserve the Phase 3 attempt; this is billable and does not normalize domain rows. |

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

The application uses a private bucket named `technical-sources`. It accepts only `application/pdf` objects up to 20 MiB (20,971,520 bytes). The application repeats the same checks on the server and also verifies the `%PDF-` file signature.

Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DOCUMENTS_BUCKET` in `.env.local`, then run:

```bash
pnpm storage:configure
pnpm storage:check
pnpm storage:verify
```

`storage:configure` is idempotent. It creates the bucket when absent and otherwise restores its private access, PDF MIME restriction, and size limit. `storage:verify` uploads a synthetic PDF, retrieves it through a 60-second signed URL, and removes it in a `finally` block.

Storage paths use `sources/<source-id>/<random-uuid>.pdf`; the submitted filename is retained only as source metadata and never controls an object path. The service secret remains server-only. No `storage.objects` policy is added in this phase because browsers never access the bucket directly: trusted server code uploads, removes, and signs objects using the Supabase secret key. Any future direct client access requires a separate least-privilege RLS decision.

Supabase also applies a project-wide Storage file-size ceiling. The bucket-specific 20 MiB limit must remain at or below that global ceiling. Supabase Free projects currently allow a global limit up to 50 MB, so 20 MiB is supported.

## PDF upload verification

Start the application, then run the live endpoint verification in another terminal:

```bash
pnpm dev
pnpm upload:verify
```

The verification submits a synthetic PDF twice with the same upload identifier, concurrently uploads three additional PDFs, confirms one `Source` per valid document, checks invalid PDF-content rejection, and removes every Storage object and database row it created.

For a manual UI check, open `/upload` and select or drop up to 20 PDFs no larger than 20 MB each. Confirm that every file has its own validation, progress, and result; invalid files do not block valid files; failed transfers can be retried; and the final bilingual summary reports stored and failed files independently. A single successful PDF still redirects to `/upload/<source-id>/success`.

## Source dashboard verification

Open `/sources` after uploading one or more documents. The page displays at most the 50 most recent sources, ordered by upload date and identifier, with filename, source type, processing status, and a locale-formatted timestamp. Verify that:

- the header links to both `/sources` and `/upload`;
- English and Italian change every label, status, and formatted date without changing the URL;
- the table becomes stacked source cards at a mobile width;
- an empty database shows the upload call to action;
- a database connection failure shows the recoverable error state;
- navigation displays the loading skeleton while the server query is pending.

The query is bounded and supported by `sources_created_at_id_idx`, which matches its descending sort order.

## OpenAI PDF transfer verification

Set the server-only `OPENAI_API_KEY` and `OPENAI_EXTRACTION_MODEL` values in `.env.local`. To exercise the Phase 2 transfer boundary against the latest eligible uploaded PDF, run:

```bash
pnpm openai:verify-pdf
```

Pass a source UUID as the optional argument to select a specific uploaded PDF. This command performs a real billable OpenAI request. It verifies the private Storage object's existence, PDF content type, non-zero size, and configured size ceiling; creates a ten-minute signed URL; sends the complete PDF as a Responses API file input; and validates the strict structured response. It writes no extracted text or status changes to the database and logs neither document content nor the signed URL.

## Persisted text extraction verification

Use the existing OpenAI key and primary model in `.env.local`. Optional escalation/exceptional model settings are listed in `.env.example`; they remain empty until intentionally configured. Two attempts are allowed per invocation by default. The operator command is a real billable extraction and preserves its results:

```bash
pnpm source:process --list
pnpm source:process <source-id>
pnpm source:process <source-id>
```

The first successful invocation returns `completed` with the document ID. Repeating it returns `already_processed` without another model call. Inspect the source status (`text_extracted`), `raw_text`, document pages/metadata, and completed extraction job in the database. There must be exactly one accepted document from this flow, with `unreviewed` metadata.

The same processor is available from `/sources/[sourceId]`. For a manual UI check:

1. Open `/sources` and follow the action for an uploaded source.
2. Start extraction and verify the localized processing state; on a retryable failure, the same control becomes a retry action.
3. After success, verify title, author, source date, source language, page and character counts, model, prompt version, warnings, and extraction history.
4. Expand each page and compare the saved source-language text with the original PDF. The recap must not translate or summarize it.
5. Switch between English and Italian and verify that interface text changes without changing the route or source text.
6. Repeat at a narrow mobile viewport and confirm that the page has no horizontal overflow.

The recap reads saved database content and never causes an additional model call. Browser payloads and logs must not include signed URLs, Storage paths, credentials, raw provider responses, or internal provider errors.

For failure behavior, run `pnpm extraction:verify`. It creates UUID-scoped synthetic records, uses the real OpenAI response adapter with simulated responses, and checks malformed schema, empty text, NUL preservation, refusals, bounded escalation, later retry, simultaneous invocation, stale-worker ownership, and transactional rollback. It deletes only the synthetic records it created in a final cleanup transaction and never uploads or removes Storage objects.

A source interrupted by a process exit can be retried after ten minutes. Do not manually change its status while a worker is active. A database failure may leave a running job for recovery; raw responses already saved remain attached to that job.

## Automotive structured-analysis adapter verification

Phase 3 uses `OPENAI_AUTOMOTIVE_MODEL` and `OPENAI_AUTOMOTIVE_REASONING_EFFORT` independently from the Phase 2 transcription model. The model remains optional until real automotive analysis is invoked; reasoning effort defaults to `medium` when omitted.

Run the non-billable adapter verification with:

```bash
pnpm automotive-schema:verify
pnpm automotive-prompt:verify
pnpm automotive-adapter:verify
pnpm automotive-persistence:verify
```

The adapter verification injects synthetic provider responses. It confirms the Responses API request shape, strict generated JSON Schema, prompt/input separation, raw-response callback, Zod revalidation, usage mapping, refusals, incomplete responses, provider errors, and schema failures. It does not read `.env.local`, contact OpenAI, write to Supabase, or log document content.

The persistence verification uses the configured Supabase database but never contacts OpenAI. It creates temporary Phase 2-like text records, checks a measurable semantic failure followed by one configured escalation, verifies one immutable `ExtractionJob` per attempt, confirms idempotent completion and non-retryable provider failure, and proves that no normalized automotive row is created. It deletes only its own UUID-scoped records in a final cleanup transaction.

Real automotive processing requires `OPENAI_AUTOMOTIVE_MODEL`. Optional escalation and exceptional models must be distinct and are considered only after schema, incomplete-response, malformed-response, or deterministic semantic failure. `OPENAI_AUTOMOTIVE_MAX_ATTEMPTS` is bounded from one to three and defaults to two. A successful Phase 3 job intentionally leaves its source in `processing`; Phase 4 will own the transaction that creates domain rows and advances the source to `persisted`.

The application therefore makes two separate OpenAI calls in the complete ingestion path. Phase 2 sends the original PDF for faithful page-aware transcription. Phase 3 later sends only that saved text through `automotive:process` for semantic classification. The source-list UI does not trigger the second call yet; automatic orchestration belongs to Phase 4, after normalization can persist the accepted structure atomically.

`pnpm automotive-live:verify` uses only three synthetic text inputs. It covers generic applicability, multiple DTCs without a forced primary code, diagnostic checks versus repairs, qualitative frequency, multiple independent cases, measurements, contradictory procedures, repair outcomes, incomplete text, and the visual-only boundary. It prints aggregate counts and token usage but does not print complete provider responses or create database rows. See `docs/PHASE_3_VERIFICATION.md`.

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
