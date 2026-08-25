# Product vision

## Problem

Automotive diagnostic information lives in heterogeneous, loosely structured documents. These documents often mix symptoms, fault codes, hypotheses, checks, measurements, repairs, and real outcomes. Flat extraction destroys the relationships that give this information meaning.

Meccanico IA transforms these sources into traceable, connected technical cases that progressively form an automotive knowledge base. That knowledge base will later power a conversational diagnostic assistant for mechanics.

## Two product layers

### 1. Knowledge acquisition and management

Ingest source material, extract its diagnostic structure, validate its machine-readable shape, normalize it, and store it. PDF is the first source; other channels will follow.

Human review is optional and asynchronous. A structurally valid extraction is stored immediately as `unreviewed`. An administrator may later inspect, correct, mark as reviewed, reject, or archive it.

### 2. Mechanic-facing conversational assistant

Provide a chat experience in which mechanics describe real diagnostic situations in natural language. The assistant retrieves relevant stored cases and evidence, asks useful follow-up questions, and produces grounded diagnostic guidance. This layer is planned after the ingestion foundation, not during the initial PDF phases.

## MVP users

### Knowledge operator

Imports documents and monitors extraction. The operator may optionally review, correct, reject, or archive stored cases from the admin platform.

### Technician or workshop manager

Initially searches stored cases by DTC, make, model, or engine. In the later product, talks to the assistant, which retrieves relevant knowledge and explains the diagnostic logic and available evidence.

## Value proposition

- Reduce manual data entry.
- Preserve the source's technical reasoning.
- Make information auditable through source evidence.
- Separate facts, hypotheses, and confirmed outcomes.
- Build a sound foundation for future statistics and a RAG system.
- Give mechanics conversational access to accumulated technical knowledge.

## Primary journey

1. The operator opens `/en/upload` or `/it/upload` and uploads a PDF.
2. The file is stored, and a `Source` is created with the `uploaded` status.
3. Text is extracted page by page.
4. The AI identifies and structures one or more cases.
5. Raw output is preserved, then validated and normalized.
6. Every structurally valid normalized case is stored with `reviewStatus = "unreviewed"`.
7. The case becomes available in the admin knowledge base without waiting for human review.
8. At any later time, an operator may open `/{locale}/extractions/[id]/review` or the localized case editor.
9. The operator may edit, mark as reviewed, reject, or archive the case.

The localized route is `/{locale}/upload`, where the initial supported locales are `en` and `it`. English is the default. On a first visit, the frontend selects a supported locale from the browser preference when possible; the user can always override it with the language selector.

## Product languages

- English and Italian are supported from the first frontend release.
- Every visible string comes from a locale catalog rather than component code.
- English is the canonical fallback when an Italian translation is unavailable during development; production checks must prevent missing translations.
- The selected interface locale is independent from the language of an uploaded source document.
- Original source excerpts remain in their original language for traceability.

## Domain objects

A technical case may contain:

- one or more compatible vehicles;
- one primary DTC and several related DTCs;
- a complaint and symptoms;
- possible causes;
- involved components;
- diagnostic checks and measurements;
- solutions and a repair procedure;
- parts or consumables;
- a repair outcome;
- relationships and evidence connecting these elements.

## MVP success criteria

- A valid PDF can be uploaded and retrieved without loss.
- Extracted text retains at least its page number.
- An invalid extraction does not insert a partial domain graph.
- A valid extraction is persisted without requiring human approval.
- Every stored case clearly exposes its review status.
- Every displayed inference is identifiable as such and includes its confidence level.
- An operator can correct a case from the admin platform without modifying the database directly.
- An active case can be found by DTC or vehicle.

## Initial out of scope

- Full industrial OCR or vision;
- WhatsApp or email integrations;
- statistical probability calculation;
- embeddings, a vector database, RAG, and the final chatbot;
- advanced multi-organization permissions;
- billing and advanced analytics;
- unit tests during the first phases.

## Vocabulary

| Term | Meaning |
|---|---|
| Source | A raw imported item: PDF today, other channels later. |
| Document | Metadata and the logical representation of documentary content. |
| Case | A coherent automotive technical problem described by a source. |
| Explicit fact | Information directly supported by source content. |
| Inference | An interpretation proposed by the AI from context. |
| Evidence | A page, excerpt, or other anchor linking data to its source. |
| Raw extraction | The model's complete, non-normalized response. |
| Unreviewed data | Structurally valid normalized information stored automatically before human review. |
| Reviewed data | Information inspected by a human without necessarily requiring changes. |
| Corrected data | Information modified by a human while retaining traceability to the extraction. |
