import assert from "node:assert/strict";

import { caseEditSchema } from "../src/schemas/case-edit.schema.ts";

const validDraft = {
  analysisSummary: null,
  caseId: "11111111-1111-4111-8111-111111111111",
  caseType: "diagnostic case",
  causes: [
    {
      id: "cause-link-1",
      nodeId: "cause-1",
      name: "Restricted flow",
      description: null,
      probabilitySource: null,
    },
  ],
  complaint: "Low boost pressure",
  components: [],
  diagnosticChecks: [
    {
      id: "check-1",
      description: "Measure actuator travel",
      expectedResult: null,
      actualResult: null,
      interpretation: null,
      sequenceOrder: 0,
      measurements: [],
    },
  ],
  dtcs: [
    {
      id: "dtc-link-1",
      nodeId: "dtc-1",
      code: "P2563",
      description: null,
      isPrimary: true,
      relationshipType: "PRIMARY",
    },
  ],
  evidence: [
    {
      id: "evidence-1",
      excerpt: "DTC P2563 was stored.",
      pageNumber: 1,
      evidenceType: "REAL_CASE",
      entityType: "dtc",
      entityId: "dtc-1",
    },
  ],
  partsMaterials: [],
  problemDescription: null,
  relationships: [
    {
      id: "relationship-1",
      fromType: "DTC",
      fromId: "dtc-1",
      relationshipType: "investigated_by",
      toType: "DIAGNOSTIC_CHECK",
      toId: "check-1",
      sourceEvidenceId: "evidence-1",
    },
  ],
  reviewNotes: null,
  solutions: [],
  symptoms: [],
  title: "Boost actuator diagnosis",
  updatedAt: "2026-09-18T12:00:00.000Z",
  vehicles: [],
};

assert.equal(caseEditSchema.safeParse(validDraft).success, true);

const multiplePrimary = structuredClone(validDraft);
multiplePrimary.dtcs.push({
  ...multiplePrimary.dtcs[0],
  id: "dtc-link-2",
  nodeId: "dtc-2",
});
assert.equal(caseEditSchema.safeParse(multiplePrimary).success, false);

const brokenRelationship = structuredClone(validDraft);
brokenRelationship.relationships[0].toId = "missing-check";
assert.equal(caseEditSchema.safeParse(brokenRelationship).success, false);

const missingEvidence = structuredClone(validDraft);
missingEvidence.relationships[0].sourceEvidenceId = "missing-evidence";
assert.equal(caseEditSchema.safeParse(missingEvidence).success, false);

const missingRequiredName = structuredClone(validDraft);
missingRequiredName.causes[0].name = "";
assert.equal(caseEditSchema.safeParse(missingRequiredName).success, false);

const mismatchedPrimaryRole = structuredClone(validDraft);
mismatchedPrimaryRole.dtcs[0].relationshipType = "UNCLEAR";
assert.equal(caseEditSchema.safeParse(mismatchedPrimaryRole).success, false);

const invalidVehicleRange = structuredClone(validDraft);
invalidVehicleRange.vehicles.push({
  id: "vehicle-1",
  brand: "Test",
  model: null,
  generation: null,
  yearFrom: 2026,
  yearTo: 2020,
  engineDescription: null,
  engineCode: null,
  fuelType: null,
  power: null,
  transmission: null,
  compatibilityNote: null,
});
assert.equal(caseEditSchema.safeParse(invalidVehicleRange).success, false);

const invalidMeasurement = structuredClone(validDraft);
invalidMeasurement.diagnosticChecks[0].measurements.push({
  id: "measurement-1",
  parameter: "Pressure",
  valueText: null,
  numericValue: "not-a-number",
  unit: "bar",
  conditions: null,
  minValue: "2",
  maxValue: "1",
});
assert.equal(caseEditSchema.safeParse(invalidMeasurement).success, false);

console.info("Case edit contract verification passed.");
