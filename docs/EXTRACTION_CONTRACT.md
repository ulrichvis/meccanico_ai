# AI extraction contract

This document describes the target domain contract. It will be implemented as strict Zod schemas during Phase 3.

## Output rules

- The root always contains `source` and `cases`.
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
  cases: ExtractedCase[];
};

type ExtractedCase = {
  caseType: string | null;
  title: string | null;
  vehicle: Vehicle | null;
  primaryDtc: DtcReference | null;
  relatedDtcs: RelatedDtc[];
  complaint: string | null;
  symptoms: ExtractedEntity[];
  problemDescription: string | null;
  causes: ProbabilisticEntity[];
  components: ExtractedEntity[];
  diagnosticChecks: DiagnosticCheck[];
  solutions: ProbabilisticEntity[];
  repairProcedure: ProcedureStep[];
  measurements: Measurement[];
  partsMaterials: PartMaterial[];
  repairOutcome: RepairOutcome | null;
  evidence: Evidence[];
  relationships: ExtractedRelationship[];
};
```

Internal identifiers in the response are temporary references used to connect elements before database insertion.

## Common types

```ts
type RelationOrigin =
  | "explicit_source"
  | "ai_inference";

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
  targetRef: string | null;
  pageNumber: number | null;
  excerpt: string | null;
  evidenceType:
    | "theoretical_possible_solution"
    | "manufacturer_documentation"
    | "technical_bulletin"
    | "workshop_report"
    | "real_case"
    | "confirmed_repair"
    | "multiple_confirmed_cases"
    | "unclear";
};
```

## Invariants validated by Zod and the domain

Zod validates shape. The normalizer validates these cross-field rules:

- zero or one primary DTC per case;
- every `fromRef`, `toRef`, and `targetRef` points to an existing item in the same case;
- every inference has a confidence value;
- confidence is between 0 and 1;
- `pageNumber` is positive when present;
- `yearFrom <= yearTo` when both values exist;
- `minValue <= maxValue` when both values exist;
- a coherent confirmed solution must be connected to a repair outcome;
- `successfulCaseCount <= caseCount` when both values exist;
- no probability absent from the source text is synthesized.

## Minimal example

```json
{
  "source": {
    "title": null,
    "author": null,
    "sourceDate": null,
    "language": "it"
  },
  "cases": [
    {
      "caseType": "diagnostic_case",
      "title": "Insufficient boost pressure",
      "vehicle": {
        "brand": "VAG",
        "model": null,
        "generation": null,
        "yearFrom": 2012,
        "yearTo": 2019,
        "engineDescription": "1.2 - 1.4 FSI/TFSI EA211",
        "engineCode": null,
        "fuelType": null,
        "power": null,
        "transmission": null
      },
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
      "repairProcedure": [],
      "measurements": [],
      "partsMaterials": [],
      "repairOutcome": null,
      "evidence": [],
      "relationships": []
    }
  ]
}
```

## Reference system prompt

The prompt implemented in code must have a version identifier and communicate at least these rules:

> You are an automotive technical knowledge extraction engine. Analyze the source and reconstruct its diagnostic structure. Extract only information supported by the source. Never complete missing vehicle data from general automotive knowledge. Distinguish explicit facts from AI inference. Do not treat all DTC codes as equivalent. Keep symptoms, causes, components, diagnostic checks, measurements, repairs and outcomes separate. A proposed repair is not a confirmed repair. If no probability is explicitly provided, set `probabilitySource` to null. Preserve uncertainty and trace important information to the source.

This text is a functional baseline. The structured schema, examples, and page segmentation instructions must be added to the final prompt and versioned.

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
