# Phase 2 verification report

## Status

Phase 2 is complete and verified as of 2026-09-14. Phase 3 has not started.

## Scope

The verification exercised the production upload, private Supabase Storage, signed-URL transfer, OpenAI Responses API adapter, structured-output validation, deterministic quality gate, transactional persistence, source detail repository, and bilingual UI. It did not create automotive cases or introduce a PDF-reading dependency into the application.

Controlled PDFs were generated only as temporary test inputs. Local PDF tooling was used outside the product to establish fixture ground truth and visually inspect rendered pages. Each fixture was then uploaded through `POST /api/sources` and processed through the same `processSource(sourceId)` path used by operators.

## Controlled PDF results

| Fixture | Input composition | Persisted result | Outcome |
|---|---|---|---|
| Native text | Two native-text pages with unique markers | 2 ordered readable pages, 439 characters | Faithful markers, values, and wording preserved |
| Scan-only | Two raster-only pages without a text layer | 2 ordered readable pages, 390 characters | Visible text recovered without visual descriptions |
| Mixed | Native page, raster page, and native page with a visual-only diagram | 3 ordered readable pages, 489 characters | Native and scanned text preserved; shapes were not described |
| Mixed with unreadable page | The mixed fixture plus a fully opaque fourth page | 4 ordered pages; page 4 empty and `unreadable` | `PAGE_UNREADABLE` warning and explicit uncertainty persisted without invented content |

All four extractions completed on the primary configured model with prompt `text-extraction-v1.1`. They used 23,121 total reported tokens. No automatic escalation was required.

## Persistence and safety results

- Every accepted result created one Document and one completed ExtractionJob.
- Page-aware text, quality results, routing metadata, and provider-reported usage were persisted.
- Zero Case records and zero source-evidence records were created for the verification sources.
- The visual-only diagram remained solely in the original PDF and was not extracted as an asset or interpreted in page text.
- The recap read persisted data and did not issue another AI request.
- A controlled failed source displayed only the mapped safe provider message and a retry action.
- English and Italian completed, unreadable-page warning, failed, and retry states rendered without browser errors.
- Five temporary source rows, four documents, five jobs, and five private Storage objects were deleted after verification. No user-uploaded source was changed or removed.

## Existing automated evidence

`pnpm extraction:verify` previously covered invalid JSON/schema, empty content, unsafe PostgreSQL text encoding, refusal, bounded escalation, later retry, simultaneous processing, stale ownership, raw-response preservation, and transactional rollback. Those checks use simulated provider responses but the real persistence adapter, and clean up their own records.

The final static checks are:

```bash
pnpm i18n:check
pnpm typecheck
pnpm lint
pnpm build
```

All passed. The catalogs contained 184 matching English and Italian keys, and the production build included the dynamic source detail and extraction API routes.

## Known boundary

The controlled fixtures prove the selected markers, page ordering, unreadable-page behavior, and non-interpretation instruction for these examples. They do not prove perfect OCR or semantic fidelity for every future PDF. The original private PDF, raw response, model, prompt version, quality result, and attempt history therefore remain the audit trail for later review or re-extraction.
