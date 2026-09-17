import { z } from "zod";

export const AUTOMOTIVE_EXTRACTION_SCHEMA_NAME = "automotive_extraction";
export const AUTOMOTIVE_EXTRACTION_PROMPT_VERSION = "automotive-structure-v1";

const referenceSchema = z.string().trim().min(1).max(120);
const requiredTextSchema = z.string().trim().min(1);
const nullableTextSchema = requiredTextSchema.nullable();
const nullablePositiveIntegerSchema = z.number().int().positive().nullable();
const nullableFiniteNumberSchema = z.number().finite().nullable();

export const relationOriginSchema = z.enum([
  "explicit_source",
  "ai_inference",
]);

export const confidenceSchema = z.number().min(0).max(1).nullable();

function originAwareSchema<const Shape extends z.ZodRawShape>(shape: Shape) {
  return z
    .strictObject({
      ...shape,
      relationOrigin: relationOriginSchema,
      confidence: confidenceSchema,
    })
    .superRefine((value, context) => {
      const origin = value as {
        relationOrigin: z.infer<typeof relationOriginSchema>;
        confidence: z.infer<typeof confidenceSchema>;
      };

      if (origin.relationOrigin === "explicit_source" && origin.confidence !== null) {
        context.addIssue({
          code: "custom",
          message: "EXPLICIT_FACT_CONFIDENCE_MUST_BE_NULL",
          path: ["confidence"],
        });
      }

      if (origin.relationOrigin === "ai_inference" && origin.confidence === null) {
        context.addIssue({
          code: "custom",
          message: "INFERENCE_CONFIDENCE_REQUIRED",
          path: ["confidence"],
        });
      }
    });
}

export const vehicleApplicabilitySchema = originAwareSchema({
  ref: referenceSchema,
  brand: nullableTextSchema,
  model: nullableTextSchema,
  generation: nullableTextSchema,
  yearFrom: nullablePositiveIntegerSchema,
  yearTo: nullablePositiveIntegerSchema,
  engineDescription: nullableTextSchema,
  engineCode: nullableTextSchema,
  fuelType: nullableTextSchema,
  power: nullableTextSchema,
  transmission: nullableTextSchema,
  compatibilityNote: nullableTextSchema,
}).superRefine((vehicle, context) => {
  if (
    vehicle.yearFrom !== null &&
    vehicle.yearTo !== null &&
    vehicle.yearFrom > vehicle.yearTo
  ) {
    context.addIssue({
      code: "custom",
      message: "VEHICLE_YEAR_RANGE_INVALID",
      path: ["yearTo"],
    });
  }
});

const dtcBaseShape = {
  ref: referenceSchema,
  code: requiredTextSchema,
  description: nullableTextSchema,
} satisfies z.ZodRawShape;

export const primaryDtcSchema = originAwareSchema(dtcBaseShape);

export const relatedDtcRelationshipTypeSchema = z.enum([
  "possible_cause",
  "consequence",
  "associated_fault",
  "alternative_fault",
  "same_system",
  "secondary_code",
  "unclear",
]);

export const relatedDtcSchema = originAwareSchema({
  ...dtcBaseShape,
  relationshipType: relatedDtcRelationshipTypeSchema,
});

export const extractedEntitySchema = originAwareSchema({
  ref: referenceSchema,
  name: requiredTextSchema,
  description: nullableTextSchema,
});

export const probabilisticEntitySchema = originAwareSchema({
  ref: referenceSchema,
  name: requiredTextSchema,
  description: nullableTextSchema,
  probabilitySource: nullableTextSchema,
  probabilityCalculated: z.null(),
});

export const solutionSchema = originAwareSchema({
  ref: referenceSchema,
  name: requiredTextSchema,
  description: nullableTextSchema,
  probabilitySource: nullableTextSchema,
  probabilityCalculated: z.null(),
  repairConfirmed: z.boolean().nullable(),
  repairSuccessful: z.boolean().nullable(),
});

export const componentSchema = originAwareSchema({
  ref: referenceSchema,
  name: requiredTextSchema,
  componentType: nullableTextSchema,
  role: nullableTextSchema,
});

export const diagnosticCheckSchema = originAwareSchema({
  ref: referenceSchema,
  description: requiredTextSchema,
  expectedResult: nullableTextSchema,
  actualResult: nullableTextSchema,
  interpretation: nullableTextSchema,
  sequenceOrder: nullablePositiveIntegerSchema,
});

export const measurementSchema = originAwareSchema({
  ref: referenceSchema,
  diagnosticCheckRef: referenceSchema.nullable(),
  parameter: requiredTextSchema,
  valueText: nullableTextSchema,
  numericValue: nullableFiniteNumberSchema,
  unit: nullableTextSchema,
  conditions: nullableTextSchema,
  minValue: nullableFiniteNumberSchema,
  maxValue: nullableFiniteNumberSchema,
}).superRefine((measurement, context) => {
  if (
    measurement.minValue !== null &&
    measurement.maxValue !== null &&
    measurement.minValue > measurement.maxValue
  ) {
    context.addIssue({
      code: "custom",
      message: "MEASUREMENT_RANGE_INVALID",
      path: ["maxValue"],
    });
  }
});

export const repairProcedureSchema = originAwareSchema({
  ref: referenceSchema,
  solutionRef: referenceSchema.nullable(),
  sequenceOrder: z.number().int().positive(),
  instruction: requiredTextSchema,
});

export const partMaterialSchema = originAwareSchema({
  ref: referenceSchema,
  name: requiredTextSchema,
  partNumber: nullableTextSchema,
  manufacturer: nullableTextSchema,
  notes: nullableTextSchema,
});

export const repairOutcomeSchema = z
  .strictObject({
    ref: referenceSchema,
    solutionRef: referenceSchema.nullable(),
    attempted: z.boolean().nullable(),
    successful: z.boolean().nullable(),
    confirmed: z.boolean().nullable(),
    caseCount: nullablePositiveIntegerSchema,
    successfulCaseCount: z.number().int().nonnegative().nullable(),
    notes: nullableTextSchema,
  })
  .superRefine((outcome, context) => {
    if (
      outcome.caseCount !== null &&
      outcome.successfulCaseCount !== null &&
      outcome.successfulCaseCount > outcome.caseCount
    ) {
      context.addIssue({
        code: "custom",
        message: "SUCCESSFUL_CASE_COUNT_EXCEEDS_CASE_COUNT",
        path: ["successfulCaseCount"],
      });
    }
  });

export const evidenceTypeSchema = z.enum([
  "theoretical_possible_solution",
  "manufacturer_documentation",
  "technical_bulletin",
  "workshop_report",
  "real_case",
  "confirmed_repair",
  "multiple_confirmed_cases",
  "unclear",
]);

export const evidenceSchema = originAwareSchema({
  ref: referenceSchema,
  targetRef: referenceSchema.nullable(),
  pageNumber: nullablePositiveIntegerSchema,
  excerpt: requiredTextSchema,
  evidenceType: evidenceTypeSchema,
});

export const relationshipNodeTypeSchema = z.enum([
  "dtc",
  "symptom",
  "cause",
  "diagnostic_check",
  "solution",
  "repair_outcome",
]);

export const extractedRelationshipSchema = originAwareSchema({
  ref: referenceSchema,
  fromType: relationshipNodeTypeSchema,
  fromRef: referenceSchema,
  relationshipType: requiredTextSchema,
  toType: relationshipNodeTypeSchema,
  toRef: referenceSchema,
  evidenceRef: referenceSchema.nullable(),
});

export const uncertaintySchema = z.strictObject({
  caseRef: referenceSchema.nullable(),
  pageNumber: nullablePositiveIntegerSchema,
  description: requiredTextSchema,
});

export const extractedCaseSchema = z
  .strictObject({
    ref: referenceSchema,
    caseType: nullableTextSchema,
    title: nullableTextSchema,
    vehicles: z.array(vehicleApplicabilitySchema),
    primaryDtc: primaryDtcSchema.nullable(),
    relatedDtcs: z.array(relatedDtcSchema),
    complaint: nullableTextSchema,
    symptoms: z.array(extractedEntitySchema),
    problemDescription: nullableTextSchema,
    causes: z.array(probabilisticEntitySchema),
    components: z.array(componentSchema),
    diagnosticChecks: z.array(diagnosticCheckSchema),
    solutions: z.array(solutionSchema),
    repairProcedures: z.array(repairProcedureSchema),
    measurements: z.array(measurementSchema),
    partsMaterials: z.array(partMaterialSchema),
    repairOutcomes: z.array(repairOutcomeSchema),
    evidence: z.array(evidenceSchema),
    relationships: z.array(extractedRelationshipSchema),
  })
  .superRefine((extractedCase, context) => {
    const references = new Map<string, string>();
    const referencesByType: Record<z.infer<typeof relationshipNodeTypeSchema>, Set<string>> = {
      dtc: new Set(),
      symptom: new Set(),
      cause: new Set(),
      diagnostic_check: new Set(),
      solution: new Set(),
      repair_outcome: new Set(),
    };

    function register(ref: string, path: PropertyKey[], type?: keyof typeof referencesByType) {
      const existingPath = references.get(ref);

      if (existingPath) {
        context.addIssue({
          code: "custom",
          message: `DUPLICATE_TEMPORARY_REFERENCE:${existingPath}`,
          path,
        });
        return;
      }

      references.set(ref, path.join("."));
      if (type) referencesByType[type].add(ref);
    }

    register(extractedCase.ref, ["ref"]);
    extractedCase.vehicles.forEach((item, index) => register(item.ref, ["vehicles", index, "ref"]));
    if (extractedCase.primaryDtc) register(extractedCase.primaryDtc.ref, ["primaryDtc", "ref"], "dtc");
    extractedCase.relatedDtcs.forEach((item, index) => register(item.ref, ["relatedDtcs", index, "ref"], "dtc"));
    extractedCase.symptoms.forEach((item, index) => register(item.ref, ["symptoms", index, "ref"], "symptom"));
    extractedCase.causes.forEach((item, index) => register(item.ref, ["causes", index, "ref"], "cause"));
    extractedCase.components.forEach((item, index) => register(item.ref, ["components", index, "ref"]));
    extractedCase.diagnosticChecks.forEach((item, index) => register(item.ref, ["diagnosticChecks", index, "ref"], "diagnostic_check"));
    extractedCase.solutions.forEach((item, index) => register(item.ref, ["solutions", index, "ref"], "solution"));
    extractedCase.repairProcedures.forEach((item, index) => register(item.ref, ["repairProcedures", index, "ref"]));
    extractedCase.measurements.forEach((item, index) => register(item.ref, ["measurements", index, "ref"]));
    extractedCase.partsMaterials.forEach((item, index) => register(item.ref, ["partsMaterials", index, "ref"]));
    extractedCase.repairOutcomes.forEach((item, index) => register(item.ref, ["repairOutcomes", index, "ref"], "repair_outcome"));
    extractedCase.evidence.forEach((item, index) => register(item.ref, ["evidence", index, "ref"]));
    extractedCase.relationships.forEach((item, index) => register(item.ref, ["relationships", index, "ref"]));

    extractedCase.measurements.forEach((measurement, index) => {
      if (
        measurement.diagnosticCheckRef !== null &&
        !referencesByType.diagnostic_check.has(measurement.diagnosticCheckRef)
      ) {
        context.addIssue({
          code: "custom",
          message: "DIAGNOSTIC_CHECK_REFERENCE_INVALID",
          path: ["measurements", index, "diagnosticCheckRef"],
        });
      }
    });

    extractedCase.repairProcedures.forEach((procedure, index) => {
      if (procedure.solutionRef !== null && !referencesByType.solution.has(procedure.solutionRef)) {
        context.addIssue({
          code: "custom",
          message: "SOLUTION_REFERENCE_INVALID",
          path: ["repairProcedures", index, "solutionRef"],
        });
      }
    });

    extractedCase.repairOutcomes.forEach((outcome, index) => {
      if (outcome.solutionRef !== null && !referencesByType.solution.has(outcome.solutionRef)) {
        context.addIssue({
          code: "custom",
          message: "SOLUTION_REFERENCE_INVALID",
          path: ["repairOutcomes", index, "solutionRef"],
        });
      }
    });

    extractedCase.evidence.forEach((evidence, index) => {
      if (evidence.targetRef !== null && !references.has(evidence.targetRef)) {
        context.addIssue({
          code: "custom",
          message: "EVIDENCE_TARGET_REFERENCE_INVALID",
          path: ["evidence", index, "targetRef"],
        });
      }
    });

    extractedCase.relationships.forEach((relationship, index) => {
      if (!referencesByType[relationship.fromType].has(relationship.fromRef)) {
        context.addIssue({
          code: "custom",
          message: "RELATIONSHIP_FROM_REFERENCE_INVALID",
          path: ["relationships", index, "fromRef"],
        });
      }

      if (!referencesByType[relationship.toType].has(relationship.toRef)) {
        context.addIssue({
          code: "custom",
          message: "RELATIONSHIP_TO_REFERENCE_INVALID",
          path: ["relationships", index, "toRef"],
        });
      }

      if (
        relationship.evidenceRef !== null &&
        !extractedCase.evidence.some((evidence) => evidence.ref === relationship.evidenceRef)
      ) {
        context.addIssue({
          code: "custom",
          message: "RELATIONSHIP_EVIDENCE_REFERENCE_INVALID",
          path: ["relationships", index, "evidenceRef"],
        });
      }
    });

    extractedCase.solutions.forEach((solution, index) => {
      if (
        solution.repairConfirmed === true &&
        !extractedCase.repairOutcomes.some(
          (outcome) => outcome.solutionRef === solution.ref && outcome.confirmed === true,
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "CONFIRMED_SOLUTION_OUTCOME_REQUIRED",
          path: ["solutions", index, "repairConfirmed"],
        });
      }
    });
  });

export const automotiveExtractionSchema = z
  .strictObject({
    source: z.strictObject({
      title: nullableTextSchema,
      author: nullableTextSchema,
      sourceDate: nullableTextSchema,
      language: nullableTextSchema,
    }),
    documentAnalysis: z.strictObject({
      uncertainties: z.array(uncertaintySchema),
      requiresHumanReview: z.boolean(),
    }),
    cases: z.array(extractedCaseSchema),
  })
  .superRefine((extraction, context) => {
    const caseReferences = new Set<string>();

    extraction.cases.forEach((extractedCase, index) => {
      if (caseReferences.has(extractedCase.ref)) {
        context.addIssue({
          code: "custom",
          message: "DUPLICATE_CASE_REFERENCE",
          path: ["cases", index, "ref"],
        });
      }
      caseReferences.add(extractedCase.ref);
    });

    extraction.documentAnalysis.uncertainties.forEach((uncertainty, index) => {
      if (uncertainty.caseRef !== null && !caseReferences.has(uncertainty.caseRef)) {
        context.addIssue({
          code: "custom",
          message: "UNCERTAINTY_CASE_REFERENCE_INVALID",
          path: ["documentAnalysis", "uncertainties", index, "caseRef"],
        });
      }
    });
  });

export type AutomotiveExtraction = z.infer<typeof automotiveExtractionSchema>;
export type ExtractedAutomotiveCase = z.infer<typeof extractedCaseSchema>;

const generatedJsonSchema = z.toJSONSchema(automotiveExtractionSchema, {
  target: "draft-7",
});

export const automotiveExtractionJsonSchema = Object.fromEntries(
  Object.entries(generatedJsonSchema).filter(([key]) => key !== "$schema"),
) as Record<string, unknown>;
