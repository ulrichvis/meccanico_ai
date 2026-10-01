# Product vision

## Problem

Automotive diagnostic information lives in heterogeneous, loosely structured documents. These documents often mix symptoms, fault codes, hypotheses, checks, measurements, repairs, and real outcomes. Flat extraction destroys the relationships that give this information meaning.

Meccanico IA transforms these sources into traceable, connected technical cases that progressively form an automotive knowledge base. That knowledge base will later power a conversational diagnostic assistant for mechanics.

## Two product layers

### 1. Knowledge acquisition and management

Ingest source material, extract its diagnostic structure, validate its machine-readable shape, normalize it, and store it. PDF is the first source; other channels will follow.

The AI-first MVP stores structurally valid extractions immediately. Operators can browse the results and original sources, but there are no human-review statuses, approval actions, or case-editing forms. Automatic storage does not certify that every model interpretation is correct.

### 2. Mechanic-facing conversational assistant

Provide a chat experience in which mechanics describe real diagnostic situations in natural language. The assistant retrieves relevant stored cases and evidence, asks useful follow-up questions, and produces grounded diagnostic guidance. This layer is planned after the ingestion foundation, not during the initial PDF phases.

## MVP users

### Knowledge operator

Imports documents, starts and monitors extraction, and browses the resulting read-only knowledge base.

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

1. The operator opens `/upload` and uploads a PDF.
2. The file is stored, and a `Source` is created with the `uploaded` status.
3. The original private PDF is sent directly to OpenAI, which returns faithful page-aware text without automotive interpretation.
4. The versioned automotive prompt structures zero, one, or several cases from validated text and reports uncertainties without requesting human approval.
5. Raw output is preserved, then validated and normalized.
6. Every structurally valid normalized case is stored automatically as active.
7. The case becomes available in the read-only knowledge base.

Routes do not contain the locale. English is the default interface language. On a first visit, the frontend selects a supported browser language when possible; the user can always override it with the language selector. Changing language replaces displayed text without changing the current route.

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
- Every case retains traceable source evidence without a human-review status.
- Every displayed inference is identifiable as such and includes its confidence level.
- An operator can inspect the AI result and download its original PDF without an editing workflow.
- An active case can be found by DTC or vehicle.

## Initial out of scope

- extraction or interpretation of diagrams and photographs during the text-only phases;
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
| Page-aware text | Faithful source-language text associated with its original PDF page before automotive analysis. |
