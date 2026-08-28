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

### Deliverables

- `/extractions/[id]/review` page.
- Document preview and page navigation.
- Editing of vehicles, DTCs, symptoms, causes, checks, solutions, and outcomes.
- Clear display of inferences and confidence values.
- Editing of relationships and the primary DTC.
- Ability to mark a case as reviewed, corrected, rejected, or archived.
- Preservation of raw and validated extraction artifacts after edits.

### Expected outcome

An operator can inspect and improve stored data at any time without blocking ingestion.

## Phase 6 — Case browsing

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
