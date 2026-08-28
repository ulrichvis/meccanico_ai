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

### 4.1 Multiple PDF upload

- [x] Accept up to 20 PDFs in one picker or drag-and-drop batch.
- [x] Enforce the 20 MB limit independently for every PDF.
- [x] Display validation, progress, and result independently for every file.
- [x] Upload with limited concurrency instead of starting every request at once.
- [x] Keep failures isolated so valid files continue uploading.
- [x] Allow retrying failed transfers with the same idempotency identifier.
- [x] Display a bilingual batch summary and allow starting another batch.

### 5. Minimal dashboard

- [x] Create `/sources` with a call to action linking to the upload page.
- [x] List recent sources with filename, date, type, and status.
- [x] Support empty, loading, and error states.
- [x] Make the page usable on mobile widths.

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
- [x] The dashboard works at a mobile viewport width.
- [x] English and Italian dashboard, navigation, upload, validation, and error states render correctly.
- [ ] Automatic locale selection uses a supported browser preference and falls back to English.
- [x] The language selector replaces displayed text without changing the current route.
- [ ] No user-facing string in the Phase 1 frontend is hard-coded.

### Exit criteria

- [ ] No OpenAI call exists in the flow yet.
- [ ] The original file is private and retrievable through a signed URL.
- [ ] The stored `Source` contains no invented automotive information.
- [ ] Startup and verification commands are current in `docs/DEVELOPMENT.md`.
- [ ] Phase 2 can begin without redesigning the upload flow.

## Planned phases

The following phases are documented only. No implementation should begin until the Phase 2 plan has been reviewed and explicitly approved.

### Phase 2 — Source text extraction

Phase 2 ends with validated page-aware text. It must not create automotive cases or interpret photos and diagrams. Follow `docs/TEXT_EXTRACTION.md`.

#### 2.1 Contract and representative inputs

- [ ] Approve the Phase 2 scope and acceptance criteria before coding.
- [ ] Define a strict Zod contract for ordered `{ pageNumber, text }` content and source metadata.
- [ ] Select representative private fixtures: native text, scan-only, mixed text/scan, garbled Unicode, sparse pages, and a document containing useful diagrams or photographs.
- [ ] Record the source language without translating or rewriting source text.
- [ ] Confirm that missing metadata remains `null` and missing page text remains an empty string only when the page is known to exist.

#### 2.2 Direct PDF transfer

- [ ] Do not install a PDF-reading, text-layer, OCR, or local preflight library for Phase 2.
- [ ] Retrieve the original PDF from private Supabase Storage on the server.
- [ ] Verify source eligibility, object existence, validated MIME metadata, configured size limit, and non-empty transfer without parsing PDF content.
- [ ] Provide the complete PDF directly to the Responses API using a secure supported file-input method.
- [ ] Delete or expire temporary provider files when the selected transfer method creates them.
- [ ] Treat filenames and PDF metadata as untrusted and non-authoritative.

#### 2.3 OpenAI text extraction

- [ ] Add a server-only OpenAI adapter using the Responses API, PDF file input, and strict Structured Outputs.
- [ ] Version a text-extraction prompt that requests transcription only and forbids diagnosis, summarization, translation, domain extraction, and invented content.
- [ ] Allow scanned-page text transcription while forbidding descriptions or interpretations of diagrams and photographs.
- [ ] Require source-language text, ordered one-based page numbers, and explicit unreadable-page handling.
- [ ] Validate every model response with Zod and preserve every raw attempt.
- [ ] Verify current model names and PDF-input behavior against official OpenAI documentation immediately before implementation.

#### 2.4 Model routing and quality gates

- [ ] Centralize configurable primary, escalation, and exceptional model tiers; never scatter model identifiers through the code.
- [ ] Send every eligible PDF to the primary configured model without local difficulty classification.
- [ ] Validate page ordering, uniqueness, returned page count, non-empty coverage, Unicode quality, duplicated content, and absence of automotive interpretation.
- [ ] Escalate only after a measurable schema or output-quality failure with a recorded reason.
- [ ] Cap retries and escalation so one source never calls every tier automatically.
- [ ] Document that completeness cannot be independently proven without a local parser and preserve the original PDF and extraction history for audit.

#### 2.5 Persistence and status orchestration

- [ ] Implement the text-extraction service independently from routes and React components.
- [ ] Transition `Source` through `uploaded -> extracting_text -> text_extracted` or `failed` with recoverable errors.
- [ ] Persist accepted content in `Source.rawText`, `Document.pagesJson`, and `Document.metadataJson`.
- [ ] Store the file-transfer method, model route, extraction method, quality result, and reason codes as non-domain metadata.
- [ ] Create an `ExtractionJob` for every model attempt and distinguish Phase 2 with a `text-extraction-v1`-style version.
- [ ] Keep every retry as a new job and never overwrite an earlier raw or validated output.
- [ ] Ensure OpenAI never writes directly to Supabase.
- [ ] Make `processSource(sourceId)` idempotent or safe to retry without duplicate `Document` records.

#### 2.6 Cost, privacy, and observability

- [ ] Log `sourceId`, `extractionJobId`, processing step, duration, model, version, outcome, escalation reason, and returned token categories without logging document content.
- [ ] Keep the OpenAI API key server-only and validate all new environment variables.
- [ ] Use temporary private file transfer and delete or expire provider-side files when applicable.
- [ ] Never leak service-role credentials or signed document URLs in logs, model output, or client payloads.
- [ ] Decide later, from operational needs, whether persistent token-usage columns are necessary; do not block Phase 2 on a cost-dashboard schema.

#### 2.7 Minimal processing UI

- [ ] Add a source action or controlled trigger for text extraction.
- [ ] Display localized extraction states and retryable errors on the source list or a source detail page.
- [ ] Keep routes and components thin and put every new user-facing string in both locale catalogs.
- [ ] Do not expose raw document content or technical provider errors unnecessarily.

#### 2.8 Phase 2 verification

- [ ] Native, scan-only, and mixed PDFs are each sent directly to OpenAI through the same initial file-input path.
- [ ] A native PDF produces ordered, faithful page text without any local PDF-reading dependency.
- [ ] A scan-only PDF can return visible text without producing descriptions of photographs or diagrams.
- [ ] A mixed PDF preserves page numbers and reports unreadable pages without inventing content.
- [ ] Invalid model output is stored, marked safely, and creates no domain record.
- [ ] Retrying a failed source preserves the previous attempt and avoids duplicate documents.
- [ ] Photos and diagrams remain in the original private PDF and are not separately extracted or interpreted.
- [ ] `pnpm lint`, `pnpm i18n:check`, `pnpm typecheck`, and `pnpm build` pass.
- [ ] English and Italian processing states, errors, and actions are manually verified.

### Phase 3 — Structured automotive AI

Phase 3 consumes only the validated page-aware text produced by Phase 2. It does not parse PDFs or write normalized domain rows.

- [ ] Implement the accepted `automotive-structure-v1` behavior from `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md` without reusing it for Phase 2 transcription.
- [ ] Implement the strict Zod schema from `docs/EXTRACTION_CONTRACT.md`, including zero or many cases, several vehicles, several repair outcomes, and temporary references.
- [ ] Review every output field against `docs/DATA_MODEL.md`; omit database UUIDs, normalized keys, timestamps, lifecycle state, and review state from the model contract.
- [ ] Version an automotive system prompt that prioritizes fidelity, uncertainty, traceability, and multiple-case handling.
- [ ] Make source content override filenames and upload metadata whenever they conflict.
- [ ] Require explicit separation of symptoms, causes, components, diagnostic checks, measurements, solutions, procedures, materials, and outcomes.
- [ ] Treat the primary DTC and each related DTC distinctly, including relationship type, origin, and inference confidence.
- [ ] Keep explicit source facts separate from AI inferences and reject an inference without a valid confidence value.
- [ ] Leave unknown scalar values `null`, unknown collections `[]`, `probabilitySource` `null` unless explicitly stated, and `probabilityCalculated` always `null` in the MVP.
- [ ] Require temporary entity references and page/excerpt evidence for important facts and inferred relationships.
- [ ] Require a non-empty exact excerpt for every evidence item and omit unverifiable evidence rather than inventing it.
- [ ] Add `documentAnalysis.uncertainties` and advisory `requiresHumanReview` to validated output without making human review a persistence gate.
- [ ] Limit generic graph node types to the current database enum and use dedicated references for measurement-to-check, procedure-to-solution, and outcome-to-solution links.
- [ ] Preserve measurement conditions and ordered procedure variant wording without silently normalizing ambiguous units or values.
- [ ] Integrate the Responses API with strict Structured Outputs through a replaceable OpenAI adapter.
- [ ] Configure structured-analysis models separately from Phase 2 text-extraction models.
- [ ] Add bounded schema and semantic quality gates with escalation only when cheaper output fails measurably.
- [ ] Preserve immutable raw and validated outputs, model, prompt version, outcome, duration, and token usage.
- [ ] On invalid output, create no partial relational graph and make retry create a new job.
- [ ] Verify that Phase 3 ignores visual meaning not represented in the validated text input.
- [ ] Manually evaluate the prompt against the representative acceptance scenarios listed in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md` before enabling automatic normalization.

### Phase 4 — Normalization and relational persistence

- [ ] Build a normalizer that maps temporary extraction references to application entities without coupling the schema to a prompt version.
- [ ] Normalize DTC codes without altering the original code or description.
- [ ] Apply conservative reference-data deduplication while preserving case-specific wording.
- [ ] Validate all graph and evidence references, confidence ranges, numeric bounds, primary-DTC uniqueness, and repair-outcome invariants.
- [ ] Keep causes, diagnostic checks, proposed repairs, and confirmed outcomes as distinct entities.
- [ ] Persist all cases from one validated extraction in a transaction, with no partial graph on failure.
- [ ] Store every valid case as `active` and `unreviewed` without waiting for human approval.
- [ ] Preserve evidence excerpts, original wording, raw AI output, and validated output after normalization.
- [ ] Complete `processSource(sourceId)` orchestration without placing business logic in routes or components.
- [ ] Verify multi-case documents, multi-DTC cases, transaction rollback, retry history, and optional later human editing.

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

### Future multimodal source evidence

- [ ] Design the visual-asset contract from representative PDFs before adding a schema or Storage convention.
- [ ] Extract diagrams and photographs with page and region traceability.
- [ ] Store original visual assets separately from observed text and AI-generated interpretations.
- [ ] Link visual evidence to cases or diagnostic entities without coupling the domain to PDF.
- [ ] Evaluate image usefulness, privacy, cost, and groundedness before exposing visuals to the mechanic assistant.

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
| 2026-08-28 | Phase 1.4.1 | Added batches of up to 20 PDFs, a 20 MiB per-file limit, three-request concurrency, independent results, retries, and bilingual summaries. | Bucket limit verified; concurrent live uploads, persistence, idempotency, invalid-content isolation, catalog parity, lint, types, and production build passed. |
| 2026-08-28 | Phase 1.5 | Added the `/sources` dashboard with recent-source metadata, localized statuses and dates, responsive rows, and empty/loading/error states. | Live MecAI data rendered in English and Italian; 390 px mobile layout and browser console passed; recent-source index migration applied. |
| 2026-08-29 | Documentation | Simplified Phase 2 to send every original PDF directly to OpenAI, removed the planned local PDF parser and preflight, and retained bounded validation, audit history, and future visual extraction. | Cross-checked the plan against the Prisma schema, architecture rules, and official Responses API PDF file-input documentation; no code or schema changes made. |
| 2026-08-29 | Documentation | Accepted the supplied automotive diagnostic-structure prompt as the Phase 3 baseline and adapted its contract to the existing relational schema. | Verified multiple-vehicle and outcome cardinality, evidence nullability, supported graph nodes, dedicated foreign-key links, non-blocking review semantics, PDF input, and Structured Outputs; no code or schema changes made. |
