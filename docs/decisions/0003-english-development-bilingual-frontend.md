# ADR 0003 — English development and bilingual frontend

- Status: accepted
- Date: 2026-08-25

## Context

Meccanico IA is intended to become a commercial product. Its technical foundation must remain accessible to an international development team, while the initial product must serve both English- and Italian-speaking users.

Hard-coded UI copy would make future translation expensive and inconsistent. Development language and product display language are separate concerns.

## Decision

English is the official language for code, identifiers, comments, technical documentation, architecture decisions, logs, internal error codes, task plans, and handoffs.

The frontend supports English and Italian from Phase 1. Every user-facing string is resolved from maintained locale catalogs:

```text
messages/en.json
messages/it.json
```

English is the default locale and fallback. Routes remain language-neutral. On the first visit, the application may select a supported browser language automatically. A manual language selector changes displayed text without navigation, and its explicit choice is persisted locally.

UI localization uses deterministic catalogs, not runtime machine translation. Both catalogs must maintain key and interpolation parity.

## Consequences

- Phase 1 includes localization infrastructure and bilingual acceptance checks.
- Components and services cannot contain hard-coded display sentences.
- Internal error codes remain stable while the frontend localizes their messages.
- API contracts, enums, and database values remain language-neutral.
- Uploaded sources and evidence preserve their original language independently from the UI locale.
- Every future frontend feature must be verified in English and Italian.
- Additional locales can be added by introducing a catalog and enabling the locale in configuration.
