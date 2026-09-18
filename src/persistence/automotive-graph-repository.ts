import { z } from "zod";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type {
  NormalizedAutomotiveCase,
  NormalizedAutomotiveExtraction,
  NormalizedReference,
} from "@/normalization/automotive-normalizer";
import {
  AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
  automotiveExtractionSchema,
  type AutomotiveExtraction,
} from "@/schemas/automotive-extraction.schema";

export interface PersistAutomotiveGraphInput {
  documentId: string;
  extraction: NormalizedAutomotiveExtraction;
  extractionJobId: string;
  sourceId: string;
}

export interface PersistAutomotiveGraphResult {
  caseIds: string[];
}

export interface AcceptedAutomotiveExtractionContext {
  documentId: string;
  extraction: AutomotiveExtraction;
  extractionJobId: string;
  sourceId: string;
}

export interface CompleteAutomotiveGraphResult
  extends PersistAutomotiveGraphResult {
  status: "persisted" | "already_persisted";
}

export class AutomotiveGraphPersistenceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AutomotiveGraphPersistenceError";
  }
}

const AUTOMOTIVE_GRAPH_TRANSACTION_TIMEOUT_MS = 30_000;

const acceptedExtractionArtifactSchema = z.object({
  content: automotiveExtractionSchema,
  quality: z.object({ accepted: z.literal(true) }),
});

async function assertPersistenceOwnership(
  transaction: Prisma.TransactionClient,
  input: Omit<PersistAutomotiveGraphInput, "extraction">,
  allowedStatuses: Array<"PROCESSING" | "PERSISTED">,
): Promise<"PROCESSING" | "PERSISTED"> {
  await transaction.$queryRaw`SELECT id FROM sources WHERE id = ${input.sourceId}::uuid FOR UPDATE`;

  const source = await transaction.source.findUnique({
    where: { id: input.sourceId },
    select: { status: true },
  });
  if (!source || !allowedStatuses.includes(source.status as "PROCESSING" | "PERSISTED")) {
    throw new AutomotiveGraphPersistenceError("SOURCE_NOT_READY_FOR_PERSISTENCE");
  }

  const document = await transaction.document.findFirst({
    where: { id: input.documentId, sourceId: input.sourceId },
    select: { id: true },
  });
  if (!document) {
    throw new AutomotiveGraphPersistenceError("DOCUMENT_OWNERSHIP_INVALID");
  }

  const job = await transaction.extractionJob.findFirst({
    where: {
      id: input.extractionJobId,
      sourceId: input.sourceId,
      status: "COMPLETED",
      promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
    },
    select: { id: true },
  });
  if (!job) {
    throw new AutomotiveGraphPersistenceError("EXTRACTION_JOB_NOT_ACCEPTED");
  }

  return source.status as "PROCESSING" | "PERSISTED";
}

function requiredDatabaseId(
  idsByRef: Map<string, string>,
  reference: NormalizedReference,
): string {
  const id = idsByRef.get(reference.ref);
  if (!id) {
    throw new AutomotiveGraphPersistenceError("DATABASE_REFERENCE_NOT_RESOLVED");
  }
  return id;
}

function requiredCaseSolutionId(
  idsByRef: Map<string, string>,
  reference: NormalizedReference,
): string {
  const id = idsByRef.get(reference.ref);
  if (!id) {
    throw new AutomotiveGraphPersistenceError("CASE_SOLUTION_REFERENCE_NOT_RESOLVED");
  }
  return id;
}

async function persistCase(
  transaction: Prisma.TransactionClient,
  input: Omit<PersistAutomotiveGraphInput, "extraction">,
  normalizedCase: NormalizedAutomotiveCase,
): Promise<string> {
  const storedCase = await transaction.case.create({
    data: {
      sourceId: input.sourceId,
      documentId: input.documentId,
      extractionJobId: input.extractionJobId,
      caseType: normalizedCase.caseType,
      title: normalizedCase.title,
      complaint: normalizedCase.complaint,
      problemDescription: normalizedCase.problemDescription,
      analysisSummary: normalizedCase.analysisSummary,
      status: normalizedCase.status,
      reviewStatus: normalizedCase.reviewStatus,
    },
    select: { id: true },
  });
  const idsByRef = new Map<string, string>([
    [normalizedCase.ref, storedCase.id],
  ]);
  const caseSolutionIdsByRef = new Map<string, string>();

  for (const vehicle of normalizedCase.vehicles) {
    const stored = await transaction.vehicle.upsert({
      where: { normalizedKey: vehicle.lookupKey },
      create: {
        normalizedKey: vehicle.lookupKey,
        brand: vehicle.brand,
        model: vehicle.model,
        generation: vehicle.generation,
        yearFrom: vehicle.yearFrom,
        yearTo: vehicle.yearTo,
        engineDescription: vehicle.engineDescription,
        engineCode: vehicle.engineCode,
        fuelType: vehicle.fuelType,
        power: vehicle.power,
        transmission: vehicle.transmission,
      },
      update: {},
      select: { id: true },
    });
    idsByRef.set(vehicle.ref, stored.id);
    await transaction.caseVehicle.create({
      data: {
        caseId: storedCase.id,
        vehicleId: stored.id,
        relationOrigin: vehicle.relationOrigin,
        confidence: vehicle.confidence,
        compatibilityNote: vehicle.compatibilityNote,
      },
    });
  }

  for (const dtc of normalizedCase.dtcs) {
    const stored = await transaction.dtc.upsert({
      where: { normalizedCode: dtc.normalizedCode },
      create: {
        code: dtc.code,
        normalizedCode: dtc.normalizedCode,
        description: dtc.description,
      },
      update: {},
      select: { id: true },
    });
    idsByRef.set(dtc.ref, stored.id);
    await transaction.caseDtc.create({
      data: {
        caseId: storedCase.id,
        dtcId: stored.id,
        isPrimary: dtc.isPrimary,
        relationshipType: dtc.relationshipType,
        relationOrigin: dtc.relationOrigin,
        confidence: dtc.confidence,
      },
    });
  }

  for (const symptom of normalizedCase.symptoms) {
    const stored = await transaction.symptom.upsert({
      where: { normalizedName: symptom.normalizedName },
      create: { normalizedName: symptom.normalizedName },
      update: {},
      select: { id: true },
    });
    idsByRef.set(symptom.ref, stored.id);
    await transaction.caseSymptom.create({
      data: {
        caseId: storedCase.id,
        symptomId: stored.id,
        description: symptom.description,
        relationOrigin: symptom.relationOrigin,
        confidence: symptom.confidence,
      },
    });
  }

  for (const cause of normalizedCase.causes) {
    const stored = await transaction.cause.upsert({
      where: { normalizedName: cause.normalizedName },
      create: { normalizedName: cause.normalizedName },
      update: {},
      select: { id: true },
    });
    idsByRef.set(cause.ref, stored.id);
    await transaction.caseCause.create({
      data: {
        caseId: storedCase.id,
        causeId: stored.id,
        description: cause.description,
        probabilitySource: cause.probabilitySource,
        probabilityCalculated: cause.probabilityCalculated,
        relationOrigin: cause.relationOrigin,
        confidence: cause.confidence,
      },
    });
  }

  for (const component of normalizedCase.components) {
    const stored = await transaction.component.upsert({
      where: { normalizedName: component.normalizedName },
      create: {
        name: component.name,
        normalizedName: component.normalizedName,
        componentType: component.componentType,
      },
      update: {},
      select: { id: true },
    });
    idsByRef.set(component.ref, stored.id);
    await transaction.caseComponent.create({
      data: {
        caseId: storedCase.id,
        componentId: stored.id,
        role: component.role,
        relationOrigin: component.relationOrigin,
        confidence: component.confidence,
      },
    });
  }

  for (const check of normalizedCase.diagnosticChecks) {
    const stored = await transaction.diagnosticCheck.create({
      data: {
        caseId: storedCase.id,
        description: check.description,
        expectedResult: check.expectedResult,
        actualResult: check.actualResult,
        interpretation: check.interpretation,
        sequenceOrder: check.sequenceOrder,
        relationOrigin: check.relationOrigin,
        confidence: check.confidence,
      },
      select: { id: true },
    });
    idsByRef.set(check.ref, stored.id);
  }

  for (const solution of normalizedCase.solutions) {
    const stored = await transaction.solution.upsert({
      where: { normalizedName: solution.normalizedName },
      create: { normalizedName: solution.normalizedName },
      update: {},
      select: { id: true },
    });
    idsByRef.set(solution.ref, stored.id);
    const association = await transaction.caseSolution.create({
      data: {
        caseId: storedCase.id,
        solutionId: stored.id,
        description: solution.description,
        probabilitySource: solution.probabilitySource,
        probabilityCalculated: solution.probabilityCalculated,
        repairConfirmed: solution.repairConfirmed,
        repairSuccessful: solution.repairSuccessful,
        relationOrigin: solution.relationOrigin,
        confidence: solution.confidence,
      },
      select: { id: true },
    });
    caseSolutionIdsByRef.set(solution.ref, association.id);
  }

  for (const procedure of normalizedCase.repairProcedures) {
    const stored = await transaction.repairProcedure.create({
      data: {
        caseId: storedCase.id,
        caseSolutionId: procedure.solution
          ? requiredCaseSolutionId(caseSolutionIdsByRef, procedure.solution)
          : null,
        sequenceOrder: procedure.sequenceOrder,
        instruction: procedure.instruction,
        relationOrigin: procedure.relationOrigin,
        confidence: procedure.confidence,
      },
      select: { id: true },
    });
    idsByRef.set(procedure.ref, stored.id);
  }

  for (const measurement of normalizedCase.measurements) {
    const stored = await transaction.measurement.create({
      data: {
        caseId: storedCase.id,
        diagnosticCheckId: measurement.diagnosticCheck
          ? requiredDatabaseId(idsByRef, measurement.diagnosticCheck)
          : null,
        parameter: measurement.parameter,
        valueText: measurement.valueText,
        numericValue: measurement.numericValue,
        unit: measurement.unit,
        conditions: measurement.conditions,
        minValue: measurement.minValue,
        maxValue: measurement.maxValue,
        relationOrigin: measurement.relationOrigin,
        confidence: measurement.confidence,
      },
      select: { id: true },
    });
    idsByRef.set(measurement.ref, stored.id);
  }

  for (const material of normalizedCase.partsMaterials) {
    const stored = await transaction.partMaterial.create({
      data: {
        caseId: storedCase.id,
        name: material.name,
        partNumber: material.partNumber,
        manufacturer: material.manufacturer,
        notes: material.notes,
        relationOrigin: material.relationOrigin,
        confidence: material.confidence,
      },
      select: { id: true },
    });
    idsByRef.set(material.ref, stored.id);
  }

  for (const outcome of normalizedCase.repairOutcomes) {
    const stored = await transaction.repairOutcome.create({
      data: {
        caseId: storedCase.id,
        caseSolutionId: outcome.solution
          ? requiredCaseSolutionId(caseSolutionIdsByRef, outcome.solution)
          : null,
        attempted: outcome.attempted,
        successful: outcome.successful,
        confirmed: outcome.confirmed,
        caseCount: outcome.caseCount,
        successfulCaseCount: outcome.successfulCaseCount,
        notes: outcome.notes,
      },
      select: { id: true },
    });
    idsByRef.set(outcome.ref, stored.id);
  }

  const pendingEvidenceTargets: Array<{
    evidenceId: string;
    target: NormalizedReference;
  }> = [];
  for (const evidence of normalizedCase.evidence) {
    const targetId = evidence.target
      ? idsByRef.get(evidence.target.ref) ?? null
      : null;
    const stored = await transaction.sourceEvidence.create({
      data: {
        sourceId: input.sourceId,
        caseId: storedCase.id,
        entityType: evidence.target?.type ?? null,
        entityId: targetId,
        pageNumber: evidence.pageNumber,
        excerpt: evidence.excerpt,
        evidenceType: evidence.evidenceType,
        relationOrigin: evidence.relationOrigin,
        confidence: evidence.confidence,
      },
      select: { id: true },
    });
    idsByRef.set(evidence.ref, stored.id);
    if (evidence.target && !targetId) {
      pendingEvidenceTargets.push({ evidenceId: stored.id, target: evidence.target });
    }
  }

  for (const relationship of normalizedCase.relationships) {
    const stored = await transaction.relationship.create({
      data: {
        caseId: storedCase.id,
        fromType: relationship.fromType,
        fromId: requiredDatabaseId(idsByRef, relationship.from),
        relationshipType: relationship.relationshipType,
        toType: relationship.toType,
        toId: requiredDatabaseId(idsByRef, relationship.to),
        relationOrigin: relationship.relationOrigin,
        confidence: relationship.confidence,
        sourceEvidenceId: relationship.evidence
          ? requiredDatabaseId(idsByRef, relationship.evidence)
          : null,
      },
      select: { id: true },
    });
    idsByRef.set(relationship.ref, stored.id);
  }

  for (const pending of pendingEvidenceTargets) {
    await transaction.sourceEvidence.update({
      where: { id: pending.evidenceId },
      data: { entityId: requiredDatabaseId(idsByRef, pending.target) },
    });
  }

  return storedCase.id;
}

export class AutomotiveGraphRepository {
  constructor(private readonly database: PrismaClient) {}

  async loadAcceptedExtraction(
    rawSourceId: string,
  ): Promise<AcceptedAutomotiveExtractionContext> {
    const sourceId = z.uuid().parse(rawSourceId);
    const source = await this.database.source.findUnique({
      where: { id: sourceId },
      select: {
        status: true,
        documents: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true },
          take: 1,
        },
        extractionJobs: {
          where: {
            status: "COMPLETED",
            promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, validatedOutput: true },
          take: 1,
        },
      },
    });

    if (!source) {
      throw new AutomotiveGraphPersistenceError("SOURCE_NOT_FOUND");
    }
    if (!(["PROCESSING", "PERSISTED"] as const).includes(
      source.status as "PROCESSING" | "PERSISTED",
    )) {
      throw new AutomotiveGraphPersistenceError("SOURCE_NOT_READY_FOR_PERSISTENCE");
    }

    const document = source.documents[0];
    if (!document) {
      throw new AutomotiveGraphPersistenceError("DOCUMENT_NOT_FOUND");
    }
    const job = source.extractionJobs[0];
    if (!job) {
      throw new AutomotiveGraphPersistenceError("ACCEPTED_EXTRACTION_NOT_FOUND");
    }
    const artifact = acceptedExtractionArtifactSchema.safeParse(
      job.validatedOutput,
    );
    if (!artifact.success) {
      throw new AutomotiveGraphPersistenceError(
        "ACCEPTED_EXTRACTION_ARTIFACT_INVALID",
      );
    }

    return {
      documentId: document.id,
      extraction: artifact.data.content,
      extractionJobId: job.id,
      sourceId,
    };
  }

  async persist(
    rawInput: PersistAutomotiveGraphInput,
  ): Promise<PersistAutomotiveGraphResult> {
    const input = {
      ...rawInput,
      sourceId: z.uuid().parse(rawInput.sourceId),
      documentId: z.uuid().parse(rawInput.documentId),
      extractionJobId: z.uuid().parse(rawInput.extractionJobId),
    };

    return this.database.$transaction(
      async (transaction) => {
        await assertPersistenceOwnership(transaction, input, ["PROCESSING"]);
        const existingCase = await transaction.case.findFirst({
          where: { extractionJobId: input.extractionJobId },
          select: { id: true },
        });
        if (existingCase) {
          throw new AutomotiveGraphPersistenceError("EXTRACTION_ALREADY_PERSISTED");
        }
        const caseIds: string[] = [];

        for (const normalizedCase of input.extraction.cases) {
          caseIds.push(await persistCase(transaction, input, normalizedCase));
        }

        return { caseIds };
      },
      { timeout: AUTOMOTIVE_GRAPH_TRANSACTION_TIMEOUT_MS },
    );
  }

  async persistAndCompleteSource(
    rawInput: PersistAutomotiveGraphInput,
  ): Promise<CompleteAutomotiveGraphResult> {
    const input = {
      ...rawInput,
      sourceId: z.uuid().parse(rawInput.sourceId),
      documentId: z.uuid().parse(rawInput.documentId),
      extractionJobId: z.uuid().parse(rawInput.extractionJobId),
    };

    return this.database.$transaction(
      async (transaction) => {
        const sourceStatus = await assertPersistenceOwnership(
          transaction,
          input,
          ["PROCESSING", "PERSISTED"],
        );
        const existingCases = await transaction.case.findMany({
          where: { extractionJobId: input.extractionJobId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });

        if (
          existingCases.length > 0 &&
          existingCases.length !== input.extraction.cases.length
        ) {
          throw new AutomotiveGraphPersistenceError(
            "PERSISTED_CASE_COUNT_MISMATCH",
          );
        }

        if (sourceStatus === "PERSISTED") {
          if (existingCases.length !== input.extraction.cases.length) {
            throw new AutomotiveGraphPersistenceError(
              "PERSISTED_CASE_COUNT_MISMATCH",
            );
          }
          return {
            status: "already_persisted",
            caseIds: existingCases.map((item) => item.id),
          };
        }

        const caseIds = existingCases.map((item) => item.id);
        if (existingCases.length === 0) {
          for (const normalizedCase of input.extraction.cases) {
            caseIds.push(await persistCase(transaction, input, normalizedCase));
          }
        }

        await transaction.source.update({
          where: { id: input.sourceId },
          data: { status: "PERSISTED" },
        });

        return { status: "persisted", caseIds };
      },
      { timeout: AUTOMOTIVE_GRAPH_TRANSACTION_TIMEOUT_MS },
    );
  }
}
