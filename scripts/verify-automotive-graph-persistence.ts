import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import { normalizeAutomotiveExtraction } from "../src/normalization/automotive-normalizer";
import { AutomotiveGraphRepository } from "../src/persistence/automotive-graph-repository";
import {
  AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
  type ExtractedAutomotiveCase,
} from "../src/schemas/automotive-extraction.schema";

loadEnvConfig(process.cwd());

const explicit = {
  relationOrigin: "explicit_source",
  confidence: null,
} as const;

function emptyCase(ref: string): ExtractedAutomotiveCase {
  return {
    ref,
    caseType: null,
    title: null,
    vehicles: [],
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
  };
}

function vehicle(ref: string, marker: string) {
  return {
    ref,
    brand: `Synthetic ${marker}`,
    model: "Verifier",
    generation: null,
    yearFrom: 2020,
    yearTo: 2021,
    engineDescription: "1.0 test engine",
    engineCode: marker,
    fuelType: "test fuel",
    power: null,
    transmission: null,
    compatibilityNote: null,
    ...explicit,
  };
}

function extractionFixture(marker: string) {
  const first = emptyCase("case-1");
  first.caseType = "diagnostic_case";
  first.title = "Synthetic complete graph";
  first.vehicles = [vehicle("vehicle-1", marker)];
  first.primaryDtc = {
    ref: "dtc-1",
    code: `P ${marker.slice(0, 6)}`,
    description: "Synthetic primary code",
    ...explicit,
  };
  first.relatedDtcs = [
    {
      ref: "dtc-2",
      code: `U${marker.slice(0, 6)}`,
      description: null,
      relationshipType: "associated_fault",
      ...explicit,
    },
  ];
  first.complaint = "Synthetic complaint";
  first.symptoms = [
    {
      ref: "symptom-1",
      name: `Symptom ${marker}`,
      description: "Synthetic symptom wording",
      ...explicit,
    },
  ];
  first.problemDescription = "Synthetic problem";
  first.causes = [
    {
      ref: "cause-1",
      name: `Cause ${marker}`,
      description: "Synthetic cause wording",
      probabilitySource: "frequently",
      probabilityCalculated: null,
      relationOrigin: "ai_inference",
      confidence: 0.8,
    },
  ];
  first.components = [
    {
      ref: "component-1",
      name: `Component ${marker}`,
      componentType: "synthetic",
      role: "test role",
      ...explicit,
    },
  ];
  first.diagnosticChecks = [
    {
      ref: "check-1",
      description: "Perform synthetic check",
      expectedResult: "Expected",
      actualResult: "Actual",
      interpretation: "Synthetic interpretation",
      sequenceOrder: 1,
      ...explicit,
    },
  ];
  first.solutions = [
    {
      ref: "solution-1",
      name: `Solution ${marker}`,
      description: "Synthetic solution wording",
      probabilitySource: null,
      probabilityCalculated: null,
      repairConfirmed: true,
      repairSuccessful: true,
      ...explicit,
    },
  ];
  first.repairProcedures = [
    {
      ref: "procedure-1",
      solutionRef: "solution-1",
      sequenceOrder: 1,
      instruction: "Perform synthetic repair",
      ...explicit,
    },
  ];
  first.measurements = [
    {
      ref: "measurement-1",
      diagnosticCheckRef: "check-1",
      parameter: "Synthetic voltage",
      valueText: "12.4 V",
      numericValue: 12.4,
      unit: "V",
      conditions: "Test conditions",
      minValue: 12,
      maxValue: 13,
      ...explicit,
    },
  ];
  first.partsMaterials = [
    {
      ref: "material-1",
      name: "Synthetic material",
      partNumber: marker,
      manufacturer: "Verifier",
      notes: null,
      ...explicit,
    },
  ];
  first.repairOutcomes = [
    {
      ref: "outcome-1",
      solutionRef: "solution-1",
      attempted: true,
      successful: true,
      confirmed: true,
      caseCount: 1,
      successfulCaseCount: 1,
      notes: "Synthetic success",
    },
  ];
  first.evidence = [
    {
      ref: "evidence-1",
      targetRef: "relationship-1",
      pageNumber: 1,
      excerpt: "Synthetic evidence for relationship",
      evidenceType: "workshop_report",
      ...explicit,
    },
    {
      ref: "evidence-2",
      targetRef: "cause-1",
      pageNumber: 1,
      excerpt: "Synthetic evidence for cause",
      evidenceType: "real_case",
      ...explicit,
    },
  ];
  first.relationships = [
    {
      ref: "relationship-1",
      fromType: "symptom",
      fromRef: "symptom-1",
      relationshipType: "indicates",
      toType: "cause",
      toRef: "cause-1",
      evidenceRef: "evidence-1",
      relationOrigin: "ai_inference",
      confidence: 0.7,
    },
  ];

  const second = emptyCase("case-2");
  second.title = "Shared vehicle case";
  second.vehicles = [vehicle("vehicle-2", marker)];

  return {
    source: {
      title: "Synthetic persistence fixture",
      author: null,
      sourceDate: null,
      language: "en",
    },
    documentAnalysis: { uncertainties: [], requiresHumanReview: false },
    cases: [first, second],
  };
}

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const repository = new AutomotiveGraphRepository(database);
  const sourceIds: string[] = [];
  const referenceMarkers: string[] = [];

  const createContext = async (marker: string) => {
    const sourceId = randomUUID();
    const documentId = randomUUID();
    const extractionJobId = randomUUID();
    const artifact = { marker, immutable: true };
    await database.source.create({
      data: {
        id: sourceId,
        type: "PDF",
        status: "PROCESSING",
        originalFilename: `${marker}.pdf`,
        documents: {
          create: {
            id: documentId,
            title: marker,
            pageCount: 1,
            pagesJson: [
              {
                pageNumber: 1,
                text: "Synthetic evidence for relationship. Synthetic evidence for cause.",
                textQuality: "readable",
                uncertainty: null,
              },
            ],
          },
        },
        extractionJobs: {
          create: {
            id: extractionJobId,
            status: "COMPLETED",
            model: "synthetic",
            promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
            startedAt: new Date(),
            finishedAt: new Date(),
            rawAiOutput: artifact,
            validatedOutput: artifact,
          },
        },
      },
    });
    sourceIds.push(sourceId);
    referenceMarkers.push(marker);
    return { sourceId, documentId, extractionJobId, artifact };
  };

  try {
    const marker = `graph-${randomUUID()}`;
    const context = await createContext(marker);
    const extraction = normalizeAutomotiveExtraction(extractionFixture(marker));
    const result = await repository.persist({ ...context, extraction });
    assert.equal(result.caseIds.length, 2);

    const cases = await database.case.findMany({
      where: { extractionJobId: context.extractionJobId },
      include: {
        vehicles: true,
        dtcs: true,
        symptoms: true,
        causes: true,
        components: true,
        diagnosticChecks: true,
        solutions: true,
        repairProcedures: true,
        measurements: true,
        partsMaterials: true,
        repairOutcomes: true,
        evidence: true,
        relationships: true,
      },
      orderBy: { title: "asc" },
    });
    assert.equal(cases.length, 2);
    assert(cases.every((item) => item.status === "ACTIVE"));
    assert(cases.every((item) => item.reviewStatus === "UNREVIEWED"));
    const complete = cases.find((item) => item.title === "Synthetic complete graph");
    assert(complete);
    assert.equal(complete.vehicles.length, 1);
    assert.equal(complete.dtcs.length, 2);
    assert.equal(complete.symptoms.length, 1);
    assert.equal(complete.causes.length, 1);
    assert.equal(complete.components.length, 1);
    assert.equal(complete.diagnosticChecks.length, 1);
    assert.equal(complete.solutions.length, 1);
    assert.equal(complete.repairProcedures.length, 1);
    assert.equal(complete.measurements.length, 1);
    assert.equal(complete.partsMaterials.length, 1);
    assert.equal(complete.repairOutcomes.length, 1);
    assert.equal(complete.evidence.length, 2);
    assert.equal(complete.relationships.length, 1);

    const normalizedKey = extraction.cases[0]!.vehicles[0]!.lookupKey;
    assert.equal(await database.vehicle.count({ where: { normalizedKey } }), 1);
    assert.equal(
      await database.caseVehicle.count({
        where: { vehicle: { normalizedKey } },
      }),
      2,
    );
    const relationship = complete.relationships[0]!;
    const circularEvidence = complete.evidence.find(
      (item) => item.excerpt === "Synthetic evidence for relationship",
    );
    assert(circularEvidence);
    assert.equal(circularEvidence.entityId, relationship.id);
    assert.equal(relationship.sourceEvidenceId, circularEvidence.id);

    const jobAfter = await database.extractionJob.findUniqueOrThrow({
      where: { id: context.extractionJobId },
    });
    assert.deepEqual(jobAfter.rawAiOutput, context.artifact);
    assert.deepEqual(jobAfter.validatedOutput, context.artifact);
    assert.equal(
      (await database.source.findUniqueOrThrow({ where: { id: context.sourceId } }))
        .status,
      "PROCESSING",
    );
    await assert.rejects(
      () => repository.persist({ ...context, extraction }),
      /EXTRACTION_ALREADY_PERSISTED/,
    );
    assert.equal(
      await database.case.count({
        where: { extractionJobId: context.extractionJobId },
      }),
      2,
    );

    const rollbackMarker = `rollback-${randomUUID()}`;
    const rollbackContext = await createContext(rollbackMarker);
    const rollbackInput = extractionFixture(rollbackMarker);
    const rollbackCase = rollbackInput.cases[0]!;
    const duplicateCode = `U${rollbackMarker.replaceAll("-", "").slice(0, 8)}`;
    rollbackCase.primaryDtc = {
      ref: "rollback-dtc-1",
      code: `${duplicateCode.slice(0, 2)} ${duplicateCode.slice(2)}`,
      description: null,
      ...explicit,
    };
    rollbackCase.relatedDtcs = [
      {
        ref: "rollback-dtc-2",
        code: duplicateCode,
        description: null,
        relationshipType: "associated_fault",
        ...explicit,
      },
    ];
    const rollbackExtraction = normalizeAutomotiveExtraction({
      ...rollbackInput,
      cases: [rollbackCase],
    });
    await assert.rejects(() =>
      repository.persist({ ...rollbackContext, extraction: rollbackExtraction }),
    );
    assert.equal(
      await database.case.count({
        where: { extractionJobId: rollbackContext.extractionJobId },
      }),
      0,
    );
    assert.equal(
      await database.vehicle.count({
        where: { normalizedKey: rollbackExtraction.cases[0]!.vehicles[0]!.lookupKey },
      }),
      0,
    );
    assert.equal(
      await database.dtc.count({ where: { normalizedCode: duplicateCode } }),
      0,
    );

    console.info(
      "Atomic automotive graph persistence, shared upserts, typed UUID resolution, immutable artifacts, duplicate protection, and rollback passed.",
    );
  } finally {
    try {
      await database.$transaction(async (transaction) => {
        await transaction.case.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.document.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.extractionJob.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.source.deleteMany({ where: { id: { in: sourceIds } } });
        await transaction.vehicle.deleteMany({
          where: { engineCode: { in: referenceMarkers } },
        });
        await transaction.dtc.deleteMany({
          where: {
            OR: referenceMarkers.flatMap((marker) => [
              { normalizedCode: `P${marker.slice(0, 6).toUpperCase()}` },
              { normalizedCode: `U${marker.slice(0, 6).toUpperCase()}` },
            ]),
          },
        });
        await transaction.symptom.deleteMany({
          where: { normalizedName: { in: referenceMarkers.map((item) => `symptom ${item}`) } },
        });
        await transaction.cause.deleteMany({
          where: { normalizedName: { in: referenceMarkers.map((item) => `cause ${item}`) } },
        });
        await transaction.solution.deleteMany({
          where: { normalizedName: { in: referenceMarkers.map((item) => `solution ${item}`) } },
        });
        await transaction.component.deleteMany({
          where: { normalizedName: { in: referenceMarkers.map((item) => `component ${item}`) } },
        });
      });
      console.info(
        "Removed only the synthetic graph verification records created by this run.",
      );
    } finally {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: automotive graph persistence verification failed.`
      : "Automotive graph persistence verification failed.",
  );
  process.exitCode = 1;
});
