import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  normalizeDtcCode,
  normalizeEntityName,
} from "@/normalization/automotive-normalizer";
import type { CaseEditDraft } from "@/schemas/case-edit.schema";
import type { CaseLifecycleAction } from "@/schemas/case-lifecycle.schema";

const CASE_REVIEW_TRANSACTION_TIMEOUT_MS = 30_000;

type Provenance = {
  confidence: Prisma.Decimal | null;
  relationOrigin: "EXPLICIT_SOURCE" | "AI_INFERENCE" | "HUMAN_ADDED";
};

const humanProvenance: Provenance = {
  confidence: null,
  relationOrigin: "HUMAN_ADDED",
};

export class CaseReviewPersistenceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CaseReviewPersistenceError";
  }
}

export interface SaveCaseReviewResult {
  reviewStatus: "REVIEWED" | "CORRECTED";
  updatedAt: string;
}

export interface UpdateCaseLifecycleResult {
  reviewStatus: "UNREVIEWED" | "REVIEWED" | "CORRECTED";
  status: "ACTIVE" | "REJECTED" | "ARCHIVED";
  updatedAt: string;
}

function provenanceFor(
  provenance: Map<string, Provenance>,
  id: string,
): Provenance {
  return provenance.get(id) ?? humanProvenance;
}

function vehicleLookupKey(
  caseId: string,
  vehicle: CaseEditDraft["vehicles"][number],
): string {
  const identity = [
    vehicle.brand,
    vehicle.model,
    vehicle.generation,
    vehicle.yearFrom,
    vehicle.yearTo,
    vehicle.engineDescription,
    vehicle.engineCode,
    vehicle.fuelType,
    vehicle.power,
    vehicle.transmission,
  ].map((value) =>
    typeof value === "string" ? normalizeEntityName(value) : value,
  );

  return identity.some((value) => value !== null)
    ? `shared:${JSON.stringify(identity)}`
    : `local:${caseId}:${vehicle.id}`;
}

async function resolveDtc(
  transaction: Prisma.TransactionClient,
  caseId: string,
  item: CaseEditDraft["dtcs"][number],
): Promise<string> {
  const normalizedCode = normalizeDtcCode(item.code);
  const existing = await transaction.dtc.findUnique({
    where: { normalizedCode },
    select: { code: true, description: true, id: true },
  });

  if (!existing) {
    const created = await transaction.dtc.create({
      data: { code: item.code, description: item.description, normalizedCode },
      select: { id: true },
    });
    return created.id;
  }

  if (existing.code !== item.code || existing.description !== item.description) {
    const otherCaseCount = await transaction.caseDtc.count({
      where: { caseId: { not: caseId }, dtcId: existing.id },
    });
    if (otherCaseCount > 0) {
      throw new CaseReviewPersistenceError("SHARED_REFERENCE_CONFLICT");
    }
    await transaction.dtc.update({
      where: { id: existing.id },
      data: { code: item.code, description: item.description },
    });
  }

  return existing.id;
}

async function resolveComponent(
  transaction: Prisma.TransactionClient,
  caseId: string,
  item: CaseEditDraft["components"][number],
): Promise<string> {
  const normalizedName = normalizeEntityName(item.name);
  const existing = await transaction.component.findUnique({
    where: { normalizedName },
    select: { componentType: true, id: true, name: true },
  });

  if (!existing) {
    const created = await transaction.component.create({
      data: {
        componentType: item.componentType,
        name: item.name,
        normalizedName,
      },
      select: { id: true },
    });
    return created.id;
  }

  if (existing.name !== item.name || existing.componentType !== item.componentType) {
    const otherCaseCount = await transaction.caseComponent.count({
      where: { caseId: { not: caseId }, componentId: existing.id },
    });
    if (otherCaseCount > 0) {
      throw new CaseReviewPersistenceError("SHARED_REFERENCE_CONFLICT");
    }
    await transaction.component.update({
      where: { id: existing.id },
      data: { componentType: item.componentType, name: item.name },
    });
  }

  return existing.id;
}

async function clearCaseGraph(
  transaction: Prisma.TransactionClient,
  caseId: string,
): Promise<void> {
  await transaction.relationship.deleteMany({ where: { caseId } });
  await transaction.sourceEvidence.deleteMany({ where: { caseId } });
  await transaction.measurement.deleteMany({ where: { caseId } });
  await transaction.repairProcedure.deleteMany({ where: { caseId } });
  await transaction.repairOutcome.deleteMany({ where: { caseId } });
  await transaction.diagnosticCheck.deleteMany({ where: { caseId } });
  await transaction.partMaterial.deleteMany({ where: { caseId } });
  await transaction.caseVehicle.deleteMany({ where: { caseId } });
  await transaction.caseDtc.deleteMany({ where: { caseId } });
  await transaction.caseSymptom.deleteMany({ where: { caseId } });
  await transaction.caseCause.deleteMany({ where: { caseId } });
  await transaction.caseSolution.deleteMany({ where: { caseId } });
  await transaction.caseComponent.deleteMany({ where: { caseId } });
}

export class CaseReviewRepository {
  constructor(private readonly database: PrismaClient) {}

  async save(
    draft: CaseEditDraft,
    technicalDataChanged: boolean,
  ): Promise<SaveCaseReviewResult> {
    return this.database.$transaction(
      async (transaction) => {
        const storedCase = await transaction.case.findUnique({
          where: { id: draft.caseId },
          select: {
            causes: { select: { confidence: true, id: true, relationOrigin: true } },
            components: { select: { confidence: true, id: true, relationOrigin: true } },
            diagnosticChecks: {
              select: {
                confidence: true,
                id: true,
                measurements: { select: { confidence: true, id: true, relationOrigin: true } },
                relationOrigin: true,
              },
            },
            dtcs: { select: { confidence: true, id: true, relationOrigin: true } },
            evidence: { select: { confidence: true, id: true, relationOrigin: true } },
            id: true,
            partsMaterials: { select: { confidence: true, id: true, relationOrigin: true } },
            relationships: { select: { confidence: true, id: true, relationOrigin: true } },
            reviewStatus: true,
            solutions: {
              select: {
                confidence: true,
                id: true,
                procedures: { select: { confidence: true, id: true, relationOrigin: true } },
                relationOrigin: true,
              },
            },
            sourceId: true,
            symptoms: { select: { confidence: true, id: true, relationOrigin: true } },
            updatedAt: true,
            vehicles: {
              select: {
                confidence: true,
                id: true,
                relationOrigin: true,
                vehicleId: true,
              },
            },
          },
        });

        if (!storedCase) {
          throw new CaseReviewPersistenceError("CASE_NOT_FOUND");
        }

        const expectedUpdatedAt = new Date(draft.updatedAt);
        const targetReviewStatus = technicalDataChanged
          ? "CORRECTED"
          : storedCase.reviewStatus === "CORRECTED"
            ? "CORRECTED"
            : "REVIEWED";
        const updated = await transaction.case.updateMany({
          where: { id: draft.caseId, updatedAt: expectedUpdatedAt },
          data: {
            analysisSummary: draft.analysisSummary,
            caseType: draft.caseType,
            complaint: draft.complaint,
            problemDescription: draft.problemDescription,
            reviewNotes: draft.reviewNotes,
            reviewedAt: new Date(),
            reviewStatus: targetReviewStatus,
            title: draft.title,
          },
        });

        if (updated.count !== 1) {
          throw new CaseReviewPersistenceError("STALE_EDIT");
        }

        if (technicalDataChanged) {
          const provenance = new Map<string, Provenance>();
          const remember = (items: Array<Provenance & { id: string }>) => {
            for (const item of items) {
              provenance.set(item.id, {
                confidence: item.confidence,
                relationOrigin: item.relationOrigin,
              });
            }
          };
          remember(storedCase.vehicles);
          remember(storedCase.dtcs);
          remember(storedCase.symptoms);
          remember(storedCase.causes);
          remember(storedCase.components);
          remember(storedCase.diagnosticChecks);
          remember(storedCase.diagnosticChecks.flatMap((item) => item.measurements));
          remember(storedCase.solutions);
          remember(storedCase.solutions.flatMap((item) => item.procedures));
          remember(storedCase.partsMaterials);
          remember(storedCase.evidence);
          remember(storedCase.relationships);

          const idsByClientId = new Map<string, string>([[draft.caseId, draft.caseId]]);
          const oldVehicleIds = new Map(
            storedCase.vehicles.map((item) => [item.id, item.vehicleId]),
          );
          await clearCaseGraph(transaction, draft.caseId);

          for (const item of draft.vehicles) {
            const stored = await transaction.vehicle.upsert({
              where: { normalizedKey: vehicleLookupKey(draft.caseId, item) },
              create: {
                brand: item.brand,
                engineCode: item.engineCode,
                engineDescription: item.engineDescription,
                fuelType: item.fuelType,
                generation: item.generation,
                model: item.model,
                normalizedKey: vehicleLookupKey(draft.caseId, item),
                power: item.power,
                transmission: item.transmission,
                yearFrom: item.yearFrom,
                yearTo: item.yearTo,
              },
              update: {},
              select: { id: true },
            });
            const origin = provenanceFor(provenance, item.id);
            await transaction.caseVehicle.create({
              data: {
                caseId: draft.caseId,
                compatibilityNote: item.compatibilityNote,
                ...origin,
                vehicleId: stored.id,
              },
            });
            idsByClientId.set(item.id, stored.id);
            const oldVehicleId = oldVehicleIds.get(item.id);
            if (oldVehicleId) idsByClientId.set(oldVehicleId, stored.id);
          }

          for (const item of draft.dtcs) {
            const dtcId = await resolveDtc(transaction, draft.caseId, item);
            const origin = provenanceFor(provenance, item.id);
            await transaction.caseDtc.create({
              data: {
                caseId: draft.caseId,
                dtcId,
                isPrimary: item.isPrimary,
                relationshipType: item.relationshipType,
                ...origin,
              },
            });
            idsByClientId.set(item.id, dtcId);
            idsByClientId.set(item.nodeId, dtcId);
          }

          for (const item of draft.symptoms) {
            const stored = await transaction.symptom.upsert({
              where: { normalizedName: normalizeEntityName(item.name) },
              create: { normalizedName: normalizeEntityName(item.name) },
              update: {},
              select: { id: true },
            });
            await transaction.caseSymptom.create({
              data: {
                caseId: draft.caseId,
                description: item.description,
                ...provenanceFor(provenance, item.id),
                symptomId: stored.id,
              },
            });
            idsByClientId.set(item.id, stored.id);
            idsByClientId.set(item.nodeId, stored.id);
          }

          for (const item of draft.causes) {
            const stored = await transaction.cause.upsert({
              where: { normalizedName: normalizeEntityName(item.name) },
              create: { normalizedName: normalizeEntityName(item.name) },
              update: {},
              select: { id: true },
            });
            await transaction.caseCause.create({
              data: {
                caseId: draft.caseId,
                causeId: stored.id,
                description: item.description,
                probabilityCalculated: null,
                probabilitySource: item.probabilitySource,
                ...provenanceFor(provenance, item.id),
              },
            });
            idsByClientId.set(item.id, stored.id);
            idsByClientId.set(item.nodeId, stored.id);
          }

          for (const item of draft.components) {
            const componentId = await resolveComponent(transaction, draft.caseId, item);
            await transaction.caseComponent.create({
              data: {
                caseId: draft.caseId,
                componentId,
                role: item.role,
                ...provenanceFor(provenance, item.id),
              },
            });
            idsByClientId.set(item.id, componentId);
            idsByClientId.set(item.nodeId, componentId);
          }

          for (const [index, item] of draft.diagnosticChecks.entries()) {
            const stored = await transaction.diagnosticCheck.create({
              data: {
                actualResult: item.actualResult,
                caseId: draft.caseId,
                description: item.description,
                expectedResult: item.expectedResult,
                interpretation: item.interpretation,
                sequenceOrder: index,
                ...provenanceFor(provenance, item.id),
              },
              select: { id: true },
            });
            idsByClientId.set(item.id, stored.id);
          }

          for (const item of draft.solutions) {
            const stored = await transaction.solution.upsert({
              where: { normalizedName: normalizeEntityName(item.name) },
              create: { normalizedName: normalizeEntityName(item.name) },
              update: {},
              select: { id: true },
            });
            const association = await transaction.caseSolution.create({
              data: {
                caseId: draft.caseId,
                description: item.description,
                probabilityCalculated: null,
                probabilitySource: item.probabilitySource,
                repairConfirmed: item.repairConfirmed,
                repairSuccessful: item.repairSuccessful,
                solutionId: stored.id,
                ...provenanceFor(provenance, item.id),
              },
              select: { id: true },
            });
            idsByClientId.set(item.id, stored.id);
            idsByClientId.set(item.nodeId, stored.id);
            for (const [index, procedure] of item.procedures.entries()) {
              const created = await transaction.repairProcedure.create({
                data: {
                  caseId: draft.caseId,
                  caseSolutionId: association.id,
                  instruction: procedure.instruction,
                  sequenceOrder: index,
                  ...provenanceFor(provenance, procedure.id),
                },
                select: { id: true },
              });
              idsByClientId.set(procedure.id, created.id);
            }

            for (const outcome of item.outcomes) {
              const created = await transaction.repairOutcome.create({
                data: {
                  attempted: outcome.attempted,
                  caseCount: outcome.caseCount,
                  caseId: draft.caseId,
                  caseSolutionId: association.id,
                  confirmed: outcome.confirmed,
                  notes: outcome.notes,
                  successful: outcome.successful,
                  successfulCaseCount: outcome.successfulCaseCount,
                },
                select: { id: true },
              });
              idsByClientId.set(outcome.id, created.id);
            }
          }

          for (const check of draft.diagnosticChecks) {
            const diagnosticCheckId = idsByClientId.get(check.id);
            if (!diagnosticCheckId) {
              throw new CaseReviewPersistenceError("INVALID_GRAPH_REFERENCE");
            }
            for (const measurement of check.measurements) {
              const created = await transaction.measurement.create({
                data: {
                  caseId: draft.caseId,
                  conditions: measurement.conditions,
                  diagnosticCheckId,
                  maxValue: measurement.maxValue,
                  minValue: measurement.minValue,
                  numericValue: measurement.numericValue,
                  parameter: measurement.parameter,
                  unit: measurement.unit,
                  valueText: measurement.valueText,
                  ...provenanceFor(provenance, measurement.id),
                },
                select: { id: true },
              });
              idsByClientId.set(measurement.id, created.id);
            }
          }

          for (const item of draft.partsMaterials) {
            const created = await transaction.partMaterial.create({
              data: {
                caseId: draft.caseId,
                manufacturer: item.manufacturer,
                name: item.name,
                notes: item.notes,
                partNumber: item.partNumber,
                ...provenanceFor(provenance, item.id),
              },
              select: { id: true },
            });
            idsByClientId.set(item.id, created.id);
          }

          const pendingEvidenceTargets: Array<{
            clientTargetId: string;
            evidenceId: string;
            entityType: string | null;
          }> = [];
          for (const item of draft.evidence) {
            const targetId = item.entityId
              ? idsByClientId.get(item.entityId) ?? null
              : null;
            const created = await transaction.sourceEvidence.create({
              data: {
                caseId: draft.caseId,
                entityId: targetId,
                entityType: targetId ? item.entityType : null,
                evidenceType: item.evidenceType,
                excerpt: item.excerpt,
                pageNumber: item.pageNumber,
                sourceId: storedCase.sourceId,
                ...provenanceFor(provenance, item.id),
              },
              select: { id: true },
            });
            idsByClientId.set(item.id, created.id);
            if (item.entityId && !targetId) {
              pendingEvidenceTargets.push({
                clientTargetId: item.entityId,
                evidenceId: created.id,
                entityType: item.entityType,
              });
            }
          }

          for (const item of draft.relationships) {
            const fromId = idsByClientId.get(item.fromId);
            const toId = idsByClientId.get(item.toId);
            const sourceEvidenceId = item.sourceEvidenceId
              ? idsByClientId.get(item.sourceEvidenceId)
              : null;
            if (!fromId || !toId || (item.sourceEvidenceId && !sourceEvidenceId)) {
              throw new CaseReviewPersistenceError("INVALID_GRAPH_REFERENCE");
            }
            const created = await transaction.relationship.create({
              data: {
                caseId: draft.caseId,
                fromId,
                fromType: item.fromType,
                relationshipType: item.relationshipType,
                sourceEvidenceId,
                toId,
                toType: item.toType,
                ...provenanceFor(provenance, item.id),
              },
              select: { id: true },
            });
            idsByClientId.set(item.id, created.id);
          }

          for (const pending of pendingEvidenceTargets) {
            const entityId = idsByClientId.get(pending.clientTargetId);
            if (entityId) {
              await transaction.sourceEvidence.update({
                where: { id: pending.evidenceId },
                data: { entityId, entityType: pending.entityType },
              });
            }
          }
        }

        const saved = await transaction.case.findUniqueOrThrow({
          where: { id: draft.caseId },
          select: { reviewStatus: true, updatedAt: true },
        });
        return {
          reviewStatus: saved.reviewStatus as "REVIEWED" | "CORRECTED",
          updatedAt: saved.updatedAt.toISOString(),
        };
      },
      { timeout: CASE_REVIEW_TRANSACTION_TIMEOUT_MS },
    );
  }

  async updateLifecycle(
    input: CaseLifecycleAction,
  ): Promise<UpdateCaseLifecycleResult> {
    return this.database.$transaction(async (transaction) => {
      const storedCase = await transaction.case.findUnique({
        where: { id: input.caseId },
        select: {
          reviewStatus: true,
          status: true,
          updatedAt: true,
        },
      });
      if (!storedCase) {
        throw new CaseReviewPersistenceError("CASE_NOT_FOUND");
      }
      if (storedCase.updatedAt.getTime() !== new Date(input.updatedAt).getTime()) {
        throw new CaseReviewPersistenceError("STALE_EDIT");
      }

      const lifecycleStatus =
        input.action === "reject"
          ? "REJECTED"
          : input.action === "archive"
            ? "ARCHIVED"
            : storedCase.status;
      if (
        input.action !== "review" &&
        storedCase.status !== "ACTIVE" &&
        storedCase.status !== lifecycleStatus
      ) {
        throw new CaseReviewPersistenceError("INVALID_LIFECYCLE_TRANSITION");
      }

      const reviewStatus =
        input.action === "review"
          ? storedCase.reviewStatus === "CORRECTED"
            ? "CORRECTED"
            : "REVIEWED"
          : storedCase.reviewStatus;
      const updated = await transaction.case.updateMany({
        where: {
          id: input.caseId,
          updatedAt: new Date(input.updatedAt),
        },
        data: {
          reviewStatus,
          reviewedAt: input.action === "review" ? new Date() : undefined,
          status: lifecycleStatus,
        },
      });
      if (updated.count !== 1) {
        throw new CaseReviewPersistenceError("STALE_EDIT");
      }

      const saved = await transaction.case.findUniqueOrThrow({
        where: { id: input.caseId },
        select: { reviewStatus: true, status: true, updatedAt: true },
      });
      return {
        reviewStatus: saved.reviewStatus,
        status: saved.status,
        updatedAt: saved.updatedAt.toISOString(),
      };
    });
  }
}
