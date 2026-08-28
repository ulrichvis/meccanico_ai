# Development instructions — Meccanico IA

This file is intended for development assistants and automated contributors working in this repository.

## Primary language

English is the primary language for this project. Use English for:

- documentation and architecture decisions;
- source code, identifiers, comments, and commit messages;
- logs, internal error codes, task plans, progress logs, and handoff notes.

The frontend is bilingual from the beginning. Every user-facing string, including labels, validation feedback, empty states, notifications, and user-visible error messages, must use translation keys backed by:

- `messages/en.json` for English, the default locale;
- `messages/it.json` for Italian.

Do not hard-code English or Italian copy in components, routes, actions, or services. Keep both catalogs in key parity and follow `docs/I18N.md`.

Source documents may be written in any language. Preserve their original wording in evidence excerpts, and add a translation only when the product explicitly requires one.

## Before changing code

Read at minimum:

1. `README.md`;
2. `docs/ARCHITECTURE.md`;
3. `docs/DATA_MODEL.md`;
4. `docs/TASKS.md`.

For any AI extraction work, also read `docs/EXTRACTION_CONTRACT.md`.

## Business constraints

- The domain is source-agnostic. Do not create entities such as `PdfCase`, `PdfFault`, `PdfVehicle`, or `PdfSolution`.
- Source adapters produce a common content representation before domain analysis.
- Information explicitly stated in the source and an AI inference are different categories.
- A missing value remains `null` or `[]`. Never fill it using general knowledge.
- `probabilitySource` comes only from a frequency explicitly stated by the source.
- `probabilityCalculated` remains `null` in the MVP.
- A cause is not a solution, a test is not a repair, and a proposed repair is not a confirmed repair.
- A document may contain several cases, and a case may contain several DTCs.
- Evidence and excerpts must remain traceable to the original page whenever that page is known.
- Structurally valid normalized data is persisted immediately with an `unreviewed` status.
- Human review is optional and must never be a persistence prerequisite.
- Admin edits must preserve the raw and validated extraction so changes remain traceable.

## Architecture constraints

- Keep routes and UI components thin.
- Put business orchestration in services and pipeline steps.
- Validate every external boundary with Zod.
- Use transactions for normalization and relational persistence.
- Preserve raw AI output even when validation fails.
- Do not make the relational schema depend on the exact shape of a prompt or a specific AI provider.
- Keep Supabase, PDF, and AI integrations behind replaceable interfaces.

## MVP scope

Implement only the active phase in `docs/TASKS.md`. The future mechanic assistant described in `docs/FUTURE_ASSISTANT.md` is an architectural destination, not authorization to implement RAG, embeddings, vectorization, chat, advanced statistics, billing, or complex multi-user permissions during the PDF-first phases.

Unit tests are deferred by product decision. Type checking, linting, builds, and the manual checks listed in the backlog are still required.

## Expected quality

- Strict TypeScript with no unjustified `any`.
- English names, comments, technical documentation, logs, and internal errors.
- English and Italian user-facing copy supplied exclusively through locale catalogs.
- Short functions with one clear responsibility.
- No business logic hidden in React components.
- Structured errors and logs without sensitive technical content.
- No keys, private URLs, or secrets committed to Git.

## Task completion

At the end of a phase:

- update the checkboxes in `docs/TASKS.md`;
- document every structural decision in `docs/decisions/`;
- list created and modified files;
- report the commands that were run and their results;
- provide a manual verification procedure;
- identify the next step without starting it when it is outside the current scope.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
