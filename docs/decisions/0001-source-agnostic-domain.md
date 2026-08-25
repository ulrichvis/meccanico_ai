# ADR 0001 — Domain independent of source format

- Status: accepted
- Date: 2026-08-25

## Context

The first flow imports PDFs, but automotive knowledge will later come from WhatsApp messages, emails, workshop notes, audio transcripts, and diagnostic reports. A model built around PDF would force every new channel to recreate the concepts of vehicle, DTC, cause, and solution.

In addition, the response shape of an AI model will evolve with prompts, providers, and structured-output capabilities. The database must not become dependent on one particular version of that JSON.

## Decision

The system is divided into three layers:

```text
Original source
  → raw, versioned extraction
  → normalized domain data stored as unreviewed
  → optional human review and correction
```

Each source type has an adapter that produces a common content representation. The automotive pipeline consumes that representation and produces the same extraction contract regardless of the source.

Domain entities use channel-independent names: `Case`, `Vehicle`, `Dtc`, `Symptom`, `Cause`, `Solution`, `DiagnosticCheck`, `Relationship`, and `Evidence`.

The model's raw response and validated response are preserved in JSONB, while important information is stored in a stable relational model.

## Positive consequences

- Adding a source does not require duplicating the domain.
- Changing the prompt or AI provider does not require redesigning the database.
- Outputs can be replayed, compared, and audited.
- Human review operates later on one common domain format.
- Future search, statistics, and conversational retrieval use stored data with explicit quality signals.

## Costs and trade-offs

- An explicit normalization step is required.
- Persisting a relational graph is more complex than storing one JSON column.
- Polymorphic references in `relationships` require application-level validation.
- Preserving both raw and normalized data consumes more storage.

These costs are accepted because they prevent structural coupling that would become expensive as soon as a second source or a new AI model version is introduced.

## Rules resulting from the decision

- Domain entities prefixed with `Pdf` are prohibited.
- Source adapters do not write domain cases directly; validated normalization owns persistence.
- Raw AI output never constitutes domain truth by itself.
- Missing data is not completed automatically.
- Explicit facts and inferences remain distinguishable through the UI.
- Re-extraction creates a new attempt and never overwrites history.
