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
| `pnpm automotive:process --list` | List sources eligible for new structured analysis or resumable accepted-artifact persistence. |
| `pnpm automotive:process <source-id>` | Run structured analysis when needed, then normalize and atomically persist the accepted graph. Retrying a completed source makes no additional OpenAI call. |
| `pnpm automotive-normalizer:verify` | Verify pure Phase 4 normalization, lookup keys, database enum mapping, defaults, and typed reference resolution without OpenAI or database access. |
| `pnpm automotive-graph:verify` | Verify atomic graph persistence, shared-reference upserts, UUID resolution, duplicate protection, immutable extraction artifacts, and rollback against the configured Supabase database; no OpenAI call is made. |
| `pnpm automotive-orchestration:verify` | Verify the complete Phase 3-to-4 flow against Supabase with a synthetic extractor, including atomic source completion, retry without another AI call, immutable audit output, and explicit zero-case completion. |
| `pnpm structured-recap:verify` | Verify a complete Italian structured recap query against Supabase with isolated temporary records and automatic cleanup. |

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

Real automotive processing requires `OPENAI_AUTOMOTIVE_MODEL`. Optional escalation and exceptional models must be distinct and are considered only after schema, incomplete-response, malformed-response, or deterministic semantic failure. `OPENAI_AUTOMOTIVE_MAX_ATTEMPTS` is bounded from one to three and defaults to two. A successful Phase 3 job is immediately passed to the Phase 4 normalizer and atomic graph persistence service. The source becomes `persisted` only in the successful graph transaction.

The application therefore makes two separate OpenAI calls in the complete ingestion path. Phase 2 sends the original PDF for faithful page-aware transcription. Phase 3 later sends only that saved text through the trusted command or the source-detail **Analyze and structure** action for semantic classification. Normalization and persistence reuse the saved accepted response and make no additional AI call.

`pnpm automotive-live:verify` uses only three synthetic text inputs. It covers generic applicability, multiple DTCs without a forced primary code, diagnostic checks versus repairs, qualitative frequency, multiple independent cases, measurements, contradictory procedures, repair outcomes, incomplete text, and the visual-only boundary. It prints aggregate counts and token usage but does not print complete provider responses or create database rows. See `docs/PHASE_3_VERIFICATION.md`.

Phase 4.1 is intentionally database-free. `pnpm automotive-normalizer:verify` revalidates the accepted extraction and converts it into database-oriented in-memory records. It preserves original values, adds only conservative lookup keys, maps contract enums to Prisma enum names, assigns `ACTIVE` and `UNREVIEWED`, and resolves temporary references to typed local targets.

Phase 4.2 consumes that normalized graph inside one Prisma interactive transaction. The repository locks and validates ownership, atomically upserts reusable reference rows, creates case-owned records and associations, resolves all UUID links, and rolls back the entire graph on failure. It neither overwrites `ExtractionJob` artifacts nor advances the source status. `pnpm automotive-graph:verify` creates isolated synthetic records, verifies a full two-case graph and a relationship/evidence cycle, proves duplicate protection and rollback, then removes only its own fixtures.

Phase 4.3 uses `processAutomotiveKnowledgeSource` as the application boundary shared by the trusted command and future transports. It first obtains or reuses an accepted Phase 3 job, then loads and revalidates its saved content, normalizes it, and persists the graph. Graph creation and the final `PERSISTED` source status share one transaction. A valid zero-case extraction creates no placeholder row; the persisted source status and immutable completed job are its completion record. `pnpm automotive-orchestration:verify` proves normal and zero-case retries make no second model call and create no duplicates.

Phase 4.4 extends the source-detail read model with the complete persisted automotive graph. Run `pnpm structured-recap:verify` to create an isolated Italian fixture, assert that the relational query preserves its technical wording, and remove the fixture automatically. For manual browser verification, run the command with `-- --keep`, open the printed `/sources/<source-id>` URL, switch between English and Italian, and confirm that only interface copy changes. Remove the fixture afterward with `pnpm structured-recap:verify -- --cleanup <source-id>`. Also check a 390 px viewport for horizontal overflow. The cleanup command refuses sources whose filename does not start with `structured-recap-`.

Phase 5.1 links every persisted case in the source recap to `/cases/<case-id>/review`. The route is read-only and reuses the Phase 4 presentation model filtered to one case, including readable relationship endpoints and review metadata. `pnpm structured-recap:verify -- --keep` now prints both `sourceId` and `caseId`, allowing the source link and direct review URL to be checked before running the existing guarded cleanup command.

Phase 5.2 adds the **Analyze and structure** action to `/sources/<source-id>` when page-aware text is ready and no persisted automotive result exists. The action calls `POST /api/sources/<source-id>/automotive-analysis`, disables duplicate submission while the request is active, and refreshes the source detail after the existing orchestration persists the result. A persisted zero-case result shows the established explicit empty recap. Sources whose structured attempt ended as `SCHEMA_INVALID` or `FAILED` receive a localized retry action, while `PROCESSING` renders a disabled progress state.

For manual verification, open a `TEXT_EXTRACTED` source and confirm the action in English and Italian. Starting it performs a billable OpenAI request using the configured automotive model and writes the accepted result to Supabase, so use a synthetic or approved source. After completion, confirm that the page shows persisted cases with **Review this case** links or the zero-case result, and that a reload does not offer a duplicate analysis action.

Phase 5.3 adds the complete correction form to `/cases/<case-id>/review`. Run `pnpm case-edit-schema:verify` to check the client contract, including the single-primary-DTC rule and typed relationship and evidence references.

Phase 5.4 connects **Save case** to `PUT /api/cases/<case-id>`. The server validates the complete payload again, uses the submitted `updatedAt` as an optimistic-concurrency token, and saves the complete case graph in one transaction. Run `pnpm case-review-save:verify` to create isolated synthetic records and verify corrected and reviewed transitions, complete graph persistence, stale-edit rejection, shared-reference protection, immutable extraction artifacts, rollback, and guarded cleanup. For manual verification, create the Italian fixture with `pnpm structured-recap:verify -- --keep`, open the printed review URL, change a field, save, and reload. Confirm the value and `corrected` status remain. Open the same case in two tabs to verify the older tab receives a reload message after the newer tab saves. An unchanged first save should mark an unreviewed case as reviewed. Switch between English and Italian and verify that only interface copy changes. Remove the fixture with `pnpm structured-recap:verify -- --cleanup <source-id>`.

Phase 5.5 adds explicit **Mark as reviewed**, **Reject case**, and **Archive case** actions through `PATCH /api/cases/<case-id>`. Review status remains independent from lifecycle status: review preserves an existing `corrected` value, while reject and archive move only an `active` case out of the normal retrieval flow. Rejection and archival require a browser confirmation and never delete database records.

For the complete Phase 5 check, run `pnpm case-edit-schema:verify` and `pnpm case-review-save:verify`. The database verifier covers existing and newly added graph records, shared references, stale writes, atomic rollback, every review/lifecycle transition, retained rows, and immutable extraction artifacts. In the browser, verify save/reload, validation feedback, confirmation prompts, lifecycle success messages, source-language technical content, and English/Italian interface switching at desktop and 390 px widths. Use only the guarded synthetic fixture commands above and remove the fixture afterward.

Phase 6.1 adds the active case library at `/cases`. Its server-only repository returns at most 50 cases ordered by `updatedAt` and identifier, with compact DTC, vehicle, source, and review-status context. It does not expose raw or validated provider output. For manual verification, create the guarded Italian fixture with `pnpm structured-recap:verify -- --keep`, open `/cases`, switch between English and Italian, and confirm that the interface and dates change while technical text remains Italian. Check the page at 390 px, open the source and review links, then remove the fixture with `pnpm structured-recap:verify -- --cleanup <source-id>`.

Phase 6.2 adds a native GET search form to `/cases`. The `q` parameter searches titles, DTC codes, makes, models, engine codes, and engine descriptions. The `review` parameter accepts `all`, `unreviewed`, `reviewed`, or `corrected`; `status` accepts `active`, `rejected`, or `archived`. Every value is validated on the server, unsupported values fall back to `all` review and `active` lifecycle, and the result remains capped at 50 rows. To verify manually, search one known DTC and vehicle field, change each status filter, reload the generated URL, and confirm its fields and results remain stable. Also open an invalid URL such as `/cases?review=invalid&status=invalid` and confirm the default active view loads without an error.

## Migration conventions

- A change to `schema.prisma` requires an explicitly named migration.
- Never modify a migration already applied to a shared environment.
- Separate complex data migrations from structural migrations.
- Before production, verify a migration against both an empty database and a database containing representative examples.
- Add unsupported PostgreSQL features such as `CHECK` constraints directly to a create-only migration before applying it.
- Use `DIRECT_URL` for Prisma CLI operations and `DATABASE_URL` only for application runtime queries.
- Migration `20260917120000_add_vehicle_normalized_key` adds the unique vehicle identity required for atomic upserts. It was applied without a backfill because the target `vehicles` table was empty.

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
