# ADR 0002 — Human review does not block persistence

- Status: accepted
- Date: 2026-08-25

## Context

The ingestion system must build the knowledge base continuously without requiring an operator to approve every extraction. Operators still need an admin platform where they can inspect and correct extracted cases when useful.

Treating human approval as a mandatory persistence gate would slow ingestion and incorrectly combine two separate concerns: structural validity and editorial quality.

## Decision

Machine validation is mandatory before normalized relational data is stored. Human review is optional and happens after persistence.

A successful extraction follows this sequence:

```text
Raw AI output
  → schema and domain validation
  → normalization
  → atomic persistence as active + unreviewed
  → optional admin review or correction
```

An operator may later mark a case as reviewed, correct its normalized data, reject it, or archive it. These actions never overwrite the raw or validated extraction artifacts.

## Consequences

- Ingestion can continue without an editorial bottleneck.
- The database may contain both reviewed and unreviewed cases.
- Every consumer must respect lifecycle and review status.
- Future retrieval should use review status as one quality signal among evidence strength, inference confidence, and confirmed outcomes.
- Rejected and archived cases are excluded from normal retrieval.
- Admin corrections require traceability; actor-level audit history can be added when authentication is introduced.

## Failure boundary

Optional human review does not mean invalid model output is persisted relationally. Output that fails schema or domain validation remains available as raw extraction data, but it does not create a partial case graph.

