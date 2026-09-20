# Roadmap

The roadmap progresses through vertical slices. A phase must work end to end before the next one is added.

## Phase 1 — Foundation and PDF upload

### Deliverables

- Next.js TypeScript project with App Router and Tailwind.
- Language-neutral routing with English and Italian message catalogs.
- Automatic supported-locale detection and a persistent language selector.
- Strict environment-variable validation.
- Configured PostgreSQL/Supabase and Prisma.
- Initial relational schema and migration.
- Private Storage bucket for documents.
- Mobile-first `/upload` screen with drag and drop.
- Server-side PDF validation.
- File storage and `Source` creation.
- Minimal dashboard listing recent imports and their status.

### Expected outcome

A valid PDF can be uploaded, stored, and represented in the database without an AI call. The dashboard and upload flow work in both English and Italian without hard-coded user-facing copy.

## Phase 2 — Source text extraction

Status: complete and verified. See [Phase 2 verification report](PHASE_2_VERIFICATION.md).

### Deliverables

- Direct server-side transfer of the original private PDF to OpenAI.
- OpenAI text extraction through PDF file input without a local PDF-reading library.
- Persistence of `{ page, text }` and document metadata.
- Strict validation and quality gates for the common content contract.
- `ExtractionJob` history for every model attempt.
- Cost-aware routing, bounded escalation, and token observability.
- One file-input path for native, scanned, and mixed PDFs.
- Preservation of the original PDF for future visual extraction.

### Expected outcome

An uploaded PDF is sent directly to OpenAI and produces faithful, source-language, page-aware text without creating automotive cases. Invalid output can use bounded retry or escalation. Failures preserve the original file and remain recoverable.

## Phase 3 — Structured AI extraction

### Deliverables

- Strict, versioned Zod schema.
- Versioned automotive prompt.
- OpenAI adapter using structured outputs.
- Preservation of `rawAiOutput` and `validatedOutput`.
- Invalid-output and retry handling.
- Explicit distinction between facts and inferences.
- Model routing that is separate from the Phase 2 text-extraction policy.
- Database-aligned handling of multiple vehicles, multiple outcomes, uncertainty, evidence excerpts, and dedicated relationship references.
- Advisory `requiresHumanReview` signaling that never blocks valid persistence.

### Expected outcome

A text document produces zero, one, or several contract-compliant extraction objects without partial relational persistence.

## Phase 4 — Normalization and persistence

### Deliverables

- DTC and domain-label normalization.
- Transactional creation of the relational graph.
- Conservative reference-data deduplication.
- Validation of references between entities.
- Preservation of evidence and original wording.
- Automatic assignment of `reviewStatus = unreviewed`.

### Expected outcome

A machine-validated extraction automatically becomes a coherent active case in the database. Human review is not required.

## Phase 5 — Optional admin review and editing

Status: complete.

### Deliverables

- A focused `/cases/[caseId]/review` page linked from the existing source recap.
- One complete case read model with source evidence, inference indicators, confidence, lifecycle status, and review status.
- A bilingual source-detail action that runs the existing structured automotive analysis and reveals persisted cases without requiring a terminal command.
- One explicit, Zod-validated form for useful case fields and relationships, with add, edit, remove, and meaningful reordering only.
- One transactional application service with a simple `updatedAt` concurrency check.
- Explicit reviewed, rejected, and archived actions; changed data becomes corrected automatically.
- Preservation of the source, document, raw AI output, and validated extraction after every edit.
- English and Italian interface copy while technical data remains in the source document language.

The MVP does not include autosave, drafts, bulk editing, hard deletion, approval chains, assignments, comments, multi-user roles, a generic form engine, or editorial version history. Search, filters, and the global case list remain in Phase 6.

### Expected outcome

An operator can run structured analysis, inspect the resulting cases, and safely correct one stored case at a time without using the terminal, blocking ingestion, or altering the immutable extraction audit trail.

## Phase 6 — Case browsing

Status: active. The bounded case index plus URL-based search and status filters are complete; the read-only complete case page is next.

### Deliverables

- `/cases` list showing active cases with their review status.
- Simple search by DTC, make, model, and engine.
- `/cases/[id]` page showing the diagnostic structure.
- Presentation of evidence, procedures, and outcomes.
- Filters for review and lifecycle status in the admin interface.

### Expected outcome

The stored knowledge base becomes usable without direct table access while preserving visible quality signals.

## Post-MVP — Conversational assistant for mechanics

After ingestion and knowledge management are reliable, build a mechanic-facing chat interface in deliberate stages:

1. retrieve relevant cases by vehicle, engine, DTC, symptoms, measurements, and repair history;
2. rank results using relevance, evidence quality, repair confirmation, and review status;
3. generate grounded answers with supporting case references;
4. ask follow-up questions when diagnostic context is missing;
5. maintain conversation context across a diagnostic session;
6. evaluate answer quality and unsupported-claim rates before wider release.

The assistant must prefer reviewed or corrected records when relevance is comparable, clearly represent uncertainty, and avoid presenting unsupported conclusions as facts. See `docs/FUTURE_ASSISTANT.md`.

The chat interface and generated responses must support English and Italian. Conversation language follows the user's explicit selection, with English as the fallback.

## Other post-MVP capabilities

The exact order will be decided from actual usage:

- extraction and evidence linking for diagrams and photographs;
- additional source adapters;
- editorial versioning of cases;
- statistics based on confirmed repairs;
- embeddings and hybrid search;
- workshop and organization permissions;
- continuous extraction-quality evaluation.

## Explicitly deferred items

- the `probabilityCalculated` algorithm;
- production use of the `probabilityStats` aggregate table;
- WhatsApp, email, and audio;
- the final chatbot;
- billing;
- advanced analytics;
- a complete unit-test suite.
