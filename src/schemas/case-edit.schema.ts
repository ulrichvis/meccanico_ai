import { z } from "zod";

const itemIdSchema = z.string().min(1).max(100);
const optionalTextSchema = z.string().trim().max(10_000).nullable();
const requiredTextSchema = z.string().trim().min(1).max(10_000);
const optionalDecimalSchema = z
  .string()
  .trim()
  .regex(/^-?(?:\d+(?:\.\d*)?|\.\d+)$/)
  .max(100)
  .nullable();

const dtcRelationshipTypeSchema = z.enum([
  "PRIMARY",
  "POSSIBLE_CAUSE",
  "CONSEQUENCE",
  "ASSOCIATED_FAULT",
  "ALTERNATIVE_FAULT",
  "SAME_SYSTEM",
  "SECONDARY_CODE",
  "UNCLEAR",
]);

const evidenceTypeSchema = z.enum([
  "THEORETICAL_POSSIBLE_SOLUTION",
  "MANUFACTURER_DOCUMENTATION",
  "TECHNICAL_BULLETIN",
  "WORKSHOP_REPORT",
  "REAL_CASE",
  "CONFIRMED_REPAIR",
  "MULTIPLE_CONFIRMED_CASES",
  "UNCLEAR",
]);

const relationshipNodeTypeSchema = z.enum([
  "DTC",
  "SYMPTOM",
  "CAUSE",
  "DIAGNOSTIC_CHECK",
  "SOLUTION",
  "REPAIR_OUTCOME",
]);

const vehicleSchema = z.strictObject({
  id: itemIdSchema,
  brand: optionalTextSchema,
  compatibilityNote: optionalTextSchema,
  engineCode: optionalTextSchema,
  engineDescription: optionalTextSchema,
  fuelType: optionalTextSchema,
  generation: optionalTextSchema,
  model: optionalTextSchema,
  power: optionalTextSchema,
  transmission: optionalTextSchema,
  yearFrom: z.number().int().min(1886).max(3000).nullable(),
  yearTo: z.number().int().min(1886).max(3000).nullable(),
});

const dtcSchema = z.strictObject({
  code: requiredTextSchema.max(30),
  description: optionalTextSchema,
  id: itemIdSchema,
  isPrimary: z.boolean(),
  nodeId: itemIdSchema,
  relationshipType: dtcRelationshipTypeSchema,
});

const namedDescriptionSchema = z.strictObject({
  description: optionalTextSchema,
  id: itemIdSchema,
  name: requiredTextSchema,
  nodeId: itemIdSchema,
});

const causeSchema = namedDescriptionSchema.extend({
  probabilitySource: optionalTextSchema,
});

const componentSchema = z.strictObject({
  componentType: optionalTextSchema,
  id: itemIdSchema,
  name: requiredTextSchema,
  nodeId: itemIdSchema,
  role: optionalTextSchema,
});

const measurementSchema = z.strictObject({
  conditions: optionalTextSchema,
  id: itemIdSchema,
  maxValue: optionalDecimalSchema,
  minValue: optionalDecimalSchema,
  numericValue: optionalDecimalSchema,
  parameter: requiredTextSchema,
  unit: optionalTextSchema,
  valueText: optionalTextSchema,
});

const diagnosticCheckSchema = z.strictObject({
  actualResult: optionalTextSchema,
  description: requiredTextSchema,
  expectedResult: optionalTextSchema,
  id: itemIdSchema,
  interpretation: optionalTextSchema,
  measurements: z.array(measurementSchema).max(100),
  sequenceOrder: z.number().int().nonnegative().nullable(),
});

const procedureSchema = z.strictObject({
  id: itemIdSchema,
  instruction: requiredTextSchema,
  sequenceOrder: z.number().int().nonnegative(),
});

const outcomeSchema = z.strictObject({
  attempted: z.boolean().nullable(),
  caseCount: z.number().int().nonnegative().nullable(),
  confirmed: z.boolean().nullable(),
  id: itemIdSchema,
  notes: optionalTextSchema,
  successful: z.boolean().nullable(),
  successfulCaseCount: z.number().int().nonnegative().nullable(),
});

const solutionSchema = z.strictObject({
  description: optionalTextSchema,
  id: itemIdSchema,
  name: requiredTextSchema,
  nodeId: itemIdSchema,
  outcomes: z.array(outcomeSchema).max(100),
  probabilitySource: optionalTextSchema,
  procedures: z.array(procedureSchema).max(200),
  repairConfirmed: z.boolean().nullable(),
  repairSuccessful: z.boolean().nullable(),
});

const partMaterialSchema = z.strictObject({
  id: itemIdSchema,
  manufacturer: optionalTextSchema,
  name: requiredTextSchema,
  notes: optionalTextSchema,
  partNumber: optionalTextSchema,
});

const evidenceSchema = z.strictObject({
  entityId: itemIdSchema.nullable(),
  entityType: z.string().trim().max(100).nullable(),
  evidenceType: evidenceTypeSchema,
  excerpt: requiredTextSchema,
  id: itemIdSchema,
  pageNumber: z.number().int().positive().nullable(),
});

const relationshipSchema = z.strictObject({
  fromId: itemIdSchema,
  fromType: relationshipNodeTypeSchema,
  id: itemIdSchema,
  relationshipType: requiredTextSchema.max(200),
  sourceEvidenceId: itemIdSchema.nullable(),
  toId: itemIdSchema,
  toType: relationshipNodeTypeSchema,
});

export const caseEditSchema = z
  .strictObject({
    analysisSummary: optionalTextSchema,
    caseId: z.uuid(),
    caseType: optionalTextSchema,
    causes: z.array(causeSchema).max(200),
    complaint: optionalTextSchema,
    components: z.array(componentSchema).max(200),
    diagnosticChecks: z.array(diagnosticCheckSchema).max(200),
    dtcs: z.array(dtcSchema).max(100),
    evidence: z.array(evidenceSchema).max(500),
    partsMaterials: z.array(partMaterialSchema).max(300),
    problemDescription: optionalTextSchema,
    relationships: z.array(relationshipSchema).max(500),
    reviewNotes: optionalTextSchema,
    solutions: z.array(solutionSchema).max(200),
    symptoms: z.array(namedDescriptionSchema).max(200),
    title: optionalTextSchema,
    updatedAt: z.iso.datetime({ offset: true }),
    vehicles: z.array(vehicleSchema).max(100),
  })
  .superRefine((value, context) => {
    if (value.dtcs.filter((item) => item.isPrimary).length > 1) {
      context.addIssue({
        code: "custom",
        message: "CASE_EDIT_MULTIPLE_PRIMARY_DTCS",
        path: ["dtcs"],
      });
    }

    value.dtcs.forEach((item, index) => {
      if (item.isPrimary !== (item.relationshipType === "PRIMARY")) {
        context.addIssue({
          code: "custom",
          message: "CASE_EDIT_PRIMARY_DTC_ROLE_INVALID",
          path: ["dtcs", index, "relationshipType"],
        });
      }
    });

    value.vehicles.forEach((item, index) => {
      if (
        item.yearFrom !== null &&
        item.yearTo !== null &&
        item.yearFrom > item.yearTo
      ) {
        context.addIssue({
          code: "custom",
          message: "CASE_EDIT_VEHICLE_YEAR_RANGE_INVALID",
          path: ["vehicles", index, "yearTo"],
        });
      }
    });

    value.diagnosticChecks.forEach((check, checkIndex) => {
      check.measurements.forEach((measurement, measurementIndex) => {
        if (
          measurement.minValue !== null &&
          measurement.maxValue !== null &&
          Number(measurement.minValue) > Number(measurement.maxValue)
        ) {
          context.addIssue({
            code: "custom",
            message: "CASE_EDIT_MEASUREMENT_RANGE_INVALID",
            path: [
              "diagnosticChecks",
              checkIndex,
              "measurements",
              measurementIndex,
              "maxValue",
            ],
          });
        }
      });
    });

    value.solutions.forEach((solution, solutionIndex) => {
      solution.outcomes.forEach((outcome, outcomeIndex) => {
        if (
          outcome.caseCount !== null &&
          outcome.successfulCaseCount !== null &&
          outcome.successfulCaseCount > outcome.caseCount
        ) {
          context.addIssue({
            code: "custom",
            message: "CASE_EDIT_OUTCOME_COUNT_INVALID",
            path: [
              "solutions",
              solutionIndex,
              "outcomes",
              outcomeIndex,
              "successfulCaseCount",
            ],
          });
        }
      });
    });

    const nodes = new Set<string>();
    for (const item of value.dtcs) nodes.add(`DTC:${item.nodeId}`);
    for (const item of value.symptoms) nodes.add(`SYMPTOM:${item.nodeId}`);
    for (const item of value.causes) nodes.add(`CAUSE:${item.nodeId}`);
    for (const item of value.diagnosticChecks) {
      nodes.add(`DIAGNOSTIC_CHECK:${item.id}`);
    }
    for (const solution of value.solutions) {
      nodes.add(`SOLUTION:${solution.nodeId}`);
      for (const outcome of solution.outcomes) {
        nodes.add(`REPAIR_OUTCOME:${outcome.id}`);
      }
    }
    const evidenceIds = new Set(value.evidence.map((item) => item.id));

    value.relationships.forEach((relationship, index) => {
      if (!nodes.has(`${relationship.fromType}:${relationship.fromId}`)) {
        context.addIssue({
          code: "custom",
          message: "CASE_EDIT_RELATIONSHIP_SOURCE_INVALID",
          path: ["relationships", index, "fromId"],
        });
      }
      if (!nodes.has(`${relationship.toType}:${relationship.toId}`)) {
        context.addIssue({
          code: "custom",
          message: "CASE_EDIT_RELATIONSHIP_TARGET_INVALID",
          path: ["relationships", index, "toId"],
        });
      }
      if (
        relationship.sourceEvidenceId &&
        !evidenceIds.has(relationship.sourceEvidenceId)
      ) {
        context.addIssue({
          code: "custom",
          message: "CASE_EDIT_RELATIONSHIP_EVIDENCE_INVALID",
          path: ["relationships", index, "sourceEvidenceId"],
        });
      }
    });
  });

export type CaseEditDraft = z.infer<typeof caseEditSchema>;
