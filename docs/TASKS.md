# Development backlog

This file is the project's operational tracker. Check only tasks that are actually complete and verified.

## Active phase: Phase 1 — Foundation and PDF upload

### 1. Initialization

- [x] Initialize Next.js with App Router, strict TypeScript, Tailwind, and `src/`.
- [x] Configure pnpm and pin the Node.js version.
- [x] Add ESLint and the `lint`, `typecheck`, and `build` scripts.
- [x] Configure text localization for `en` and `it`, with English as the default locale and no locale-specific routing.
- [x] Create `messages/en.json` and `messages/it.json` with identical key structures.
- [x] Add automatic supported-locale detection and a persistent language selector.
- [x] Add an `i18n:check` script that verifies catalog syntax and key parity.
- [x] Create `.env.example` and validate the server environment with Zod.
- [x] Add an appropriate `.gitignore`.
- [x] Create a minimal mobile-first layout and navigation in English and Italian.

### 2. Database

- [x] Install and configure Prisma for PostgreSQL.
- [x] Translate the model in `docs/DATA_MODEL.md` into `schema.prisma`.
- [x] Include tables required by future phases without implementing their logic.
- [x] Add confidence constraints, DTC uniqueness, and essential indexes.
- [x] Generate the initial migration.
- [x] Apply the initial migration to Supabase after local connection strings are provided.
- [x] Verify the connection and a `Source` create/read operation.

### 3. Storage

- [x] Create, or document how to create, the private `technical-sources` bucket.
- [x] Add a server-side Supabase client.
- [x] Generate storage paths independently from the submitted filename.
- [x] Validate extension, MIME type, and maximum size on the server.
- [x] Remove the uploaded file if database creation fails after upload.
- [x] Support a signed URL for future document access.

### 4. PDF upload

- [x] Create `/upload` with drag and drop and a file picker.
- [x] Display filename, size, progress, and errors.
- [x] Send the file to the server without exposing the service-role key.
- [x] Store the PDF, then create the `Source` with the `uploaded` status.
- [x] Make the operation idempotent or prevent immediate duplicate submissions.
- [x] Redirect to a confirmation page or the dashboard.

### 5. Minimal dashboard

- [ ] Create `/` with a call to action linking to the upload page.
- [ ] List recent sources with filename, date, type, and status.
- [ ] Support empty, loading, and error states.
- [ ] Make the page usable on mobile widths.

### 6. Phase 1 verification

- [x] `pnpm lint` passes.
- [x] `pnpm i18n:check` passes and both catalogs contain the same keys.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] A small valid PDF uploads and appears in Storage and the database.
- [x] A non-PDF file is rejected with a clear message.
- [x] An oversized PDF is rejected.
- [x] A duplicate submission does not create two unintended imports.
- [x] A Storage/database failure produces a recoverable state with no known orphaned file.
- [ ] The dashboard works at a mobile viewport width.
- [ ] English and Italian dashboard, navigation, upload, validation, and error states render correctly.
- [ ] Automatic locale selection uses a supported browser preference and falls back to English.
- [x] The language selector replaces displayed text without changing the current route.
- [ ] No user-facing string in the Phase 1 frontend is hard-coded.

### Exit criteria

- [ ] No OpenAI call exists in the flow yet.
- [ ] The original file is private and retrievable through a signed URL.
- [ ] The stored `Source` contains no invented automotive information.
- [ ] Startup and verification commands are current in `docs/DEVELOPMENT.md`.
- [ ] Phase 2 can begin without redesigning the upload flow.

## Later phases

### Phase 2 — Text extraction

- [ ] Select a PDF library compatible with the server environment.
- [ ] Extract text page by page.
- [ ] Create the document and its metadata.
- [ ] Handle scanned PDFs without incorrectly treating them as empty.
- [ ] Create and display `ExtractionJob` statuses.

### Phase 3 — Structured AI

- [ ] Implement the Zod schema from `docs/EXTRACTION_CONTRACT.md`.
- [ ] Version the automotive system prompt.
- [ ] Integrate OpenAI structured outputs.
- [ ] Preserve raw and validated outputs.
- [ ] Handle invalid outputs and retries.

### Phase 4 — Normalization

- [ ] Normalize DTC codes without altering the original code.
- [ ] Validate graph references.
- [ ] Persist each case in a transaction.
- [ ] Store every valid case as `active` and `unreviewed` without waiting for human approval.
- [ ] Preserve evidence and original wording.

### Phase 5 — Optional admin review and editing

- [ ] Build the review screen.
- [ ] Allow editing of all useful entities.
- [ ] Highlight inferences.
- [ ] Allow cases to be marked as reviewed, corrected, rejected, or archived.
- [ ] Preserve raw and validated extraction artifacts after edits.

### Phase 6 — Search and browsing

- [ ] List active cases with visible review status.
- [ ] Search by DTC, make, model, and engine.
- [ ] Display the complete case and its relationships.

### Post-MVP — Mechanic-facing assistant

- [ ] Define retrieval and ranking policies for reviewed and unreviewed knowledge.
- [ ] Implement evidence-backed retrieval over stored cases.
- [ ] Build the conversational interface for mechanics.
- [ ] Ask follow-up questions when vehicle or diagnostic context is incomplete.
- [ ] Cite supporting cases and expose uncertainty.
- [ ] Support English and Italian conversation output using the selected product locale.
- [ ] Evaluate groundedness before production use.

## Progress log

| Date | Phase | Change | Verification |
|---|---|---|---|
| 2026-08-25 | Documentation | Created the initial documentation and backlog. | Cross-checked all Markdown files. |
| 2026-08-25 | Documentation | Translated all project documentation into English and established English as the primary project language. | Checked internal links, formatting, and residual French text. |
| 2026-08-25 | Documentation | Made human review non-blocking and documented the future mechanic-facing conversational assistant. | Cross-checked product, architecture, data, roadmap, and ADR terminology. |
| 2026-08-25 | Documentation | Established English as the development language and English/Italian as required frontend locales. | Added i18n architecture, catalog rules, and Phase 1 verification criteria. |
| 2026-08-25 | Phase 1.1 | Initialized the application, tooling, environment schema, bilingual catalogs, language selector, and responsive shell. | i18n check, ESLint, TypeScript, production build, and desktop/mobile browser verification passed. |
| 2026-08-28 | Phase 1.2 | Added Prisma ORM, the PostgreSQL domain schema, database constraints, the initial migration, verified TLS, and a dedicated server-side database role. | Migration deployed to MecAI; migration status is current; transactional `Source` create/read/delete passed; Supabase advisors report no errors or warnings. |
| 2026-08-28 | Phase 1.3 | Added private Supabase Storage, a server-only client, PDF validation, opaque object paths, failed-persistence cleanup, and signed document access with a 25 MiB limit. | Local boundary and compensation checks passed; live synthetic PDF upload, signed retrieval, and cleanup passed on MecAI. |
| 2026-08-28 | Phase 1.4 | Added the bilingual PDF upload UI, progress reporting, server endpoint, relational persistence, retry idempotency, and confirmation page. | Live endpoint upload/persistence/retry/rejection/cleanup passed; English and Italian desktop and 390 px mobile layouts were browser-verified. |
