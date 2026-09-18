import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import { CaseReviewRepository } from "../src/persistence/case-review-repository";
import type { CaseEditDraft } from "../src/schemas/case-edit.schema";

loadEnvConfig(process.cwd());

function emptyDraft(caseId: string, updatedAt: Date): CaseEditDraft {
  return {
    analysisSummary: null,
    caseId,
    caseType: null,
    causes: [],
    complaint: null,
    components: [],
    diagnosticChecks: [],
    dtcs: [],
    evidence: [],
    partsMaterials: [],
    problemDescription: null,
    relationships: [],
    reviewNotes: null,
    solutions: [],
    symptoms: [],
    title: null,
    updatedAt: updatedAt.toISOString(),
    vehicles: [],
  };
}

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const repository = new CaseReviewRepository(database);
  const marker = randomUUID();
  const sourceId = randomUUID();
  const rawArtifact = { immutable: true, marker };

  try {
    const source = await database.source.create({
      data: {
        id: sourceId,
        originalFilename: `case-review-${marker}.pdf`,
        status: "PERSISTED",
        type: "PDF",
        extractionJobs: {
          create: {
            finishedAt: new Date(),
            model: "synthetic",
            promptVersion: "automotive-structure-v1",
            rawAiOutput: rawArtifact,
            startedAt: new Date(),
            status: "COMPLETED",
            validatedOutput: rawArtifact,
          },
        },
      },
      include: { extractionJobs: true },
    });
    const extractionJobId = source.extractionJobs[0]!.id;
    const sharedDtc = await database.dtc.create({
      data: {
        code: `P${marker.replaceAll("-", "").slice(0, 8)}`,
        description: "Shared synthetic DTC",
        normalizedCode: `P${marker.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      },
    });
    const existingComponent = await database.component.create({
      data: {
        componentType: "electrical",
        name: `Synthetic component ${marker}`,
        normalizedName: `synthetic component ${marker}`,
      },
    });
    const editedCase = await database.case.create({
      data: {
        extractionJobId,
        sourceId,
        title: "Original case",
        components: {
          create: {
            componentId: existingComponent.id,
            confidence: 0.91,
            relationOrigin: "EXPLICIT_SOURCE",
            role: "tested component",
          },
        },
        diagnosticChecks: {
          create: {
            actualResult: "12.4 V",
            confidence: 0.92,
            description: "Existing voltage check",
            expectedResult: "12-13 V",
            relationOrigin: "EXPLICIT_SOURCE",
            sequenceOrder: 0,
          },
        },
        dtcs: {
          create: {
            dtcId: sharedDtc.id,
            isPrimary: true,
            relationOrigin: "EXPLICIT_SOURCE",
            relationshipType: "PRIMARY",
          },
        },
      },
      include: {
        components: true,
        diagnosticChecks: { include: { measurements: true } },
        dtcs: true,
      },
    });
    const existingMeasurement = await database.measurement.create({
      data: {
        caseId: editedCase.id,
        conditions: "Ignition on",
        confidence: 0.93,
        diagnosticCheckId: editedCase.diagnosticChecks[0]!.id,
        maxValue: "13",
        minValue: "12",
        numericValue: "12.4",
        parameter: "Voltage",
        relationOrigin: "EXPLICIT_SOURCE",
        unit: "V",
        valueText: "12.4 V",
      },
    });
    const otherCase = await database.case.create({
      data: {
        extractionJobId,
        sourceId,
        title: "Other case",
        dtcs: {
          create: {
            dtcId: sharedDtc.id,
            isPrimary: true,
            relationOrigin: "EXPLICIT_SOURCE",
            relationshipType: "PRIMARY",
          },
        },
      },
    });
    const reviewOnlyCase = await database.case.create({
      data: { extractionJobId, sourceId, title: "Review only case" },
    });
    const lifecycleReviewCase = await database.case.create({
      data: { extractionJobId, sourceId, title: "Lifecycle review case" },
    });
    const rejectCase = await database.case.create({
      data: { extractionJobId, sourceId, title: "Rejected case" },
    });
    const archiveCase = await database.case.create({
      data: { extractionJobId, sourceId, title: "Archived case" },
    });
    const rollbackCase = await database.case.create({
      data: { extractionJobId, sourceId, title: "Rollback case" },
    });

    const draft: CaseEditDraft = {
      ...emptyDraft(editedCase.id, editedCase.updatedAt),
      causes: [
        {
          description: "Synthetic cause description",
          id: "new-cause-link",
          name: `Synthetic cause ${marker}`,
          nodeId: "new-cause",
          probabilitySource: null,
        },
      ],
      components: [
        {
          componentType: existingComponent.componentType,
          id: editedCase.components[0]!.id,
          name: existingComponent.name,
          nodeId: existingComponent.id,
          role: editedCase.components[0]!.role,
        },
      ],
      diagnosticChecks: [
        {
          actualResult: editedCase.diagnosticChecks[0]!.actualResult,
          description: editedCase.diagnosticChecks[0]!.description,
          expectedResult: editedCase.diagnosticChecks[0]!.expectedResult,
          id: editedCase.diagnosticChecks[0]!.id,
          interpretation: editedCase.diagnosticChecks[0]!.interpretation,
          measurements: [
            {
              conditions:
                existingMeasurement.conditions,
              id: existingMeasurement.id,
              maxValue: "13",
              minValue: "12",
              numericValue: "12.4",
              parameter: existingMeasurement.parameter,
              unit: existingMeasurement.unit,
              valueText: existingMeasurement.valueText,
            },
          ],
          sequenceOrder: 0,
        },
        {
          actualResult: "12.4 V",
          description: "Measure voltage",
          expectedResult: "12-13 V",
          id: "new-check",
          interpretation: null,
          measurements: [
            {
              conditions: "Ignition on",
              id: "new-measurement",
              maxValue: "13",
              minValue: "12",
              numericValue: "12.4",
              parameter: "Voltage",
              unit: "V",
              valueText: "12.4 V",
            },
          ],
          sequenceOrder: 1,
        },
      ],
      dtcs: [
        {
          code: sharedDtc.code,
          description: sharedDtc.description,
          id: editedCase.dtcs[0]!.id,
          isPrimary: true,
          nodeId: sharedDtc.id,
          relationshipType: "PRIMARY",
        },
      ],
      evidence: [
        {
          entityId: "new-relationship",
          entityType: "relationship",
          evidenceType: "WORKSHOP_REPORT",
          excerpt: "Synthetic source evidence",
          id: "new-evidence",
          pageNumber: 1,
        },
      ],
      partsMaterials: [
        {
          id: "new-part",
          manufacturer: null,
          name: "Synthetic part",
          notes: null,
          partNumber: marker,
        },
      ],
      relationships: [
        {
          fromId: sharedDtc.id,
          fromType: "DTC",
          id: "new-relationship",
          relationshipType: "indicates",
          sourceEvidenceId: "new-evidence",
          toId: "new-cause",
          toType: "CAUSE",
        },
      ],
      reviewNotes: "Verified by the synthetic save check.",
      solutions: [
        {
          description: "Synthetic repair",
          id: "new-solution-link",
          name: `Synthetic solution ${marker}`,
          nodeId: "new-solution",
          outcomes: [
            {
              attempted: true,
              caseCount: 1,
              confirmed: true,
              id: "new-outcome",
              notes: "Successful",
              successful: true,
              successfulCaseCount: 1,
            },
          ],
          probabilitySource: null,
          procedures: [
            {
              id: "new-procedure",
              instruction: "Install the synthetic part",
              sequenceOrder: 0,
            },
          ],
          repairConfirmed: true,
          repairSuccessful: true,
        },
      ],
      title: "Corrected case",
    };

    const saved = await repository.save(draft, true);
    assert.equal(saved.reviewStatus, "CORRECTED");
    const persisted = await database.case.findUniqueOrThrow({
      where: { id: editedCase.id },
      include: {
        causes: true,
        components: true,
        diagnosticChecks: { include: { measurements: true } },
        dtcs: true,
        evidence: true,
        partsMaterials: true,
        relationships: true,
        solutions: { include: { outcomes: true, procedures: true } },
      },
    });
    assert.equal(persisted.title, "Corrected case");
    assert.equal(persisted.reviewStatus, "CORRECTED");
    assert(persisted.reviewedAt);
    assert.equal(persisted.causes.length, 1);
    assert.equal(persisted.components.length, 1);
    assert.equal(persisted.components[0]!.componentId, existingComponent.id);
    assert.equal(persisted.diagnosticChecks.length, 2);
    assert.equal(
      persisted.diagnosticChecks.find(
        (item) => item.description === "Existing voltage check",
      )?.measurements.length,
      1,
    );
    assert.equal(persisted.solutions[0]!.procedures.length, 1);
    assert.equal(persisted.solutions[0]!.outcomes.length, 1);
    assert.equal(persisted.relationships.length, 1);
    assert.equal(persisted.evidence.length, 1);
    assert.equal(persisted.evidence[0]!.entityId, persisted.relationships[0]!.id);
    assert.equal(persisted.evidence[0]!.entityType, "relationship");
    assert.equal(
      persisted.relationships[0]!.sourceEvidenceId,
      persisted.evidence[0]!.id,
    );
    assert.equal(persisted.partsMaterials.length, 1);
    assert.equal(
      await database.caseDtc.count({ where: { caseId: otherCase.id, dtcId: sharedDtc.id } }),
      1,
    );

    await assert.rejects(
      () => repository.save(draft, true),
      /STALE_EDIT/,
    );

    const conflictDraft: CaseEditDraft = {
      ...draft,
      dtcs: draft.dtcs.map((item) => ({
        ...item,
        description: "Unsafe shared description change",
      })),
      updatedAt: saved.updatedAt,
    };
    await assert.rejects(
      () => repository.save(conflictDraft, true),
      /SHARED_REFERENCE_CONFLICT/,
    );
    assert.equal(
      (await database.dtc.findUniqueOrThrow({ where: { id: sharedDtc.id } })).description,
      "Shared synthetic DTC",
    );
    assert.equal(
      (await database.case.findUniqueOrThrow({ where: { id: editedCase.id } })).updatedAt.toISOString(),
      saved.updatedAt,
    );

    await assert.rejects(() =>
      repository.save(
        {
          ...emptyDraft(rollbackCase.id, rollbackCase.updatedAt),
          components: [
            {
              componentType: "sensor",
              id: "duplicate-component-one",
              name: `Duplicate component ${marker}`,
              nodeId: "duplicate-component-node-one",
              role: "first role",
            },
            {
              componentType: "sensor",
              id: "duplicate-component-two",
              name: `Duplicate component ${marker}`,
              nodeId: "duplicate-component-node-two",
              role: "second role",
            },
          ],
          title: "This change must roll back",
        },
        true,
      ),
    );
    const rolledBack = await database.case.findUniqueOrThrow({
      where: { id: rollbackCase.id },
      include: { components: true },
    });
    assert.equal(rolledBack.title, "Rollback case");
    assert.equal(rolledBack.reviewStatus, "UNREVIEWED");
    assert.equal(rolledBack.components.length, 0);
    assert.equal(rolledBack.updatedAt.toISOString(), rollbackCase.updatedAt.toISOString());

    const reviewed = await repository.save(
      {
        ...emptyDraft(reviewOnlyCase.id, reviewOnlyCase.updatedAt),
        reviewNotes: "Reviewed without technical changes.",
        title: reviewOnlyCase.title,
      },
      false,
    );
    assert.equal(reviewed.reviewStatus, "REVIEWED");

    const lifecycleReviewed = await repository.updateLifecycle({
      action: "review",
      caseId: lifecycleReviewCase.id,
      updatedAt: lifecycleReviewCase.updatedAt.toISOString(),
    });
    assert.equal(lifecycleReviewed.reviewStatus, "REVIEWED");
    assert.equal(lifecycleReviewed.status, "ACTIVE");
    await assert.rejects(
      () =>
        repository.updateLifecycle({
          action: "review",
          caseId: lifecycleReviewCase.id,
          updatedAt: lifecycleReviewCase.updatedAt.toISOString(),
        }),
      /STALE_EDIT/,
    );

    const rejected = await repository.updateLifecycle({
      action: "reject",
      caseId: rejectCase.id,
      updatedAt: rejectCase.updatedAt.toISOString(),
    });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.reviewStatus, "UNREVIEWED");
    await assert.rejects(
      () =>
        repository.updateLifecycle({
          action: "archive",
          caseId: rejectCase.id,
          updatedAt: rejected.updatedAt,
        }),
      /INVALID_LIFECYCLE_TRANSITION/,
    );
    assert.equal(
      (await database.case.findUniqueOrThrow({ where: { id: rejectCase.id } }))
        .status,
      "REJECTED",
    );

    const archived = await repository.updateLifecycle({
      action: "archive",
      caseId: archiveCase.id,
      updatedAt: archiveCase.updatedAt.toISOString(),
    });
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(
      await database.case.count({
        where: { id: { in: [rejectCase.id, archiveCase.id] } },
      }),
      2,
    );

    const correctedReview = await repository.updateLifecycle({
      action: "review",
      caseId: editedCase.id,
      updatedAt: saved.updatedAt,
    });
    assert.equal(correctedReview.reviewStatus, "CORRECTED");
    assert.equal(correctedReview.status, "ACTIVE");

    const job = await database.extractionJob.findUniqueOrThrow({
      where: { id: extractionJobId },
    });
    assert.deepEqual(job.rawAiOutput, rawArtifact);
    assert.deepEqual(job.validatedOutput, rawArtifact);

    console.info(
      "Transactional case correction, reviewed/corrected/rejected/archived transitions, stale-edit rejection, forced rollback, shared-reference safety, complete graph saving, traceability, and immutable extraction artifacts passed.",
    );
  } finally {
    try {
      await database.source.delete({ where: { id: sourceId } }).catch(() => undefined);
      await database.case.deleteMany({ where: { sourceId } });
      await database.extractionJob.deleteMany({ where: { sourceId } });
      await database.source.deleteMany({ where: { id: sourceId } });
      await database.dtc.deleteMany({
        where: { normalizedCode: `P${marker.replaceAll("-", "").slice(0, 8).toUpperCase()}` },
      });
      await database.cause.deleteMany({
        where: { normalizedName: `synthetic cause ${marker}` },
      });
      await database.solution.deleteMany({
        where: { normalizedName: `synthetic solution ${marker}` },
      });
      await database.component.deleteMany({
        where: {
          normalizedName: {
            in: [
              `synthetic component ${marker}`,
              `duplicate component ${marker}`,
            ],
          },
        },
      });
      console.info("Removed only the synthetic case-review records created by this run.");
    } finally {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Case review save verification failed.",
  );
  process.exitCode = 1;
});
