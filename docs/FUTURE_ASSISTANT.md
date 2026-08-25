# Future mechanic-facing assistant

## Purpose

The long-term product is a conversational assistant optimized for automotive mechanics. It will turn the knowledge accumulated by the ingestion platform into practical, evidence-backed diagnostic guidance.

This assistant is not part of the current PDF-first implementation. The ingestion, normalization, persistence, admin editing, and retrieval foundations must be reliable before conversational generation is introduced.

## User experience

A mechanic will be able to describe a situation naturally, including any known context:

- make, model, generation, year, and engine;
- primary and simultaneous DTCs;
- customer complaint and observed symptoms;
- conditions under which the fault occurs;
- measurements and diagnostic-check results;
- parts or repairs already attempted;
- whether previous actions changed the symptoms.

The assistant should respond as a diagnostic partner. It should:

- identify missing information and ask focused follow-up questions;
- retrieve technically similar cases from the knowledge base;
- distinguish symptoms, possible causes, checks, repairs, and confirmed outcomes;
- propose checks before replacement when the evidence supports that order;
- explain why a case or procedure is relevant;
- cite supporting cases and source evidence;
- communicate uncertainty and conflicting evidence;
- state when the knowledge base does not support a reliable answer.

The mechanic can use the assistant in English or Italian. The selected product locale controls interface copy and the response language, while cited source excerpts remain in their original language for traceability. Technical identifiers such as DTC codes must never be translated.

## Knowledge source

The assistant reads normalized cases and their relationships, measurements, evidence, and repair outcomes. Raw AI extraction remains available for audits and debugging, but it is not the primary retrieval corpus.

Human review is optional, so retrieval must account for quality metadata:

1. corrected or reviewed cases with confirmed repair outcomes;
2. reviewed cases with strong documentary evidence;
3. unreviewed cases with explicit source evidence;
4. inferred or weakly supported information.

This ordering is a ranking principle, not an absolute filter. Relevance, evidence quality, sample size, repair confirmation, and review status must remain separate signals.

Rejected and archived cases are excluded from normal retrieval.

## Target conversation flow

```text
Mechanic question
  ↓
Extract vehicle and diagnostic context
  ↓
Identify missing high-value information
  ↓
Retrieve relevant cases and evidence
  ↓
Rank by technical similarity and data quality
  ↓
Generate a grounded response
  ↓
Cite evidence, expose uncertainty, ask the next useful question
```

## Retrieval dimensions

Retrieval may eventually combine:

- vehicle make, model, generation, and year;
- engine description and engine code;
- primary and simultaneous DTCs;
- symptoms and operating conditions;
- mileage when available;
- diagnostic checks and measured values;
- possible causes and involved components;
- repairs attempted and their outcomes;
- source evidence type, inference confidence, and review status.

The future implementation may use structured SQL filters, full-text search, embeddings, and reranking. The exact approach must be chosen after real ingestion data is available.

## Answer safety and trust

The assistant must never convert database presence into certainty. A proposed cause remains a possible cause unless supported by checks or outcomes. A proposed repair remains unconfirmed unless the stored evidence says otherwise.

Every response should make clear:

- which information comes from stored evidence;
- which conclusion is an interpretation;
- how strong or weak the support is;
- what additional check would reduce uncertainty;
- when professional judgment or manufacturer documentation is still required.

The assistant must not silently write generated conclusions back into the knowledge base. Any future learning or feedback flow must pass through an explicit ingestion or admin-review path.

## Delivery stages

1. Reliable PDF ingestion and automatic unreviewed persistence.
2. Optional admin review, correction, rejection, and archiving.
3. Searchable case browser and retrieval evaluation dataset.
4. Evidence-backed retrieval API.
5. Internal conversational prototype.
6. Groundedness and diagnostic-usefulness evaluation.
7. Controlled release to mechanics.
8. Additional source channels and continuous improvement.

## Explicitly not part of the current phase

- chat UI;
- embeddings or vector storage;
- RAG orchestration;
- automatic probability calculation;
- conversational memory;
- production mechanic accounts;
- automated learning from conversations.
