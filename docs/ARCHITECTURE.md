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
  → ContentExtractor
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
│   ├── extractions/[id]/review/page.tsx
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
├── pdf/
│   └── pdf-text.extractor.ts
├── ai/
│   ├── ai-client.ts
│   └── automotive-knowledge.extractor.ts
├── extraction/
│   ├── process-source.ts
│   ├── extraction.types.ts
│   └── normalization/
├── schemas/
│   └── extraction.schema.ts
├── prompts/
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

## Error handling

- Upload failure: leave no orphaned `Source`, or use the `failed` status if the record already exists.
- Text extraction failure: preserve the file and the job error.
- Invalid AI output: preserve `rawAiOutput`, insert no partial normalized data, and transition to `schema_invalid` or `failed`.
- Transaction failure: roll back the entire relational case write.
- UI messages remain understandable; technical details belong in logs.

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
MAX_UPLOAD_SIZE_MB=25
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=
```

OpenAI variables become mandatory only in Phase 3.

## Minimum observability

Each processing run must be traceable with:

- `sourceId`;
- `extractionJobId`;
- current step;
- duration of each step;
- prompt version and model name;
- structured errors without sensitive data.
