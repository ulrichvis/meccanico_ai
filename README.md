# Meccanico IA

Meccanico IA is an automotive technical knowledge extraction and structuring system. Its first input channel is PDF, but the business domain remains source-independent so that emails, WhatsApp messages, workshop notes, audio transcripts, and diagnostic reports can be integrated later.

## MVP objective

Enable an operator to:

1. upload a technical PDF;
2. track its processing status;
3. automatically store structurally valid extracted cases in the database;
4. optionally review and correct those cases from an admin interface;
5. search stored cases by DTC, vehicle, or engine.

The operator does not fill in a form from scratch. The AI prepares and stores a structured case. Human review improves data quality but does not block persistence.

## Core principle

```text
ORIGINAL SOURCE
      ↓
EXTRACTED CONTENT
      ↓
RAW AI EXTRACTION
      ↓
NORMALIZATION
      ↓
STORED DOMAIN DATA — UNREVIEWED
      ↓
OPTIONAL HUMAN REVIEW / CORRECTION
      ↓
REVIEWED OR CORRECTED DOMAIN DATA
```

These layers remain separate. JSON produced by an AI model is an exchange and audit format, not the database domain model. Machine validation of the extraction contract is required before relational persistence; human review is optional and may happen later.

## Long-term product

The stored knowledge base will become the retrieval layer for a mechanic-facing conversational assistant. A mechanic will describe a vehicle, DTCs, symptoms, measurements, or attempted repairs in natural language. The assistant will retrieve relevant cases and evidence, ask for missing diagnostic context, and answer conversationally without presenting unsupported claims as facts.

The current implementation remains PDF-first. The chat, RAG, embeddings, and additional source channels will be developed only after the ingestion and knowledge-management foundation is reliable. See [Future mechanic assistant](docs/FUTURE_ASSISTANT.md).

## Target stack

- Next.js with App Router
- TypeScript in strict mode
- PostgreSQL
- Supabase for PostgreSQL and file storage
- Prisma as the ORM
- Zod for input and structured-output validation
- Tailwind CSS for the user interface
- Locale-based frontend with English and Italian message catalogs
- OpenAI Responses API for Phase 2 text extraction and Phase 3 automotive structuring

## Documentation

- [Product vision](docs/PRODUCT.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [AI extraction contract](docs/EXTRACTION_CONTRACT.md)
- [Automotive extraction prompt specification](docs/AUTOMOTIVE_EXTRACTION_PROMPT.md)
- [Phase 2 text extraction plan](docs/TEXT_EXTRACTION.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Frontend internationalization](docs/I18N.md)
- [Roadmap](docs/ROADMAP.md)
- [Development backlog](docs/TASKS.md)
- [Future mechanic assistant](docs/FUTURE_ASSISTANT.md)
- [Source-agnostic architecture decision](docs/decisions/0001-source-agnostic-domain.md)
- [Non-blocking human review decision](docs/decisions/0002-non-blocking-human-review.md)
- [English development and bilingual frontend decision](docs/decisions/0003-english-development-bilingual-frontend.md)
- [Private Supabase Storage decision](docs/decisions/0005-private-supabase-storage.md)
- [Idempotent PDF upload decision](docs/decisions/0006-idempotent-pdf-upload.md)
- [Limited-concurrency PDF batches decision](docs/decisions/0007-limited-concurrency-pdf-batches.md)
- [Recent sources dashboard decision](docs/decisions/0008-recent-sources-dashboard.md)
- [Separate text and knowledge extraction decision](docs/decisions/0009-separate-text-recovery-from-knowledge-extraction.md)
- [Database-aligned automotive prompt decision](docs/decisions/0010-database-aligned-automotive-prompt.md)

## Current status

Phase 1 implementation is complete and its remaining manual exit checks are tracked in the backlog. Phase 2 has been specified but not implemented: the original private PDF will be sent directly to OpenAI without a local PDF-reading library, and OpenAI will return faithful text only. The supplied automotive diagnostic prompt has been accepted and database-aligned as the separate Phase 3 baseline.

## Run locally

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`. Use the language selector to switch all displayed text between English and Italian without changing the route.

Database credentials are intentionally absent from the repository. Copy `.env.example` to `.env.local`, add the two Supabase PostgreSQL connection strings, and follow the [database setup procedure](docs/DEVELOPMENT.md#supabase-database-setup).

## Non-negotiable rules

- Never invent information that is absent from the source.
- Distinguish explicit facts from AI inferences.
- Never assign an arbitrary probability to a cause or solution.
- Do not treat every DTC in a document as equivalent.
- Preserve evidence that traces information back to its source.
- Never couple domain entities to the PDF format.
- Persist a complete case in an atomic transaction.
- Do not make human review a prerequisite for storing a structurally valid extraction.
- Preserve review status so future retrieval can account for data quality.
- Use English as the official development language for documentation, code, identifiers, comments, logs, and future development tasks.
- Never hard-code user-facing text. The frontend must use locale files and support English and Italian from Phase 1.
