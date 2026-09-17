import {
  automotiveExtractionJsonSchema,
  automotiveExtractionSchema,
  type AutomotiveExtraction,
} from "../src/schemas/automotive-extraction.schema";

const validExtraction: AutomotiveExtraction = {
  source: {
    title: "Insufficient boost pressure",
    author: null,
    sourceDate: null,
    language: "en",
  },
  documentAnalysis: {
    uncertainties: [],
    requiresHumanReview: false,
  },
  cases: [
    {
      ref: "case-1",
      caseType: "diagnostic_case",
      title: "Insufficient boost pressure",
      vehicles: [
        {
          ref: "vehicle-1",
          brand: "Example Motors",
          model: null,
          generation: null,
          yearFrom: 2020,
          yearTo: 2022,
          engineDescription: "2.0 diesel",
          engineCode: null,
          fuelType: "diesel",
          power: null,
          transmission: null,
          compatibilityNote: null,
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      primaryDtc: {
        ref: "dtc-1",
        code: "P0299",
        description: "Boost pressure too low",
        relationOrigin: "explicit_source",
        confidence: null,
      },
      relatedDtcs: [],
      complaint: "Loss of power",
      symptoms: [
        {
          ref: "symptom-1",
          name: "Loss of power",
          description: null,
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      problemDescription: null,
      causes: [
        {
          ref: "cause-1",
          name: "Charge-air leak",
          description: null,
          probabilitySource: null,
          probabilityCalculated: null,
          relationOrigin: "ai_inference",
          confidence: 0.72,
        },
      ],
      components: [],
      diagnosticChecks: [
        {
          ref: "check-1",
          description: "Measure boost pressure",
          expectedResult: null,
          actualResult: "248 kPa",
          interpretation: null,
          sequenceOrder: 1,
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      solutions: [
        {
          ref: "solution-1",
          name: "Replace the damaged hose",
          description: null,
          probabilitySource: null,
          probabilityCalculated: null,
          repairConfirmed: true,
          repairSuccessful: true,
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      repairProcedures: [
        {
          ref: "procedure-1",
          solutionRef: "solution-1",
          sequenceOrder: 1,
          instruction: "Replace the damaged hose.",
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      measurements: [
        {
          ref: "measurement-1",
          diagnosticCheckRef: "check-1",
          parameter: "Boost pressure",
          valueText: "248 kPa",
          numericValue: 248,
          unit: "kPa",
          conditions: "Two-minute idle",
          minValue: null,
          maxValue: null,
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      partsMaterials: [],
      repairOutcomes: [
        {
          ref: "outcome-1",
          solutionRef: "solution-1",
          attempted: true,
          successful: true,
          confirmed: true,
          caseCount: 1,
          successfulCaseCount: 1,
          notes: null,
        },
      ],
      evidence: [
        {
          ref: "evidence-1",
          targetRef: "cause-1",
          pageNumber: 2,
          excerpt: "A leak was found in the charge-air hose.",
          evidenceType: "workshop_report",
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
      relationships: [
        {
          ref: "relationship-1",
          fromType: "cause",
          fromRef: "cause-1",
          relationshipType: "resolved_by",
          toType: "solution",
          toRef: "solution-1",
          evidenceRef: "evidence-1",
          relationOrigin: "explicit_source",
          confidence: null,
        },
      ],
    },
  ],
};

function cloneValidExtraction(): AutomotiveExtraction {
  return structuredClone(validExtraction);
}

function expectInvalid(
  name: string,
  mutate: (input: AutomotiveExtraction) => void,
  expectedMessage: string,
): void {
  const input = cloneValidExtraction();
  mutate(input);
  const result = automotiveExtractionSchema.safeParse(input);

  if (result.success) {
    throw new Error(`${name} unexpectedly passed validation.`);
  }

  if (!result.error.issues.some((issue) => issue.message.includes(expectedMessage))) {
    throw new Error(
      `${name} failed without ${expectedMessage}: ${result.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }
}

automotiveExtractionSchema.parse(validExtraction);

expectInvalid(
  "Explicit confidence",
  (input) => {
    input.cases[0]!.vehicles[0]!.confidence = 0.5;
  },
  "EXPLICIT_FACT_CONFIDENCE_MUST_BE_NULL",
);

expectInvalid(
  "Missing inference confidence",
  (input) => {
    input.cases[0]!.causes[0]!.confidence = null;
  },
  "INFERENCE_CONFIDENCE_REQUIRED",
);

expectInvalid(
  "Duplicate temporary reference",
  (input) => {
    input.cases[0]!.symptoms[0]!.ref = "cause-1";
  },
  "DUPLICATE_TEMPORARY_REFERENCE",
);

expectInvalid(
  "Invalid typed relationship reference",
  (input) => {
    input.cases[0]!.relationships[0]!.fromRef = "solution-1";
  },
  "RELATIONSHIP_FROM_REFERENCE_INVALID",
);

expectInvalid(
  "Invalid evidence target",
  (input) => {
    input.cases[0]!.evidence[0]!.targetRef = "missing-ref";
  },
  "EVIDENCE_TARGET_REFERENCE_INVALID",
);

expectInvalid(
  "Confirmed solution without outcome",
  (input) => {
    input.cases[0]!.repairOutcomes = [];
  },
  "CONFIRMED_SOLUTION_OUTCOME_REQUIRED",
);

expectInvalid(
  "Invalid vehicle range",
  (input) => {
    input.cases[0]!.vehicles[0]!.yearFrom = 2023;
  },
  "VEHICLE_YEAR_RANGE_INVALID",
);

expectInvalid(
  "Invalid outcome counts",
  (input) => {
    input.cases[0]!.repairOutcomes[0]!.successfulCaseCount = 2;
  },
  "SUCCESSFUL_CASE_COUNT_EXCEEDS_CASE_COUNT",
);

expectInvalid(
  "Invalid uncertainty case",
  (input) => {
    input.documentAnalysis.uncertainties.push({
      caseRef: "missing-case",
      pageNumber: 1,
      description: "The case boundary is unclear.",
    });
  },
  "UNCERTAINTY_CASE_REFERENCE_INVALID",
);

const rootSchema = automotiveExtractionJsonSchema as {
  additionalProperties?: boolean;
  required?: string[];
};

if (rootSchema.additionalProperties !== false) {
  throw new Error("The generated root JSON Schema must reject additional properties.");
}

if (!rootSchema.required?.includes("source") || !rootSchema.required.includes("cases")) {
  throw new Error("The generated root JSON Schema is missing required properties.");
}

console.info(
  "Automotive extraction schema accepted the complete example and rejected all invalid boundary cases.",
);
