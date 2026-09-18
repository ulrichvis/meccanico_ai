import assert from "node:assert/strict";

import {
  normalizeAutomotiveExtraction,
  normalizeDtcCode,
  normalizeEntityName,
} from "../src/normalization/automotive-normalizer";

const explicitOrigin = {
  relationOrigin: "explicit_source",
  confidence: null,
} as const;

const extraction = {
  source: {
    title: "Synthetic normalization input",
    author: null,
    sourceDate: null,
    language: "en",
  },
  documentAnalysis: {
    uncertainties: [
      {
        caseRef: "case-1",
        pageNumber: 2,
        description: "The exact vehicle variant is unclear.",
      },
    ],
    requiresHumanReview: true,
  },
  cases: [
    {
      ref: "case-1",
      caseType: "diagnostic_case",
      title: "Low boost",
      vehicles: [
        {
          ref: "vehicle-1",
          brand: "VAG",
          model: null,
          generation: null,
          yearFrom: null,
          yearTo: null,
          engineDescription: "EA211 1.4 TSI",
          engineCode: null,
          fuelType: "petrol",
          power: null,
          transmission: null,
          compatibilityNote: null,
          ...explicitOrigin,
        },
      ],
      primaryDtc: {
        ref: "dtc-1",
        code: "p 0299",
        description: "Boost pressure too low",
        ...explicitOrigin,
      },
      relatedDtcs: [
        {
          ref: "dtc-2",
          code: "P2563-00",
          description: null,
          relationshipType: "associated_fault",
          ...explicitOrigin,
        },
      ],
      complaint: "Low power",
      symptoms: [
        {
          ref: "symptom-1",
          name: "Low   power",
          description: "Power drops under load.",
          ...explicitOrigin,
        },
      ],
      problemDescription: null,
      causes: [
        {
          ref: "cause-1",
          name: "Stiff wastegate linkage",
          description: null,
          probabilitySource: "frequently",
          probabilityCalculated: null,
          relationOrigin: "ai_inference",
          confidence: 0.8,
        },
      ],
      components: [
        {
          ref: "component-1",
          name: "Wastegate actuator",
          componentType: "actuator",
          role: "controls boost",
          ...explicitOrigin,
        },
      ],
      diagnosticChecks: [
        {
          ref: "check-1",
          description: "Command actuator travel.",
          expectedResult: "Smooth movement",
          actualResult: "Binding",
          interpretation: null,
          sequenceOrder: 1,
          ...explicitOrigin,
        },
      ],
      solutions: [
        {
          ref: "solution-1",
          name: "Clean linkage",
          description: null,
          probabilitySource: null,
          probabilityCalculated: null,
          repairConfirmed: true,
          repairSuccessful: true,
          ...explicitOrigin,
        },
      ],
      repairProcedures: [
        {
          ref: "procedure-1",
          solutionRef: "solution-1",
          sequenceOrder: 1,
          instruction: "Clean and lubricate the linkage.",
          ...explicitOrigin,
        },
      ],
      measurements: [
        {
          ref: "measurement-1",
          diagnosticCheckRef: "check-1",
          parameter: "Actuator command",
          valueText: "90 %",
          numericValue: 90,
          unit: "%",
          conditions: "Engine idling",
          minValue: null,
          maxValue: null,
          ...explicitOrigin,
        },
      ],
      partsMaterials: [
        {
          ref: "material-1",
          name: "High-temperature lubricant",
          partNumber: null,
          manufacturer: null,
          notes: null,
          ...explicitOrigin,
        },
      ],
      repairOutcomes: [
        {
          ref: "outcome-1",
          solutionRef: "solution-1",
          attempted: true,
          successful: true,
          confirmed: true,
          caseCount: 1,
          successfulCaseCount: 1,
          notes: "Boost restored.",
        },
      ],
      evidence: [
        {
          ref: "evidence-1",
          targetRef: "cause-1",
          pageNumber: 1,
          excerpt: "wastegate linkage",
          evidenceType: "workshop_report",
          ...explicitOrigin,
        },
      ],
      relationships: [
        {
          ref: "relationship-1",
          fromType: "symptom",
          fromRef: "symptom-1",
          relationshipType: "indicates",
          toType: "cause",
          toRef: "cause-1",
          evidenceRef: "evidence-1",
          relationOrigin: "ai_inference",
          confidence: 0.75,
        },
      ],
    },
    {
      ref: "case-2",
      caseType: null,
      title: null,
      vehicles: [
        {
          ref: "vehicle-2",
          brand: "vag",
          model: null,
          generation: null,
          yearFrom: null,
          yearTo: null,
          engineDescription: "EA211  1.4 TSI",
          engineCode: null,
          fuelType: "PETROL",
          power: null,
          transmission: null,
          compatibilityNote: null,
          ...explicitOrigin,
        },
        {
          ref: "vehicle-unknown",
          brand: null,
          model: null,
          generation: null,
          yearFrom: null,
          yearTo: null,
          engineDescription: null,
          engineCode: null,
          fuelType: null,
          power: null,
          transmission: null,
          compatibilityNote: "Vehicle not identified",
          ...explicitOrigin,
        },
      ],
      primaryDtc: null,
      relatedDtcs: [],
      complaint: null,
      symptoms: [],
      problemDescription: null,
      causes: [],
      components: [],
      diagnosticChecks: [],
      solutions: [],
      repairProcedures: [],
      measurements: [],
      partsMaterials: [],
      repairOutcomes: [],
      evidence: [],
      relationships: [],
    },
  ],
};

assert.equal(normalizeDtcCode(" p 0299 "), "P0299");
assert.equal(normalizeEntityName(" Low   POWER "), "low power");

const normalized = normalizeAutomotiveExtraction(extraction);
assert.equal(normalized.cases.length, 2);
const first = normalized.cases[0]!;
const second = normalized.cases[1]!;

assert.equal(first.status, "ACTIVE");
assert.equal(first.reviewStatus, "UNREVIEWED");
assert.equal(first.dtcs[0]?.code, "p 0299");
assert.equal(first.dtcs[0]?.normalizedCode, "P0299");
assert.equal(first.dtcs[0]?.relationshipType, "PRIMARY");
assert.equal(first.dtcs[1]?.relationshipType, "ASSOCIATED_FAULT");
assert.equal(first.symptoms[0]?.name, "Low   power");
assert.equal(first.symptoms[0]?.normalizedName, "low power");
assert.equal(first.causes[0]?.relationOrigin, "AI_INFERENCE");
assert.equal(first.causes[0]?.probabilityCalculated, null);
assert.equal(first.measurements[0]?.diagnosticCheck?.ref, "check-1");
assert.equal(first.repairProcedures[0]?.solution?.ref, "solution-1");
assert.equal(first.repairOutcomes[0]?.solution?.ref, "solution-1");
assert.equal(first.evidence[0]?.target?.ref, "cause-1");
assert.equal(first.evidence[0]?.evidenceType, "WORKSHOP_REPORT");
assert.equal(first.relationships[0]?.from.type, "symptom");
assert.equal(first.relationships[0]?.to.type, "cause");
assert.equal(first.relationships[0]?.evidence?.type, "evidence");
assert.equal(first.vehicles[0]?.lookupKey, second.vehicles[0]?.lookupKey);
assert(second.vehicles[1]?.lookupKey.startsWith("local:case-2:"));
assert(first.references.some((reference) => reference.type === "relationship"));

const empty = normalizeAutomotiveExtraction({
  source: { title: null, author: null, sourceDate: null, language: null },
  documentAnalysis: { uncertainties: [], requiresHumanReview: false },
  cases: [],
});
assert.deepEqual(empty.cases, []);

const invalidReference = structuredClone(extraction);
invalidReference.cases[0]!.relationships[0]!.toRef = "missing-cause";
assert.throws(() => normalizeAutomotiveExtraction(invalidReference));

const invalidConfidence = structuredClone(extraction) as unknown as {
  cases: Array<{ symptoms: Array<{ confidence: number | null }> }>;
};
invalidConfidence.cases[0]!.symptoms[0]!.confidence = 0.5;
assert.throws(() => normalizeAutomotiveExtraction(invalidConfidence));

console.info(
  "Automotive normalization, conservative keys, enum mapping, defaults, and typed reference resolution passed without database access.",
);
