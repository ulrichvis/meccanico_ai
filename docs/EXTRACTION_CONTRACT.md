# AI extraction contract

This document describes the target domain contract for Phase 3 structured automotive analysis. It does not govern Phase 2 text extraction, which is documented in `docs/TEXT_EXTRACTION.md`.

The accepted prompt behavior and database-specific adaptations are defined in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md` under prompt version `automotive-structure-v1`.

## Input boundary

Phase 3 receives validated, page-aware text already stored by Phase 2. The knowledge model is not responsible for OCR, PDF parsing, image extraction, or rewriting the source. Its input includes the original filename as metadata and ordered `{ pageNumber, text }` content so evidence remains traceable.

Photographs and diagrams are not interpreted in the first implementation. The original PDF remains available for a future multimodal phase, but Phase 3 must not infer knowledge from visual content that was not represented in its validated input.

## Output rules

- The root always contains `source` and `cases`.
- The root also contains `documentAnalysis` for uncertainties and the non-blocking review recommendation.
- A document may produce zero, one, or several cases.
- An unknown scalar field is `null`.
- A collection with no items is `[]`.
- No domain field may be completed using general knowledge.
- An inference uses `relationOrigin: "ai_inference"` and a `confidence` between 0 and 1.
- An explicit fact uses `relationOrigin: "explicit_source"`; its confidence must not simulate a statistical probability.
- Important items include page or excerpt evidence whenever possible.
- `probabilitySource` remains `null` unless the source itself provides a frequency.
- `probabilityCalculated` always remains `null` during the MVP.
- A contract-compliant output is normalized and persisted automatically with `reviewStatus: "unreviewed"`.
- Human review is optional and occurs after persistence.

## Simplified target shape

```ts
type Extraction = {
  source: {
    title: string | null;
    author: string | null;
    sourceDate: string | null;
    language: string | null;
  };
  documentAnalysis: {
    uncertainties: Uncertainty[];
    requiresHumanReview: boolean;
  };
  cases: ExtractedCase[];
};

type ExtractedCase = {
  ref: string;
  caseType: string | null;
  title: string | null;
  vehicles: VehicleApplicability[];
  primaryDtc: DtcReference | null;
  relatedDtcs: RelatedDtc[];
  complaint: string | null;
  symptoms: ExtractedEntity[];
  problemDescription: string | null;
  causes: ProbabilisticEntity[];
  components: ExtractedEntity[];
  diagnosticChecks: DiagnosticCheck[];
  solutions: ProbabilisticEntity[];
  repairProcedures: ProcedureStep[];
  measurements: Measurement[];
  partsMaterials: PartMaterial[];
  repairOutcomes: RepairOutcome[];
  evidence: Evidence[];
  relationships: ExtractedRelationship[];
};
```

Internal identifiers in the response are temporary references used to connect elements before database insertion.

The response must not contain database UUIDs, normalized database keys, timestamps, source status, case lifecycle status, or review status. Those values belong to the application and normalizer, not the model.

## Common types

```ts
type RelationOrigin =
  | "explicit_source"
  | "ai_inference";

type Uncertainty = {
  caseRef: string | null;
  pageNumber: number | null;
  description: string;
};

type DtcRelationshipType =
  | "primary"
  | "possible_cause"
  | "consequence"
  | "associated_fault"
  | "alternative_fault"
  | "same_system"
  | "secondary_code"
  | "unclear";

type Evidence = {
  ref: string;
  targetRef: string | null;
  pageNumber: number | null;
  excerpt: string;
  evidenceType:
    | "theoretical_possible_solution"
    | "manufacturer_documentation"
    | "technical_bulletin"
    | "workshop_report"
    | "real_case"
    | "confirmed_repair"
    | "multiple_confirmed_cases"
    | "unclear";
  relationOrigin: RelationOrigin;
  confidence: number | null;
};
```

## Invariants validated by Zod and the domain

Zod validates shape. The normalizer validates these cross-field rules:

- zero or one primary DTC per case;
- every `fromRef`, `toRef`, and `targetRef` points to an existing item in the same case;
- every non-null uncertainty `caseRef` points to an extracted case;
- every inference has a confidence value;
- every explicit fact has `confidence = null`;
- confidence is between 0 and 1;
- `pageNumber` is positive when present;
- `yearFrom <= yearTo` when both values exist;
- `minValue <= maxValue` when both values exist;
- a coherent confirmed solution must be connected to a repair outcome;
- `successfulCaseCount <= caseCount` when both values exist;
- no probability absent from the source text is synthesized;
- every evidence item has a non-empty exact excerpt; evidence without a verifiable excerpt is omitted;
- `requiresHumanReview` is advisory and never blocks persistence of an otherwise valid extraction;
- generic relationship node types are limited to those supported by the database; measurements, procedures, outcomes, vehicles, components, and evidence use their dedicated references where applicable.

## Minimal example

```json
{
  "source": {
    "title": null,
    "author": null,
    "sourceDate": null,
    "language": "it"
  },
  "documentAnalysis": {
    "uncertainties": [],
    "requiresHumanReview": false
  },
  "cases": [
    {
      "ref": "case-1",
      "caseType": "diagnostic_case",
      "title": "Insufficient boost pressure",
      "vehicles": [
        {
          "brand": "VAG",
          "model": null,
          "generation": null,
          "yearFrom": 2012,
          "yearTo": 2019,
          "engineDescription": "1.2 - 1.4 FSI/TFSI EA211",
          "engineCode": null,
          "fuelType": null,
          "power": null,
          "transmission": null,
          "compatibilityNote": null,
          "relationOrigin": "explicit_source",
          "confidence": null
        }
      ],
      "primaryDtc": {
        "ref": "dtc-1",
        "code": "P029900",
        "description": null,
        "relationOrigin": "explicit_source",
        "confidence": null
      },
      "relatedDtcs": [
        {
          "ref": "dtc-2",
          "code": "P256200",
          "description": null,
          "relationshipType": "associated_fault",
          "relationOrigin": "ai_inference",
          "confidence": 0.86
        }
      ],
      "complaint": null,
      "symptoms": [],
      "problemDescription": null,
      "causes": [
        {
          "ref": "cause-1",
          "name": "Stuck wastegate",
          "description": null,
          "probabilitySource": null,
          "probabilityCalculated": null,
          "relationOrigin": "explicit_source",
          "confidence": null
        }
      ],
      "components": [],
      "diagnosticChecks": [],
      "solutions": [],
      "repairProcedures": [],
      "measurements": [],
      "partsMaterials": [],
      "repairOutcomes": [],
      "evidence": [],
      "relationships": []
    }
  ]
}
```

## Reference system prompt

The prompt implemented in code must have a version identifier and communicate at least these rules:

> You are an automotive technical knowledge extraction engine. Analyze the source and reconstruct its diagnostic structure. Extract only information supported by the source. Never complete missing vehicle data from general automotive knowledge. Distinguish explicit facts from AI inference. Do not treat all DTC codes as equivalent. Keep symptoms, causes, components, diagnostic checks, measurements, repairs and outcomes separate. A proposed repair is not a confirmed repair. If no probability is explicitly provided, set `probabilitySource` to null. Preserve uncertainty and trace important information to the source.

This text is a compact functional baseline. The complete behavioral specification in `docs/AUTOMOTIVE_EXTRACTION_PROMPT.md`, the structured schema, examples, and page segmentation instructions must be assembled into the final versioned prompt.

The prompt and JSON Schema must be reviewed against `docs/DATA_MODEL.md` before implementation. It must expose enough temporary references to map evidence and relationships, while avoiding fields that the application can determine safely, such as normalized labels, database identifiers, timestamps, and `reviewStatus = "unreviewed"`.

Model routing for structured analysis is independent from Phase 2 text extraction. Model names, reasoning effort, retry limits, and escalation rules are centralized. Start with the primary configured model, then escalate only after a measurable schema or semantic quality failure. Never call every model tier automatically.

## Failure behavior

- Preserve the response in `extraction_jobs.raw_ai_output`.
- Do not persist a partial relational graph.
- Record validation errors in an actionable form.
- Use `schema_invalid` when the response cannot safely be normalized; otherwise use `failed` for processing or infrastructure failures.
- A retry creates a new job and preserves history.

## Machine validation versus human review

Machine validation and human review serve different purposes:

- Machine validation is mandatory. It verifies the contract shape, references, invariants, and transaction safety before relational persistence.
- Human review is optional. It improves, corrects, rejects, or annotates data already stored as `unreviewed`.

This distinction allows continuous ingestion without treating unchecked AI output as equivalent to human-reviewed knowledge.
