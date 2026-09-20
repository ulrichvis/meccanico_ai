# Development backlog

This file is the project's operational tracker. Check only tasks that are actually complete and verified.

## Next phase: Phase 6 — Search and browsing

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
- [x] Automatic locale selection uses a supported browser preference and falls back to English.
- [x] The language selector replaces displayed text without changing the current route.
- [x] No translatable user-facing string in the Phase 1 frontend is hard-coded.

### Exit criteria

- [x] Phase 1 was completed before any OpenAI call was integrated.
- [x] The original file is private and retrievable through a signed URL.
- [x] The stored `Source` contains no invented automotive information.
- [x] Startup and verification commands are current in `docs/DEVELOPMENT.md`.
- [x] Phase 2 can begin without redesigning the upload flow.

## Planned phases

Phases 2 and 3 are complete. Later phases remain documented only and require explicit approval before implementation.

### Phase 2 — Source text extraction

Phase 2 ends with validated page-aware text. It must not create automotive cases or interpret photos and diagrams. Follow `docs/TEXT_EXTRACTION.md`.

#### 2.1 Contract and representative inputs

- [x] Approve the Phase 2 scope and acceptance criteria before coding.
- [x] Define a strict Zod contract for ordered page content, text quality, uncertainty, and source metadata.
- [x] Select representative private fixtures: native text, scan-only, mixed text/scan, malformed Unicode boundaries, sparse/unreadable pages, and visual-only material. Controlled PDFs cover file-input fidelity; synthetic adapter responses cover unsafe Unicode that cannot be represented reliably as a normal PDF fixture.
- [x] Record the source language without translating or rewriting source text.
- [x] Confirm that missing metadata remains `null` and missing page text remains an empty string only when the page is known to exist.

#### 2.2 Direct PDF transfer

- [x] Do not install a PDF-reading, text-layer, OCR, or local preflight library for Phase 2.
- [x] Retrieve the original PDF from private Supabase Storage on the server.
- [x] Verify source eligibility, object existence, validated MIME metadata, configured size limit, and non-empty transfer without parsing PDF content.
- [x] Provide the complete PDF directly to the Responses API using a secure supported file-input method.
- [x] Use a ten-minute signed URL so no persistent provider file needs to be created or deleted.
- [x] Treat filenames and PDF metadata as untrusted and non-authoritative.

#### 2.3 OpenAI text extraction

- [x] Add a server-only OpenAI adapter using the Responses API, PDF file input, and strict Structured Outputs.
- [x] Version a text-extraction prompt that requests transcription only and forbids diagnosis, summarization, translation, domain extraction, and invented content.
- [x] Allow scanned-page text transcription while forbidding descriptions or interpretations of diagrams and photographs.
- [x] Require source-language text, ordered one-based page numbers, and explicit unreadable-page handling.
- [x] Validate every model response with Zod.
- [x] Persist every raw attempt through the Phase 2 orchestration history.
- [x] Verify the configured model and PDF-input behavior against official OpenAI documentation and a live private-PDF transfer.

#### 2.4 Model routing and quality gates

- [x] Centralize configurable primary, escalation, and exceptional model tiers; never scatter model identifiers through the code.
- [x] Send every eligible PDF to the primary configured model without local difficulty classification.
- [x] Validate page ordering, uniqueness, returned page count, non-empty coverage, and Unicode quality; report repeated long page text and partial/empty pages as warnings.
- [x] Manually verify fidelity and absence of invented automotive interpretation against representative PDFs; deterministic text checks cannot prove source fidelity.
- [x] Escalate only after a measurable schema or output-quality failure with a recorded reason.
- [x] Cap retries and escalation (two attempts by default, configurable from one to three); optional higher tiers require configuration and a failed earlier attempt.
- [x] Document that completeness cannot be independently proven without a local parser and preserve the original PDF and extraction history for audit.

#### 2.5 Persistence and status orchestration

- [x] Implement the text-extraction service independently from routes and React components.
- [x] Transition `Source` through `uploaded -> extracting_text -> text_extracted` or `failed` with recoverable errors.
- [x] Persist accepted content in `Source.rawText`, `Document.pagesJson`, and `Document.metadataJson`.
- [x] Store the file-transfer method, model route, extraction method, quality result, and reason codes as non-domain metadata.
- [x] Create an `ExtractionJob` for every model attempt and distinguish Phase 2 with a `text-extraction-v1`-style version.
- [x] Keep every retry as a new job and never overwrite an earlier raw or validated output.
- [x] Ensure OpenAI never writes directly to Supabase.
- [x] Make `processSource(sourceId)` idempotent or safe to retry without duplicate `Document` records.
- [x] Recover interrupted attempts after ten minutes and prevent a superseded worker from modifying the new attempt.
- [x] Provide a trusted operator command, `pnpm source:process <source-id>`, before the UI trigger is implemented.

#### 2.6 Cost, privacy, and observability

- [x] Log `sourceId`, `extractionJobId`, processing step, duration, model, version, outcome, escalation reason, and returned token categories without logging document content.
- [x] Keep the OpenAI API key server-only and validate all new environment variables.
- [x] Use temporary private file transfer and delete or expire provider-side files when applicable.
- [x] Never leak service-role credentials or signed document URLs in logs, model output, or client payloads.
- [x] Decide later, from operational needs, whether persistent token-usage columns are necessary; do not block Phase 2 on a cost-dashboard schema.

#### 2.7 Minimal processing UI

- [x] Add a source action or controlled trigger for text extraction.
- [x] Display localized extraction states and retryable errors on the source list or a source detail page.
- [x] Keep routes and components thin and put every new user-facing string in both locale catalogs.
- [x] Do not expose raw document content or technical provider errors unnecessarily.
- [x] Add `/sources/[sourceId]` with a recap built from persisted data after successful extraction: title, author, source date, language, page/character counts, page quality, warnings, and expandable source-language text per page.
- [x] Include processing date, model, and attempt history in the recap, with all interface text supplied by the English and Italian catalogs.
- [x] Read the recap from saved content without an additional AI summarization call; add automotive entities only after Phases 3 and 4.

#### 2.8 Phase 2 verification

- [x] Native, scan-only, and mixed PDFs are each sent directly to OpenAI through the same initial file-input path.
- [x] A native PDF produces ordered, faithful page text without any local PDF-reading dependency.
- [x] A scan-only PDF can return visible text without producing descriptions of photographs or diagrams.
- [x] A mixed PDF preserves page numbers and reports unreadable pages without inventing content.
- [x] Invalid model output is stored, marked safely, and creates no domain record (synthetic integration verification).
- [x] Retrying a failed source preserves the previous attempt and avoids duplicate documents (synthetic integration verification).
- [x] Photos and diagrams remain in the original private PDF and are not separately extracted or interpreted.
- [x] `pnpm lint`, `pnpm i18n:check`, `pnpm typecheck`, and `pnpm build` pass.
- [x] English and Italian processing states, errors, and actions are manually verified.

### Phase 3 — Structured automotive AI

Phase 3 consumes only the validated page-aware text produced by Phase 2. It does not parse PDFs or write normalized domain rows.

#### 3.1 Strict extraction contract

- [x] Implement the strict Zod schema from `docs/EXTRACTION_CONTRACT.md`, including zero or many cases, several vehicles, several repair outcomes, and temporary references.
- [x] Review every output field against `docs/DATA_MODEL.md`; omit database UUIDs, normalized keys, timestamps, lifecycle state, and review state from the model contract.

#### 3.2 Versioned automotive prompt

- [x] Implement the accepted `automotive-structure-v1` behavior from `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md` without reusing it for Phase 2 transcription.
- [x] Version an automotive developer instruction that prioritizes fidelity, uncertainty, traceability, and multiple-case handling.
- [x] Keep stable instructions separate from the validated dynamic page content and treat instructions inside source text as untrusted content.
- [x] Make source content override filenames and Phase 2 document metadata whenever they conflict.
- [x] Require explicit separation of symptoms, causes, components, diagnostic checks, measurements, solutions, procedures, materials, and outcomes.
- [x] Treat the primary DTC and each related DTC distinctly, including relationship type, origin, and inference confidence.
- [x] Keep explicit source facts separate from AI inferences and require valid confidence for an inference.
- [x] Leave unknown scalar values `null`, unknown collections `[]`, `probabilitySource` `null` unless explicitly stated, and `probabilityCalculated` always `null` in the MVP.
- [x] Require temporary entity references and page/excerpt evidence for important facts and inferred relationships.
- [x] Require a non-empty exact excerpt for every evidence item and omit unverifiable evidence rather than inventing it.
- [x] Add `documentAnalysis.uncertainties` and advisory `requiresHumanReview` without making human review a persistence gate.
- [x] Limit generic graph node types to the current database enum and use dedicated references for measurement-to-check, procedure-to-solution, and outcome-to-solution links.
- [x] Preserve measurement conditions and ordered procedure variant wording without silently normalizing ambiguous units or values.
- [x] Validate the prompt input against the Phase 2 page-aware contract and serialize ordered content in a deterministic JSON envelope.

#### 3.3 OpenAI structured-analysis adapter

- [x] Integrate the Responses API with strict Structured Outputs through a replaceable OpenAI adapter.
- [x] Configure the primary structured-analysis model and reasoning effort separately from Phase 2 text-extraction models.
- [x] Supply the generated automotive JSON Schema through Structured Outputs rather than duplicating it in the natural-language prompt.
- [x] Preserve the complete raw provider response through an orchestration callback before status or schema validation.
- [x] Map response identifiers, actual model, reasoning effort, and token usage without exposing the API key or source text in logs.
- [x] Verify request assembly, valid output, schema failure, refusal, incomplete response, and provider failure without a billable OpenAI call.

#### 3.4 Quality gates, audit, and retry safety

- [x] Add bounded schema and semantic quality gates with escalation only when cheaper output fails measurably.
- [x] Preserve immutable raw and validated outputs, model, prompt version, outcome, duration, and token usage.
- [x] On invalid output, create no partial relational graph and make retry create a new job.

#### 3.5 Representative Phase 3 verification

- [x] Verify that Phase 3 ignores visual meaning not represented in the validated text input.
- [x] Manually evaluate the prompt against the representative acceptance scenarios listed in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md` before enabling automatic normalization.
- [x] Verify schema rejection, bounded retry behavior, immutable attempt history, and absence of normalized automotive rows.
- [x] Run `pnpm automotive-schema:verify`, `pnpm automotive-prompt:verify`, `pnpm i18n:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` successfully.

### Phase 4 — Normalization and relational persistence

Phase 4 converts an accepted Phase 3 artifact into the existing relational model. It must not call OpenAI again, depend on a specific prompt shape beyond the validated contract, or require human approval.

#### 4.1 Pure normalization and reference resolution

- [x] Add a pure normalizer that revalidates the Phase 3 boundary and produces database-oriented in-memory records without writing to PostgreSQL.
- [x] Normalize DTC lookup codes conservatively while preserving the original code and description.
- [x] Produce conservative lookup keys for reusable vehicles, symptoms, causes, solutions, and components while preserving source wording.
- [x] Resolve every temporary case/entity/evidence reference to a typed local target before persistence.
- [x] Map extraction enums to database enums and assign `active` plus `unreviewed` application defaults.
- [x] Keep causes, checks, repairs, procedures, and outcomes distinct and preserve all case-specific values.
- [x] Verify multiple cases, DTC roles, normalized keys, reference resolution, missing values, and rejection of invalid input without a database write.

#### 4.2 Atomic relational persistence

- [x] Add a repository that writes all cases and their dependent records in one short transaction.
- [x] Reuse reference entities conservatively with atomic upserts and keep case-specific wording on association records or in the validated artifact.
- [x] Resolve typed local references to database UUIDs for evidence, procedures, measurements, outcomes, and graph relationships.
- [x] Preserve the accepted `ExtractionJob` raw and validated artifacts without overwriting them.
- [x] Roll back the entire graph when any row or reference fails.

#### 4.3 End-to-end processing orchestration

- [x] Connect accepted Phase 3 output to normalization and relational persistence without another AI call.
- [x] Transition the source from `processing` to `persisted` only after the complete transaction succeeds.
- [x] Keep processing idempotent so retry cannot duplicate cases or reference entities.
- [x] Handle a valid zero-case extraction explicitly and preserve its audit result.
- [x] Keep routes and commands thin and reuse the same application service.

#### 4.4 Structured extraction recap

- [x] Extend the source detail page with persisted cases, vehicles, DTCs, symptoms, causes, checks, solutions, outcomes, and evidence.
- [x] Show `unreviewed` status and AI-inference indicators without requiring review.
- [x] Keep original excerpts and technical identifiers untranslated while translating all interface copy through the English and Italian catalogs.
- [x] Preserve mobile usability and avoid exposing raw provider responses or internal errors.

#### 4.5 Phase 4 verification

- [x] Verify multi-case and multi-DTC persistence against Supabase with temporary synthetic records.
- [x] Verify transaction rollback, retry idempotence, zero-case completion, immutable extraction history, and no partial graph.
- [x] Verify every stored case is `active` and `unreviewed` before optional human editing.
- [x] Manually verify the structured recap in English and Italian at desktop and mobile widths.
- [x] Run catalog parity, lint, type checking, all Phase 4 verification commands, and the production build successfully.

### Phase 5 — Optional admin review and editing

Phase 5 adds a small operator-only correction workflow for one persisted case at a time. It must reuse the Phase 4 relational graph, preserve the original extraction audit trail, and avoid drafts, autosave, bulk editing, complex permissions, or editorial version history in the MVP.

#### 5.1 Case review page and read model

- [x] Add a localized `/cases/[caseId]/review` page linked from each case in the existing source recap.
- [x] Load one complete persisted case through a serializable server-side read model, including its source, evidence, relationships, lifecycle status, and review status.
- [x] Keep extracted technical content in the source language while translating only interface copy through the English and Italian catalogs.
- [x] Show explicit-source and AI-inference indicators, confidence where available, and the original evidence needed to review the case.
- [x] Keep the page focused on one case; case browsing, search, filters, and a global review queue remain in Phase 6.

#### 5.2 UI-triggered structured analysis

- [x] Add a localized **Analyze and structure** action to the source detail page when text extraction is complete and no persisted automotive result exists.
- [x] Call the existing idempotent automotive processing orchestration through a thin server endpoint; do not duplicate provider, normalization, or persistence logic in the route or component.
- [x] Show clear pending, success, zero-case, retryable failure, and non-retryable failure states in English and Italian.
- [x] Refresh the source detail after completion so persisted cases and their **Review this case** actions appear without using the terminal.
- [x] Prevent duplicate submissions while processing and preserve all existing raw and validated extraction history.

#### 5.3 Minimal editable case form

- [x] Define one Zod-validated edit contract for useful persisted fields instead of exposing Prisma models to the client.
- [x] Allow editing of case metadata and review notes; vehicle applicability; DTCs and the primary DTC; symptoms; causes; components; diagnostic checks and measurements; solutions, procedures, and outcomes; parts; evidence; and supported relationships.
- [x] Support only the list operations needed by the relational graph: add, edit, remove, and reorder where sequence is meaningful.
- [x] Preserve the distinction between causes, checks, proposed repairs, confirmed repairs, and outcomes.
- [x] Use one explicit Save action. Do not add autosave, drafts, rich-text editing, bulk editing, or a generic schema-driven form builder.

#### 5.4 Transactional save and audit safety

- [x] Implement one application service that validates the complete edit payload and saves the case graph in a single Prisma transaction.
- [x] Update case-owned associations without silently modifying shared reference data used by other cases.
- [x] Use `updatedAt` as a simple optimistic-concurrency check so an older form cannot overwrite a newer edit.
- [x] Mark a changed case as `corrected`, set `reviewedAt`, and store optional review notes; allow an unchanged case to be explicitly marked `reviewed`.
- [x] Keep the originating `Source`, `Document`, and every `ExtractionJob.rawAiOutput` and `validatedOutput` immutable.
- [x] Return localized, actionable validation and stale-edit feedback without exposing database or provider details.

#### 5.5 Lifecycle actions

- [x] Add explicit actions to mark a case as reviewed, rejected, or archived without deleting it.
- [x] Keep lifecycle status separate from review status and require confirmation before rejecting or archiving.
- [x] Keep rejected and archived cases traceable to their source and immutable extraction artifacts.
- [x] Do not add hard deletion, approval chains, assignments, comments, or multi-user roles in the MVP.

#### 5.6 Phase 5 verification

- [x] Verify a complete case can be edited, saved, reloaded, and corrected without changing another case that shares reference data.
- [x] Verify invalid input, stale edits, and forced database failures leave no partial graph.
- [x] Verify reviewed, corrected, rejected, and archived transitions while preserving raw and validated extraction artifacts.
- [x] Manually verify source-language technical content, inference indicators, validation feedback, confirmations, and success states in English and Italian at desktop and mobile widths.
- [x] Run catalog parity, lint, type checking, focused Phase 5 verification commands, Prisma validation, and the production build successfully.

### Phase 6 — Search and browsing

Phase 6 makes the stored knowledge base browsable without implementing the future mechanic chat, embeddings, full-text infrastructure, or a generic admin data grid. Technical content remains in the source language and only interface copy is localized.

#### 6.1 Active case index

- [x] Add a localized `/cases` page and primary-navigation entry.
- [x] List recent active cases through a bounded server-side read model with visible review status, source, DTC, vehicle, and last-update context.
- [x] Link each row to the existing source and review workflows without exposing raw AI output or database implementation details.
- [x] Provide bilingual empty, loading, and error states and preserve mobile usability.

#### 6.2 Simple search and filters

- [x] Search case title and stored applicability by DTC, make, model, engine code, and engine description using validated URL query parameters.
- [x] Add review-status and lifecycle filters while keeping active cases as the default view.
- [x] Keep the query bounded and deterministic; do not add Elasticsearch, embeddings, fuzzy ranking, or full-text infrastructure for the MVP.
- [x] Preserve filters in the URL so results are reloadable and shareable without locale-specific routing.

#### 6.3 Read-only case detail

- [ ] Add `/cases/[caseId]` as the read-only browsing view for the complete diagnostic structure.
- [ ] Show vehicles, DTCs, symptoms, causes, components, checks, measurements, solutions, procedures, outcomes, parts, evidence, and relationships.
- [ ] Keep source-language technical content unchanged and provide explicit links to the source and optional correction page.
- [ ] Keep rejected and archived records reachable only when explicitly selected through lifecycle browsing.

#### 6.4 Phase 6 verification

- [ ] Verify active-default browsing, every supported search field, review and lifecycle filters, deterministic limits, and empty results against isolated Supabase fixtures.
- [ ] Manually verify the list and detail pages in English and Italian at desktop and mobile widths.
- [ ] Verify evidence, relationships, lifecycle state, and review state remain visible without exposing immutable provider artifacts.
- [ ] Run catalog parity, lint, type checking, focused Phase 6 verification commands, Prisma validation, and the production build successfully.

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
| 2026-08-29 | Phase 2.1–2.3 | Added the strict page-aware text contract, versioned transcription-only prompt, server-only Responses API adapter, private Storage eligibility checks, and ten-minute signed-URL PDF transfer. | Catalog parity, lint, types, and build passed; a live three-page private PDF returned validated ordered text with the configured model without persisting extracted content. |
| 2026-09-14 | Phase 2.4–2.5 | Added deterministic quality checks, bounded optional model escalation, raw-response history, source ownership/recovery, atomic text/document persistence, and a trusted processing CLI. Added the persisted-data recap to point 2.7. | Synthetic Supabase integration checks passed for failure/retry, history, concurrency, stale ownership, encoding, and rollback. One real PDF was extracted and persisted; repeating processing returned the same document without another OpenAI call. Static checks and production build passed. Representative scan/mixed-document fidelity checks remain open. |
| 2026-09-14 | Phase 2.6–2.7 | Added centralized content-safe extraction logs, a thin idempotent processing endpoint, source detail reads, bilingual extract/retry controls, and a persisted-data recap with page text, warnings, model, timing, token use, and attempt history. | Verified the real saved extraction in English and Italian, expanded original-language page text, the uploaded-source action, mobile layout without horizontal overflow, clean browser errors, and an idempotent API response without a new model call. Catalog parity, lint, types, and production build passed; representative PDF checks remain in point 2.8. |
| 2026-09-14 | Phase 2.8 | Completed controlled end-to-end verification with native-text, scan-only, mixed-content, visual-only, and unreadable-page PDF fixtures sent through the production upload and extraction paths. | Four real OpenAI calls preserved all unique markers and page order; the unreadable fourth page returned empty text, `unreadable`, and an uncertainty without invention. English/Italian completed, warning, failure, and retry states passed in the browser. No domain cases were created, all five temporary database/Storage fixtures were removed, and static checks passed. |
| 2026-09-17 | Phase 3.1 | Added the strict `automotive-structure-v1` Zod contract, generated JSON Schema, temporary-reference graph, dedicated measurement/procedure/outcome links, evidence and uncertainty structures, and cross-field invariants aligned with the relational model. | The executable schema verifier accepted a complete multi-entity case and rejected invalid origin confidence, duplicate or mistyped references, unsupported evidence targets, missing confirmed outcomes, invalid ranges/counts, and unknown uncertainty cases. Type checking, linting, catalog parity, and production build passed. |
| 2026-09-17 | Phase 3.2 | Added the versioned automotive developer instruction and deterministic, validated input envelope for persisted page-aware text and non-authoritative metadata. Reorganized Phase 3 into contract, prompt, provider, quality/audit, and representative-verification steps. | The prompt verifier passed instruction/source isolation, required semantic rules, metadata authority, page ordering, and incomplete-page rejection. Schema verification, catalog parity, type checking, linting, and the Next.js Webpack production build passed; the default Turbopack build was blocked by a Windows worker-process permission error. |
| 2026-09-17 | Phase 3.3 | Added the provider-neutral automotive knowledge extractor contract, OpenAI Responses API adapter, strict Structured Outputs request, local Zod revalidation, raw-response callback, usage mapping, and separate automotive model/reasoning configuration. | Synthetic adapter verification passed request assembly, raw-response capture, valid output, usage, refusal, incomplete response, provider failure, and schema failure without an OpenAI charge. Type checking, linting, catalog parity, and the production build passed. |
| 2026-09-17 | Phase 3.4 | Added deterministic evidence and uncertainty checks, bounded distinct-model escalation, source ownership, immutable per-attempt audit records, safe status transitions, and content-safe logs without adding a new table or domain write. | Synthetic Supabase verification passed semantic failure, one-step escalation, immutable raw and validated history, token/timing capture, idempotency, non-retryable provider failure, cleanup, and zero normalized automotive rows. Static checks and the production build passed. |
| 2026-09-17 | Phase 3.5 | Added a trusted automotive-analysis command and evaluated `automotive-structure-v1` against three compact representative inputs using the configured live model. Completed Phase 3 without enabling UI-triggered analysis or relational normalization. | Live Structured Outputs produced one generic case, two independent cases, and zero cases for visual-only unreadable input. Deterministic checks, synthetic persistence/retry history, read-only Supabase listing, schema, prompt, adapter, catalog parity, lint, types, and the Webpack production build passed. |
| 2026-09-17 | Phase 4.1 | Structured Phase 4 into normalization, atomic persistence, orchestration, recap, and verification steps. Added a pure prompt-independent normalizer with conservative lookup keys, database enum mapping, application-owned defaults, and typed local reference resolution. | The local normalizer verifier passed multiple-case handling, DTC roles, shared and local vehicle keys, source wording preservation, dedicated references, empty output, and invalid-reference/confidence rejection without an AI call or domain write. |
| 2026-09-17 | Phase 4.2 | Added atomic relational persistence for the complete normalized graph, source/document/job ownership checks, conservative reference upserts, typed UUID resolution, duplicate protection, and a unique vehicle lookup key. | The live Supabase verifier persisted two cases with a shared vehicle and complete dependent graph, preserved raw and validated artifacts, resolved cyclic relationship evidence, rejected a duplicate attempt, proved full rollback after a forced constraint failure, and removed its synthetic fixtures. |
| 2026-09-18 | Phase 4.3 | Connected completed Phase 3 artifacts to revalidation, normalization, atomic graph persistence, and the final source transition through one reusable application service. Added idempotent recovery and explicit zero-case completion without placeholder rows. | The live Supabase orchestration verifier completed normal and zero-case sources, preserved immutable job output, retried both without another synthetic model call or duplicate row, and removed all isolated fixtures. Type checking and linting passed. |
| 2026-09-18 | Phase 4.4 | Added the structured automotive recap to source details with cases, applicability, DTCs, symptoms, causes, components, checks, measurements, solutions, procedures, outcomes, parts, and evidence. Kept source-derived technical content untranslated while localizing only interface copy. | A temporary Italian Supabase fixture verified complete relational reads and source-language preservation. English/Italian desktop and 390 px mobile checks passed without horizontal overflow or browser warnings, and the fixture was removed. Type checking, linting, and catalog parity passed. |
| 2026-09-18 | Phase 4.5 | Completed the Phase 4 verification matrix and closed normalization and relational persistence. | Pure normalization, two-case/two-DTC atomic persistence, complete rollback, immutable artifacts, retry idempotence, zero-case completion, initial `active`/`unreviewed` state, source-language recap, bilingual desktop/mobile UI, schema validation, catalog parity, lint, types, and production build passed. Every temporary Supabase fixture was removed and no OpenAI request was made. |
| 2026-09-18 | Phase 5 planning | Split optional admin review into a one-case review page, a minimal explicit form, transactional save safety, lifecycle actions, and focused verification. Explicitly excluded drafts, autosave, bulk editing, hard deletion, approval workflows, roles, and editorial version history from the MVP. | Cross-checked the plan against the existing case graph, review and lifecycle enums, immutable extraction artifacts, Phase 6 search boundary, and bilingual source-language display rules. No code or schema change was made. |
| 2026-09-18 | Phase 5.1 | Added a localized case-review route linked from the source recap and reused the complete Phase 4 presentation model for one selected case. Extended the read model with review metadata and resolved graph relationships without exposing provider output. | An isolated Italian Supabase case opened from its source in English and Italian with unchanged technical wording, visible inference/confidence/evidence/relationship signals, a working back link, and no 390 px horizontal overflow. The fixture was removed. Catalog parity, lint, and type checking passed. |
| 2026-09-18 | Phase 5 planning | Added the missing UI-triggered structured-analysis step before case editing so operators can complete the PDF-to-review workflow without a trusted terminal command. | Cross-checked the new step against the existing idempotent automotive orchestration, immutable extraction history, bilingual UI rules, and Phase 5 review dependency. No runtime code was added. |
| 2026-09-18 | Phase 5.2 | Added a bilingual source-detail action and thin POST route that run the existing idempotent automotive analysis and persistence orchestration, then refresh the persisted recap. | The action rendered on a real text-extracted PDF in English and Italian with no browser warnings. Invalid and missing source requests returned stable 400 and 404 errors without an OpenAI call. Catalog parity, lint, types, Prisma validation, and the production build passed. |
| 2026-09-18 | Phase 5.3 | Added one explicit Zod-backed case correction form for the complete useful relational graph, including stable typed relationship targets and meaningful sequence controls. Kept saving local to the form boundary so transactional persistence remains isolated in Phase 5.4. | Contract verification rejected invalid primary-DTC and relationship references. A temporary Italian Supabase case verified prefilled source-language data, add/edit behavior, explicit validation, English/Italian interface switching, and a clean browser console; the fixture was removed. Catalog parity, lint, types, Prisma validation, and the production build passed. |
| 2026-09-18 | Phase 5.4 | Connected the complete case form to a server-validated application service and atomic Prisma save with `updatedAt` concurrency, shared-reference protection, review audit transitions, and immutable extraction artifacts. | An isolated Supabase verifier saved a complete corrected graph, marked an unchanged case reviewed, rejected stale and unsafe shared-reference edits with rollback, preserved another case and raw/validated artifacts, and removed its fixtures. Catalog parity, schema verification, Prisma validation, lint, types, and production build passed. |
| 2026-09-18 | Phase 5.5 | Added explicit reviewed, rejected, and archived lifecycle commands with optimistic concurrency, separate lifecycle and review state, confirmation before non-active transitions, and no deletion. | Synthetic Supabase cases verified every transition, terminal cross-transition rejection, retained case rows, corrected-status preservation, and unchanged extraction artifacts. English and Italian success and confirmation copy remained in catalog parity. |
| 2026-09-18 | Phase 5.6 | Completed the Phase 5 verification matrix and closed optional admin review and editing. | A complete existing graph was saved and reloaded, shared references remained unchanged, stale and invalid edits were rejected, a forced relational constraint failure rolled back fully, all lifecycle transitions passed, and the guarded browser fixture verified English/Italian source-language behavior at desktop and 390 px widths before cleanup. Focused checks, Prisma validation, catalog parity, lint, types, and production build passed. |
| 2026-09-18 | Phase 6.1 | Structured Phase 6 into an active-case index, simple URL-based search and filters, a read-only detail page, and focused verification. Added `/cases` with a bounded server read model, primary navigation, review status, DTC/vehicle/source context, and links to existing workflows. | A guarded Italian Supabase case appeared beside existing active knowledge, preserved source-language content in English and Italian interfaces, rendered at desktop and 390 px widths, and produced a clean browser console in a fresh tab. The fixture was removed. Catalog parity, lint, types, Prisma validation, and production build passed. |
| 2026-09-18 | Phase 6.2 | Added validated URL-based case search across titles, DTCs, makes, models, engine codes, and engine descriptions, plus review and lifecycle filters. Kept active cases as the default and the repository capped at 50 deterministic results. | Catalog parity, lint, type checking, Prisma validation, production build, and manual English/Italian desktop and mobile browsing passed. Search and filter URLs reloaded with their values preserved, invalid parameters fell back safely, and technical values remained untranslated. |
