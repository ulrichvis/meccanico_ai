# Technical architecture

## Overview

```text
Browser
  │
  ▼
Next.js App Router
  ├── UI / Server Actions / Route Handlers
  └── Application services
        ├── Source ingestion
        ├── Text extraction
        ├── AI extraction
        ├── Validation
        ├── Normalization
        └── Case persistence
              │
              ├── PostgreSQL / Prisma
              ├── Supabase Storage
              └── External AI provider
```

The domain core does not know about React, the PDF format, or the SDK of any specific model.

## Target pipeline

```text
SourceAdapter
  → IngestedSource
  → Private original file
  → AI file-input text extraction
  → PageContent[]
  → KnowledgeExtractor
  → unknown raw output
  → Zod validation
  → ValidatedExtraction
  → Normalizer
  → NormalizedCase[]
  → Transactional persistence as unreviewed records
  → Optional admin review and correction
```

The content and knowledge stages are deliberately separate. Phase 2 sends the original PDF directly to OpenAI and produces faithful, page-aware source text only. Phase 3 consumes that persisted text to extract structured automotive knowledge. A text-extraction model must not diagnose, summarize, normalize, or populate domain entities.

Phase 2 does not add a PDF-reading or local preflight library. Native, scanned, and mixed PDFs use the same original-file input path. The selected model, transfer method, attempt, prompt version, quality result, and escalation reason are traceable. See `docs/TEXT_EXTRACTION.md`.

Phase 3 uses the separately versioned `automotive-structure-v1` prompt specified in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md`. Its `requiresHumanReview` result is an advisory prioritization signal stored with the validated artifact; it never becomes a persistence gate. The normalizer, not the model, assigns database identifiers, normalized labels, lifecycle state, and `reviewStatus = unreviewed`.

Phase 4 starts with a pure normalization boundary. It revalidates the provider-neutral extraction contract, preserves source wording, creates conservative lookup keys, maps application enums, assigns `active` and `unreviewed`, and resolves temporary references to typed local targets. It performs no I/O. This keeps prompt changes, AI calls, and database transactions out of normalization and lets the persistence repository reject a complete graph before opening a transaction.

The Phase 4 persistence repository consumes only normalized data and writes every case from one extraction inside a single Prisma interactive transaction. It locks the source, verifies source/document/job ownership and accepted prompt version, then resolves temporary references to database UUIDs while inserting the complete relational graph. Shared vehicles, DTCs, symptoms, causes, solutions, and components use database-backed unique keys and atomic upserts; case-specific wording remains on associations or in the immutable validated artifact. Evidence is inserted before relationships and patched inside the same transaction when an evidence target is the relationship that also cites it. Any failed insert or unresolved reference rolls back the whole graph.

Phase 4.3 composes the Phase 3 processor with accepted-artifact loading, pure normalization, and graph persistence through one application service. OpenAI remains outside every database transaction. After the graph is complete, the same persistence transaction moves the source from `processing` to `persisted`; a zero-case accepted extraction performs the state transition without creating a placeholder case. Retry first reuses the completed Phase 3 job, then returns the existing case identifiers or the zero-case completion state without another model call or duplicate write. Raw and validated extraction artifacts remain unchanged.

Phase 4.4 reads the persisted relational graph directly on the server and maps database values to a serializable presentation DTO before passing them to the interactive source-detail component. The recap never reads or exposes the raw provider response. English and Italian catalogs translate interface labels, statuses, and empty states only; case wording, technical identifiers, procedures, measurements, and evidence are displayed in the source document language without automatic translation. A persisted zero-case source receives an explicit empty recap instead of an invented case.

Phase 5.1 adds a read-only `/cases/[caseId]/review` route for one persisted case. It resolves the case to its owning source on the server, reuses the established serializable source-detail presentation model, and filters that model to the selected case. The read model now resolves generic relationship endpoints to human-readable labels while retaining their typed identifiers, origin, confidence, and supporting evidence. This avoids a second public data contract before editing exists and keeps search, queues, and filters in Phase 6.

Phase 5.2 exposes the existing automotive processing orchestration through a thin `POST /api/sources/[sourceId]/automotive-analysis` route. The source-detail UI offers the action only after page-aware text exists and no persisted result is present. The route validates the source identifier, maps internal failures to stable transport codes, and delegates OpenAI, retry, audit, normalization, and transactional persistence behavior to the established application service. The client prevents duplicate submissions, displays localized progress and retry feedback, and refreshes the server read model after completion. Provider output and database details remain server-side.

Phase 5.3 maps the server-owned case presentation DTO into one explicit client edit contract validated by Zod. The contract carries stable identifiers for case-owned records and typed relationship endpoints without exposing Prisma models. The form covers metadata, applicability, DTC roles, symptoms, causes, components, checks, measurements, solutions, procedures, outcomes, parts, evidence, and supported relationships; reordering is limited to diagnostic and repair sequences. The form performs complete local validation through one Save action but intentionally performs no database write. Phase 5.4 owns the transactional mutation, shared-reference safeguards, optimistic concurrency, and review audit transition.

Phase 5.4 sends the complete validated edit contract to a thin case endpoint and one application service. The persistence repository checks the submitted `updatedAt`, updates or rebuilds the entire case-owned graph in one Prisma transaction, and rejects stale edits before they can overwrite newer data. Reusable reference rows are resolved by conservative keys; a shared DTC or component is never silently changed when another case uses it. Existing provenance is retained for submitted rows and newly added rows use `human_added`. Technical changes mark the case `corrected`; an unchanged submission explicitly marks an unreviewed case `reviewed`. The source, document, and extraction-job artifacts are not part of the mutation.

Phase 5.5 adds a separate lifecycle command to the same thin case endpoint. A Zod-validated `PATCH` payload carries the case identifier, current `updatedAt`, and one explicit `review`, `reject`, or `archive` action. The repository applies the optimistic-concurrency check in a short transaction. Review updates only the quality signal and preserves `corrected`; reject and archive update only the lifecycle status and are allowed from `active`. The UI requires confirmation before reject or archive. No action deletes the case or changes its source and extraction artifacts.

The target orchestration function is:

```ts
processSource(sourceId: string): Promise<ProcessSourceResult>
```

It must be callable from a route, Server Action, or worker without duplicating business logic.

## Target directory structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── upload/page.tsx
│   ├── sources/page.tsx
│   ├── cases/[caseId]/review/page.tsx
│   ├── cases/page.tsx
│   ├── cases/[id]/page.tsx
│   └── api/
│       └── sources/route.ts
├── components/
│   ├── upload/
│   ├── extraction/
│   └── cases/
├── db/
│   ├── client.ts
│   └── repositories/
├── lib/
│   ├── env.ts
│   ├── errors.ts
│   └── logger.ts
├── i18n/
│   ├── config.ts
│   ├── dictionaries.ts
│   └── translator.ts
├── sources/
│   ├── source.types.ts
│   └── adapters/
│       └── pdf-source.adapter.ts
├── ai/
│   ├── ai-client.ts
│   ├── pdf-text.extractor.ts
│   ├── model-router.ts
│   └── automotive-knowledge.extractor.ts
├── extraction/
│   ├── process-source.ts
│   ├── extraction.types.ts
│   └── normalization/
├── schemas/
│   └── extraction.schema.ts
├── prompts/
│   ├── pdf-text-extraction.prompt.ts
│   └── automotive-extraction.prompt.ts
├── services/
│   ├── source.service.ts
│   ├── extraction.service.ts
│   └── case.service.ts
└── types/

prisma/
├── schema.prisma
└── migrations/

docs/
└── decisions/

messages/
├── en.json
└── it.json
```

This structure is a target, not a requirement to create empty files. Each directory should appear when a feature needs it.

## Layer responsibilities

### UI and transport

- Display data and collect user actions.
- Validate the shape of HTTP inputs.
- Call application services.
- Contain no complex normalization or persistence rules.
- Resolve all user-facing copy through locale keys.

### Application services

- Orchestrate use cases.
- Control status transitions.
- Define transaction boundaries.
- Return domain results or typed errors.

### Adapters

- Convert a source-specific format into a common representation.
- Encapsulate Supabase Storage, the PDF extractor, and the AI provider.
- Allow replacement without changing the domain.

### Domain and normalization

- Represent cases, relationships, origins, and evidence.
- Deduplicate normalized terms without erasing original wording.
- Reject inconsistent states before persistence.

### Persistence

- Encapsulate Prisma in repositories when queries become complex.
- Write a case graph in one transaction.
- Never expose a Prisma model directly as a public API contract.
- Use the pooled PostgreSQL connection for runtime queries and the direct or session connection for migrations.
- Keep Supabase Data API access closed by default: all application tables have row-level security enabled without public policies.

## Primary states

### Source

```text
uploaded → extracting_text → text_extracted → processing
                                      └──────→ failed
processing → persisted
          ├→ schema_invalid
          └→ failed
```

The final processing status belongs to `ExtractionJob`. The source status reflects only overall progress; it does not replace job history or indicate whether a human has reviewed the resulting cases.

### ExtractionJob

```text
pending → running → completed
                  ├→ schema_invalid
                  └→ failed
```

A retry creates a new job. It never overwrites raw output from an earlier attempt.

### Case lifecycle and review

```text
review_status: unreviewed → reviewed
                         └→ corrected

status: active → rejected
              └→ archived
```

Review status is a data-quality signal, not an ingestion gate. Lifecycle status controls whether a case participates in normal retrieval. A case is persisted as soon as machine validation and normalization succeed. Admin review may happen later and must not overwrite the raw or validated extraction.

Lifecycle changes are explicit state transitions rather than case edits. In the MVP, rejected and archived cases remain terminal, traceable records; restore, hard deletion, approval chains, assignments, comments, and role-based workflows remain outside the scope.

## Error handling

- Upload failure: leave no orphaned `Source`, or use the `failed` status if the record already exists.
- Text extraction failure: preserve the file and the job error.
- Invalid AI output: preserve `rawAiOutput`, insert no partial normalized data, and transition to `schema_invalid` or `failed`.
- Transaction failure: roll back the entire relational case write.
- UI messages remain understandable; technical details belong in logs.

## Visual-content boundary

PDFs may contain diagrams and photographs that will be useful to mechanics in a later version. The original private PDF is retained, so those assets are not lost. Phase 2 may transcribe visible text from a scanned page, but it does not extract, describe, classify, or interpret visual content.

A future visual-content adapter may create page-region assets and link them to evidence. It must preserve the original image separately from any AI description and must not be coupled to the PDF format. No visual asset schema is required for the current phase.

## Future conversational read path

```text
Mechanic message
  → conversation context extraction
  → hybrid retrieval over stored cases and evidence
  → quality-aware ranking
  → grounded answer generation
  → citations, uncertainty, and follow-up questions
```

The chat layer is a read and reasoning interface over the knowledge base. It must not silently modify cases. Reviewed and corrected records should rank above unreviewed records when relevance is otherwise comparable, and every answer must retain traceability to supporting evidence. The detailed target is documented in `docs/FUTURE_ASSISTANT.md`.

## Frontend internationalization

English is the official language of development. The frontend supports English (`en`) and Italian (`it`) from Phase 1.

```text
Incoming request
  → check saved language preference
  → if absent, match supported browser language
  → fall back to English
  → load the matching message catalog
```

Routes are language-neutral: `/`, `/upload`, and `/cases`. Changing the language updates displayed text without changing or duplicating the current URL. The language selector stores the user's explicit choice locally.

Translation catalogs live in `messages/en.json` and `messages/it.json`. Both files must expose identical keys. Components receive translated strings through the i18n adapter and never import a catalog directly. API payloads and domain enums remain language-neutral; the frontend translates their display labels.

The localization boundary includes navigation, buttons, forms, validation feedback, empty states, status labels, notifications, accessibility labels, metadata, dates, numbers, and user-visible errors. Logs, database values, internal errors, code, and technical documentation remain in English.

See `docs/I18N.md` for conventions and `docs/decisions/0003-english-development-bilingual-frontend.md` for the decision record.

## Security and privacy

- Validate MIME type, file extension, and a configurable maximum size.
- Use a private bucket with short-lived signed URLs.
- Generate storage paths on the server; never trust the submitted filename.
- Keep secrets exclusively in server-side environment variables.
- Do not log complete document content or API keys.
- Protect mutations and downloads before enabling multi-user access.

## Planned environment variables

```dotenv
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DOCUMENTS_BUCKET=technical-sources
MAX_UPLOAD_SIZE_MB=20
MAX_UPLOAD_FILES_PER_BATCH=20
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.6-luna
OPENAI_EXTRACTION_MODEL_ESCALATION=
OPENAI_EXTRACTION_MODEL_EXCEPTIONAL=
OPENAI_EXTRACTION_MAX_ATTEMPTS=2
OPENAI_AUTOMOTIVE_MODEL=
OPENAI_AUTOMOTIVE_MODEL_ESCALATION=
OPENAI_AUTOMOTIVE_MODEL_EXCEPTIONAL=
OPENAI_AUTOMOTIVE_MAX_ATTEMPTS=2
OPENAI_AUTOMOTIVE_REASONING_EFFORT=medium
```

OpenAI credentials and the Phase 2 primary model are mandatory only when PDF text extraction runs. Optional Phase 2 higher tiers are selected only after schema/output-quality failure, within a one-to-three attempt cap (two by default). Phase 3 has the same bounded, separately configured routing shape: only a distinct higher model may follow a measurable schema or semantic failure. Provider request failures and refusals are not automatically retried. Its provider-neutral contract lives in `src/ai/automotive-knowledge-extractor.ts`, while the OpenAI Responses implementation lives in `src/ai/openai-automotive-knowledge-extractor.ts`. Model identifiers must not be scattered through application code.

Phase 3 orchestration reuses `ExtractionJob` rather than adding a stage-specific audit table. A short transaction locks the source and creates one running job; the OpenAI call runs outside the transaction; later short transactions preserve raw and validated artifacts and finish the attempt. Every escalation creates a new job. Accepted structured output leaves the source in `processing` until Phase 4 atomically normalizes it; no `Case` or related domain row is written in Phase 3. `requiresHumanReview` remains advisory: the quality gate checks that the flag truthfully reflects partial or unreadable input, but no human action is required before persistence.

The Phase 3 provider call happens after Phase 2 has persisted page-aware text. Both `pnpm automotive:process <source-id>` and the source-detail **Analyze and structure** action run the same complete knowledge-processing path: it performs structured analysis only when no accepted job exists, normalizes the accepted artifact, persists the graph, and advances the source atomically.

The implemented Phase 2 entry point is `src/services/process-source.server.ts`; its framework-independent pipeline and repository live in `src/extraction/`. The trusted operator CLI and the source-detail API route use the same processor. Short source-row locks serialize acquisition and writes while OpenAI runs outside database transactions. A successful final transaction stores the text/document and completes the job atomically. See [ADR 0012](decisions/0012-text-extraction-persistence-and-retries.md) for retry, ownership, and audit semantics.

`/sources/[sourceId]` is the operator boundary for starting or retrying extraction and reading its result. Its server repository returns only persisted, presentation-safe fields: document metadata, page-aware source text, deterministic warnings, model and prompt version, timing, safe attempt status/error categories, and token usage. Raw provider responses, signed Storage URLs, storage paths, credentials, and internal error details stay server-side. No AI call is made to generate the recap. See [ADR 0013](decisions/0013-safe-extraction-operations-and-recap.md).

## Minimum observability

Each processing run must be traceable with:

- `sourceId`;
- `extractionJobId`;
- current step;
- duration of each step;
- prompt version and model name;
- PDF transfer method, quality-gate result, and escalation reason;
- token usage when a model reports it;
- structured errors without sensitive data.
