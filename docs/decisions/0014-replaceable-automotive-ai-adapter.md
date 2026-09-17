# ADR 0014 — Keep automotive AI extraction behind a replaceable adapter

## Status

Accepted and implemented for Phase 3.3.

## Context

Phase 3 sends persisted, page-aware text to an AI provider and expects the strict automotive extraction contract. The provider request shape, authentication, response envelope, refusal states, token usage, and failure codes are infrastructure concerns. They must not leak into later orchestration, quality gates, normalization, or persistence.

Phase 2 already uses the OpenAI Responses API, but its PDF-input and transcription contract are intentionally different from Phase 3 automotive analysis. Reusing the Phase 2 model settings or extractor would couple two independently auditable stages.

## Decision

- Define a provider-neutral `AutomotiveKnowledgeExtractor` interface and result/error types.
- Implement OpenAI behind `OpenAIAutomotiveKnowledgeExtractor` using the Responses API.
- Send stable instructions and dynamic page-aware input separately.
- Supply the generated automotive JSON Schema through `text.format` with `type = json_schema` and `strict = true`.
- Validate the returned JSON again with the canonical Zod schema, including application cross-field invariants.
- Set `store = false`; the application owns durable audit history.
- Expose a callback that receives the complete raw provider response before provider-status or output-schema validation, so the later orchestration can persist failed attempts.
- Keep automotive model and reasoning configuration separate from Phase 2 text-extraction settings.
- Keep routing, retry, quality-gate, and database behavior outside the adapter; they belong to later Phase 3 steps.

## Consequences

- A different AI provider can implement the same interface without changing normalization or persistence.
- Phase 2 and Phase 3 can change models independently.
- Raw responses, refusals, incomplete responses, provider errors, usage, and invalid schema results have explicit boundaries.
- The adapter can be verified without a billable API call by injecting a synthetic `fetch` implementation.
- A valid provider-level Structured Output is still treated as untrusted until the local Zod contract accepts it.

Official references: [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-6 Astra model capabilities](https://developers.openai.com/api/docs/models/gpt-6-astra).
