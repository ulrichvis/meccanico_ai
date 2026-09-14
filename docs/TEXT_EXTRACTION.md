# Phase 2 text extraction plan

## Purpose

Phase 2 sends an uploaded PDF directly to OpenAI and stores faithful, page-aware text that later phases can analyze. It does not parse the PDF locally, create automotive cases, normalize concepts, infer diagnostic relationships, or write to domain tables.

The first input is PDF. The resulting content contract remains source-agnostic so future email, message, transcript, or diagnostic-report adapters can produce the same representation.

## Phase boundary

```text
Private original PDF
  -> server-side file access
  -> OpenAI Responses API PDF input
  -> strict page-aware text output
  -> Zod validation and quality gate
  -> bounded model retry or escalation when required
  -> Source.rawText + Document.pagesJson + Document.metadataJson
```

Phase 2 ends when usable source text and its page references have been stored. Phase 3 starts from that stored representation and produces the automotive knowledge contract described in `docs/EXTRACTION_CONTRACT.md`, using the behavior specified in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md`.

## Common content contract

Validate the model response with Zod before persistence.

```ts
type PageContent = {
  pageNumber: number;
  text: string;
  textQuality: "readable" | "partial" | "unreadable";
  uncertainty: string | null;
};

type ExtractedDocumentContent = {
  title: string | null;
  author: string | null;
  sourceDate: string | null;
  language: string | null;
  pageCount: number;
  pages: PageContent[];
};
```

Missing metadata remains `null`. Text preserves the source language and original wording. Page numbers are one-based, consecutive, and must correspond to the original PDF. Partial and unreadable pages require a short extraction uncertainty. The application derives `Source.rawText` from the validated ordered pages; it does not ask the model to duplicate that content. Transfer and extraction-method metadata are recorded by the application rather than trusted from model output.

## 2.1 Direct PDF input

Do not add a PDF-reading, text-layer, OCR, or local preflight library in Phase 2. The application retrieves the original PDF from the private Supabase Storage bucket on the server and provides it directly as an OpenAI file input.

Local checks remain limited to boundaries that already exist or do not require parsing the PDF:

- source exists and is eligible for processing;
- object exists in the expected private bucket;
- stored MIME type and filename are consistent with the validated upload;
- file remains within the configured size limit;
- file transfer succeeds and contains bytes.

The filename and PDF metadata are untrusted and must not be treated as authoritative automotive information.

## 2.2 OpenAI text-extraction instruction

Every Phase 2 processing run asks OpenAI to return transcription and faithful text reconstruction only. The instruction must explicitly prohibit:

- automotive diagnosis, analysis, or summarization;
- completion from general knowledge;
- conversion into cases, causes, solutions, or relationships;
- descriptions or interpretations of photos and diagrams;
- translation of source wording;
- invented headings, values, page numbers, or missing content.

Text visibly embedded in a scanned page may be transcribed. Non-text visual meaning remains outside Phase 2.

Use the Responses API with PDF file input and a strict JSON Schema equivalent to the common content contract. Validate the response with Zod and preserve the raw output for every attempt. Official reference: [Responses API PDF file input](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create).

## 2.3 Model routing and bounded escalation

Model identifiers are centralized in configuration and recorded on every attempt.

The first route uses the server-only `OPENAI_EXTRACTION_MODEL` setting. Optional `OPENAI_EXTRACTION_MODEL_ESCALATION` and `OPENAI_EXTRACTION_MODEL_EXCEPTIONAL` settings select higher tiers. They have no hard-coded defaults and remain inactive until configured. `OPENAI_EXTRACTION_MAX_ATTEMPTS` defaults to two and accepts one to three. If no next tier is configured, a permitted retry uses the same model. An exceptional tier can only follow a configured escalation tier, within the attempt cap.

Because the application does not inspect PDF content locally, it does not classify a document as `easy`, `medium`, or `hard` before the first request. Routing policy:

1. send the original PDF to the primary configured model;
2. validate its schema and run deterministic checks on the returned structure;
3. retry or escalate only after an objective failure;
4. use the exceptional tier only when an earlier attempt fails and the recorded reason justifies it;
5. cap attempts and never call every tier automatically;
6. preserve every attempt independently.

Objective escalation reasons may include invalid schema, missing pages, empty output for a non-empty file, broken page ordering, a model-reported inability to read important content, or a result that fails the configured text-quality gate.

The implemented automatic retry policy covers invalid/incomplete structured responses and failed text-quality gates. A refusal, HTTP/API failure, network failure, Storage failure, or database failure stops the run; it can be retried explicitly after addressing the cause. Each attempt receives a fresh signed URL. The current prompt version is `text-extraction-v1.1`, which also treats instructions inside the PDF as content rather than executable instructions.

## 2.4 Quality gates

A successful result must satisfy all of the following:

- valid contract shape;
- unique, ordered, positive page numbers;
- `pageCount` consistent with the returned page collection;
- no summaries or automotive entities introduced;
- acceptable non-empty text coverage unless the model explicitly reports unreadable pages;
- valid Unicode without systematic corruption;
- repeated long page content is flagged for inspection; legitimate repeated pages are retained.

The `text-quality-v1` gate rejects completely empty documents, NUL/unpaired-surrogate strings, and systematic replacement-character corruption (at least three replacement characters representing at least 1% of a page). Partial pages, empty individual pages, isolated replacement characters, and normalized identical page text of at least 200 characters produce warnings. They do not require human approval to persist usable text. Original wording is never rewritten by these checks.

The schema prevents automotive fields from being added to the contract, but software cannot distinguish a faithful transcription of diagnostic prose from invented diagnostic prose without source comparison. Fidelity, visual non-interpretation, and the real page count remain representative-document verification requirements, not claims made by the deterministic quality gate.

Without a local PDF parser, the application cannot independently prove that every source character or page was recovered. The original PDF, raw model output, model identity, prompt version, and retry history therefore remain essential audit evidence. Human review remains optional and is not a persistence prerequisite for structurally valid text.

When extraction still fails, keep the original file, store an actionable failure, and allow a later retry. Do not create automotive domain records.

## 2.5 Persistence against the current schema

The existing database supports this implementation without a redesign:

- `sources.status` records `extracting_text`, `text_extracted`, or `failed`;
- `sources.raw_text` stores the complete accepted text when useful;
- `documents.pages_json` stores ordered `{ pageNumber, text }` values;
- `documents.metadata_json` stores the extraction method, model route, quality results, and non-domain metadata;
- `extraction_jobs` records every OpenAI attempt, including model, version, status, raw output, validated output, and errors.

Use a version prefix such as `text-extraction-v1` to distinguish Phase 2 attempts from later `automotive-structure-v1` jobs. Each retry or escalation creates a new `ExtractionJob` and never overwrites earlier artifacts.

The schema has no dedicated token-usage columns. During Phase 2, log model, input/output/cached/reasoning/total tokens when returned, duration, outcome, and escalation reason with `sourceId` and `extractionJobId`. Decide later whether persistent usage columns are justified.

OpenAI never writes directly to Supabase. The application validates the response, then writes through its own repositories and status transitions.

Implemented orchestration uses short transactions and locks the source row before its jobs. Network calls run outside transactions. An active source returns `busy`, an existing document returns `already_processed`, and a failed source can start a new job. A ten-minute stale-attempt window allows a later explicit invocation to recover a crashed worker; the five-minute OpenAI timeout is shorter than that window. Ownership checks prevent stale workers from changing replacement jobs. Existing accepted documents and historical artifacts are not overwritten.

The final transaction inserts the document, stores `Source.rawText`, updates the source to `text_extracted`, and completes the job together. No domain rows are created. `Document.metadataJson.reviewStatus` is `unreviewed`, with no human-review gate. Ambiguous or partial source dates remain verbatim in metadata; only a valid complete `YYYY-MM-DD` date populates `Source.sourceDate`.

Raw responses are saved before status/JSON-schema validation in `rawAiOutput` as `{ format: "response-json-string-v1", responseJson, route, triggerReason }`. `responseJson` is a JSON-encoded string so malformed model text, NUL, and unpaired surrogates remain recoverable in PostgreSQL JSONB; the signed transfer URL is redacted if echoed. `validatedOutput` contains `{ content, quality, usage, responseId }` after schema validation. For unsafe text encoding, the content remains recoverable from the raw artifact and the validated envelope contains quality/usage/response ID only. A transport failure with no response is recorded as a failed job with a null response artifact.

If the database itself is unavailable, the application stops rather than launching another model attempt without audit storage. A running job left by a crash or database outage can be recovered on a later invocation after the stale-attempt window; no process can guarantee writing an in-flight response during a complete database outage.

## 2.6 Images, diagrams, and photographs

OpenAI receives the complete PDF and can transcribe visible text from scanned pages. The Phase 2 prompt must still prohibit descriptions and automotive interpretations of diagrams or photographs.

The original private PDF remains the source of truth and preserves all visual material for later versions. Phase 2 does not crop, classify, embed, or persist images as separate assets.

Future multimodal work should add a replaceable visual-content adapter that can preserve page coordinates, associate assets with evidence, retain the original image separately from its model-generated description, and distinguish observed text from visual interpretation. No image-specific table or Storage layout is added now.

## 2.7 Security and privacy

- Retrieve PDFs only from the private bucket on the server.
- Create a ten-minute Supabase signed URL and pass it as an OpenAI `input_file` URL.
- Never expose service-role credentials or signed URLs to model output, logs, or the browser unnecessarily.
- Do not log full document content.
- Set `store: false`; the selected method creates no persistent OpenAI file, and the Storage URL expires automatically.
- Treat filenames and PDF metadata as untrusted input.

## Phase 2 acceptance criteria

- Every eligible PDF is sent directly to OpenAI without a local PDF-reading library.
- Native, scanned, and mixed PDFs all follow the same initial file-input path.
- OpenAI returns only validated, source-language, page-aware text.
- Invalid output is preserved and can trigger a bounded retry or escalation.
- Failed extraction preserves the original PDF and a retryable history.
- No automotive case or other domain record is created.
- Images and diagrams remain available in the original PDF but are not separately extracted or interpreted.
- Cost and routing decisions are observable without logging sensitive content.
