import "server-only";

import { z } from "zod";

import { getDatabaseClient } from "@/db/client";
import { pageContentSchema } from "@/schemas/pdf-text-extraction.schema";

const usageSchema = z.strictObject({
  cachedTokens: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative(),
});

const qualitySchema = z.strictObject({
  accepted: z.boolean(),
  characterCount: z.number().int().nonnegative(),
  nonEmptyPages: z.number().int().nonnegative(),
  reasons: z.array(z.string()),
  version: z.string(),
  warnings: z.array(
    z.strictObject({
      code: z.string(),
      pageNumber: z.number().int().positive().nullable(),
    }),
  ),
});

const documentMetadataSchema = z.looseObject({
  author: z.string().nullable().optional(),
  extractionMethod: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  quality: qualitySchema.optional(),
  reviewStatus: z.string().optional(),
  sourceDate: z.string().nullable().optional(),
  transferMethod: z.string().optional(),
  usage: usageSchema.nullable().optional(),
});

const validatedAttemptSchema = z.looseObject({
  usage: usageSchema.nullable().optional(),
});

type OriginFields = {
  confidence: string | null;
  relationOrigin: string;
};

export interface AutomotiveCaseDetail {
  analysisSummary: string | null;
  caseType: string | null;
  causes: Array<OriginFields & {
    description: string | null;
    id: string;
    name: string;
    nodeId: string;
    probabilitySource: string | null;
  }>;
  complaint: string | null;
  components: Array<OriginFields & {
    componentType: string | null;
    id: string;
    name: string;
    nodeId: string;
    role: string | null;
  }>;
  createdAt: string;
  diagnosticChecks: Array<OriginFields & {
    actualResult: string | null;
    description: string;
    expectedResult: string | null;
    id: string;
    interpretation: string | null;
    measurements: Array<OriginFields & {
      conditions: string | null;
      id: string;
      maxValue: string | null;
      minValue: string | null;
      numericValue: string | null;
      parameter: string;
      unit: string | null;
      valueText: string | null;
    }>;
    sequenceOrder: number | null;
  }>;
  dtcs: Array<OriginFields & {
    code: string;
    description: string | null;
    id: string;
    isPrimary: boolean;
    nodeId: string;
    relationshipType: string;
  }>;
  evidence: Array<OriginFields & {
    entityId: string | null;
    entityType: string | null;
    evidenceType: string;
    excerpt: string;
    id: string;
    pageNumber: number | null;
  }>;
  id: string;
  partsMaterials: Array<OriginFields & {
    id: string;
    manufacturer: string | null;
    name: string;
    notes: string | null;
    partNumber: string | null;
  }>;
  problemDescription: string | null;
  relationships: Array<OriginFields & {
    evidence: {
      excerpt: string;
      pageNumber: number | null;
    } | null;
    fromId: string;
    fromLabel: string | null;
    fromType: string;
    id: string;
    relationshipType: string;
    sourceEvidenceId: string | null;
    toId: string;
    toLabel: string | null;
    toType: string;
  }>;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewStatus: string;
  solutions: Array<OriginFields & {
    description: string | null;
    id: string;
    name: string;
    nodeId: string;
    outcomes: Array<{
      attempted: boolean | null;
      caseCount: number | null;
      confirmed: boolean | null;
      id: string;
      notes: string | null;
      successful: boolean | null;
      successfulCaseCount: number | null;
    }>;
    probabilitySource: string | null;
    procedures: Array<OriginFields & {
      id: string;
      instruction: string;
      sequenceOrder: number;
    }>;
    repairConfirmed: boolean | null;
    repairSuccessful: boolean | null;
  }>;
  status: string;
  symptoms: Array<OriginFields & {
    description: string | null;
    id: string;
    name: string;
    nodeId: string;
  }>;
  title: string | null;
  updatedAt: string;
  vehicles: Array<OriginFields & {
    brand: string | null;
    compatibilityNote: string | null;
    engineCode: string | null;
    engineDescription: string | null;
    fuelType: string | null;
    generation: string | null;
    id: string;
    model: string | null;
    power: string | null;
    transmission: string | null;
    yearFrom: number | null;
    yearTo: number | null;
  }>;
}

export interface SourceDetail {
  automotiveCases: AutomotiveCaseDetail[];
  author: string | null;
  characterCount: number;
  createdAt: string;
  document: {
    author: string | null;
    createdAt: string;
    id: string;
    language: string | null;
    model: string | null;
    pageCount: number;
    pages: Array<z.infer<typeof pageContentSchema>>;
    promptVersion: string | null;
    quality: z.infer<typeof qualitySchema> | null;
    reviewStatus: string | null;
    sourceDate: string | null;
    title: string | null;
  } | null;
  extractionJobs: Array<{
    durationMs: number | null;
    errorCode: string | null;
    finishedAt: string | null;
    id: string;
    model: string | null;
    promptVersion: string | null;
    startedAt: string | null;
    status: string;
    usage: z.infer<typeof usageSchema> | null;
  }>;
  id: string;
  originalFilename: string | null;
  sourceDate: string | null;
  status: string;
  type: string;
  updatedAt: string;
}

export async function getSourceDetail(
  sourceId: string,
): Promise<SourceDetail | null> {
  const parsedSourceId = z.uuid().safeParse(sourceId);

  if (!parsedSourceId.success) return null;

  const source = await getDatabaseClient().source.findUnique({
    where: { id: parsedSourceId.data },
    select: {
      author: true,
      createdAt: true,
      documents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          createdAt: true,
          id: true,
          language: true,
          metadataJson: true,
          pageCount: true,
          pagesJson: true,
          title: true,
        },
        take: 1,
      },
      extractionJobs: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          error: true,
          finishedAt: true,
          id: true,
          model: true,
          promptVersion: true,
          startedAt: true,
          status: true,
          validatedOutput: true,
        },
      },
      cases: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          caseType: true,
          analysisSummary: true,
          causes: {
            orderBy: { id: "asc" },
            select: {
              cause: { select: { id: true, normalizedName: true } },
              confidence: true,
              description: true,
              id: true,
              probabilitySource: true,
              relationOrigin: true,
            },
          },
          complaint: true,
          components: {
            orderBy: { id: "asc" },
            select: {
              component: {
                select: { componentType: true, id: true, name: true },
              },
              confidence: true,
              id: true,
              relationOrigin: true,
              role: true,
            },
          },
          createdAt: true,
          diagnosticChecks: {
            orderBy: [{ sequenceOrder: "asc" }, { id: "asc" }],
            select: {
              actualResult: true,
              confidence: true,
              description: true,
              expectedResult: true,
              id: true,
              interpretation: true,
              measurements: {
                orderBy: { id: "asc" },
                select: {
                  conditions: true,
                  confidence: true,
                  id: true,
                  maxValue: true,
                  minValue: true,
                  numericValue: true,
                  parameter: true,
                  relationOrigin: true,
                  unit: true,
                  valueText: true,
                },
              },
              relationOrigin: true,
              sequenceOrder: true,
            },
          },
          dtcs: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: {
              confidence: true,
              dtc: { select: { code: true, description: true, id: true } },
              id: true,
              isPrimary: true,
              relationOrigin: true,
              relationshipType: true,
            },
          },
          evidence: {
            orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
            select: {
              confidence: true,
              entityId: true,
              entityType: true,
              evidenceType: true,
              excerpt: true,
              id: true,
              pageNumber: true,
              relationOrigin: true,
            },
          },
          id: true,
          partsMaterials: {
            orderBy: { id: "asc" },
            select: {
              confidence: true,
              id: true,
              manufacturer: true,
              name: true,
              notes: true,
              partNumber: true,
              relationOrigin: true,
            },
          },
          problemDescription: true,
          relationships: {
            orderBy: { id: "asc" },
            select: {
              confidence: true,
              fromId: true,
              fromType: true,
              id: true,
              relationshipType: true,
              relationOrigin: true,
              sourceEvidence: {
                select: { excerpt: true, id: true, pageNumber: true },
              },
              toId: true,
              toType: true,
            },
          },
          reviewedAt: true,
          reviewNotes: true,
          reviewStatus: true,
          solutions: {
            orderBy: { id: "asc" },
            select: {
              confidence: true,
              description: true,
              id: true,
              outcomes: {
                orderBy: { id: "asc" },
                select: {
                  attempted: true,
                  caseCount: true,
                  confirmed: true,
                  id: true,
                  notes: true,
                  successful: true,
                  successfulCaseCount: true,
                },
              },
              probabilitySource: true,
              procedures: {
                orderBy: [{ sequenceOrder: "asc" }, { id: "asc" }],
                select: {
                  confidence: true,
                  id: true,
                  instruction: true,
                  relationOrigin: true,
                  sequenceOrder: true,
                },
              },
              relationOrigin: true,
              repairConfirmed: true,
              repairSuccessful: true,
              solution: { select: { id: true, normalizedName: true } },
            },
          },
          status: true,
          symptoms: {
            orderBy: { id: "asc" },
            select: {
              confidence: true,
              description: true,
              id: true,
              relationOrigin: true,
              symptom: { select: { id: true, normalizedName: true } },
            },
          },
          title: true,
          updatedAt: true,
          vehicles: {
            orderBy: { id: "asc" },
            select: {
              compatibilityNote: true,
              confidence: true,
              id: true,
              relationOrigin: true,
              vehicle: {
                select: {
                  brand: true,
                  engineCode: true,
                  engineDescription: true,
                  fuelType: true,
                  generation: true,
                  model: true,
                  power: true,
                  transmission: true,
                  yearFrom: true,
                  yearTo: true,
                },
              },
            },
          },
        },
      },
      id: true,
      originalFilename: true,
      rawText: true,
      sourceDate: true,
      status: true,
      type: true,
      updatedAt: true,
    },
  });

  if (!source) return null;

  const storedDocument = source.documents[0];
  const pages = z.array(pageContentSchema).safeParse(storedDocument?.pagesJson);
  const metadata = documentMetadataSchema.safeParse(storedDocument?.metadataJson);
  const document = storedDocument && pages.success
    ? {
        author: metadata.success ? (metadata.data.author ?? null) : null,
        createdAt: storedDocument.createdAt.toISOString(),
        id: storedDocument.id,
        language: storedDocument.language,
        model: metadata.success ? (metadata.data.model ?? null) : null,
        pageCount: storedDocument.pageCount ?? pages.data.length,
        pages: pages.data,
        promptVersion: metadata.success
          ? (metadata.data.promptVersion ?? null)
          : null,
        quality: metadata.success ? (metadata.data.quality ?? null) : null,
        reviewStatus: metadata.success
          ? (metadata.data.reviewStatus ?? null)
          : null,
        sourceDate: metadata.success
          ? (metadata.data.sourceDate ?? null)
          : null,
        title: storedDocument.title,
      }
    : null;

  return {
    author: source.author,
    automotiveCases: source.cases.map((storedCase) => {
      function relationshipNodeLabel(type: string, id: string): string | null {
        switch (type) {
          case "DTC":
            return storedCase.dtcs.find((item) => item.dtc.id === id)?.dtc.code ?? null;
          case "SYMPTOM":
            return storedCase.symptoms.find((item) => item.symptom.id === id)?.symptom.normalizedName ?? null;
          case "CAUSE":
            return storedCase.causes.find((item) => item.cause.id === id)?.cause.normalizedName ?? null;
          case "DIAGNOSTIC_CHECK":
            return storedCase.diagnosticChecks.find((item) => item.id === id)?.description ?? null;
          case "SOLUTION":
            return storedCase.solutions.find((item) => item.solution.id === id)?.solution.normalizedName ?? null;
          case "REPAIR_OUTCOME":
            return storedCase.solutions
              .flatMap((item) => item.outcomes)
              .find((item) => item.id === id)?.notes ?? null;
          default:
            return null;
        }
      }

      return {
      analysisSummary: storedCase.analysisSummary,
      caseType: storedCase.caseType,
      causes: storedCase.causes.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        description: item.description,
        id: item.id,
        name: item.cause.normalizedName,
        nodeId: item.cause.id,
        probabilitySource: item.probabilitySource,
        relationOrigin: item.relationOrigin,
      })),
      complaint: storedCase.complaint,
      components: storedCase.components.map((item) => ({
        componentType: item.component.componentType,
        confidence: item.confidence?.toString() ?? null,
        id: item.id,
        name: item.component.name,
        nodeId: item.component.id,
        relationOrigin: item.relationOrigin,
        role: item.role,
      })),
      createdAt: storedCase.createdAt.toISOString(),
      diagnosticChecks: storedCase.diagnosticChecks.map((item) => ({
        actualResult: item.actualResult,
        confidence: item.confidence?.toString() ?? null,
        description: item.description,
        expectedResult: item.expectedResult,
        id: item.id,
        interpretation: item.interpretation,
        measurements: item.measurements.map((measurement) => ({
          conditions: measurement.conditions,
          confidence: measurement.confidence?.toString() ?? null,
          id: measurement.id,
          maxValue: measurement.maxValue?.toString() ?? null,
          minValue: measurement.minValue?.toString() ?? null,
          numericValue: measurement.numericValue?.toString() ?? null,
          parameter: measurement.parameter,
          relationOrigin: measurement.relationOrigin,
          unit: measurement.unit,
          valueText: measurement.valueText,
        })),
        relationOrigin: item.relationOrigin,
        sequenceOrder: item.sequenceOrder,
      })),
      dtcs: storedCase.dtcs.map((item) => ({
        code: item.dtc.code,
        confidence: item.confidence?.toString() ?? null,
        description: item.dtc.description,
        id: item.id,
        isPrimary: item.isPrimary,
        nodeId: item.dtc.id,
        relationOrigin: item.relationOrigin,
        relationshipType: item.relationshipType,
      })),
      evidence: storedCase.evidence.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        entityId: item.entityId,
        entityType: item.entityType,
        evidenceType: item.evidenceType,
        excerpt: item.excerpt,
        id: item.id,
        pageNumber: item.pageNumber,
        relationOrigin: item.relationOrigin,
      })),
      id: storedCase.id,
      partsMaterials: storedCase.partsMaterials.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        id: item.id,
        manufacturer: item.manufacturer,
        name: item.name,
        notes: item.notes,
        partNumber: item.partNumber,
        relationOrigin: item.relationOrigin,
      })),
      problemDescription: storedCase.problemDescription,
      relationships: storedCase.relationships.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        evidence: item.sourceEvidence,
        fromId: item.fromId,
        fromLabel: relationshipNodeLabel(item.fromType, item.fromId),
        fromType: item.fromType,
        id: item.id,
        relationshipType: item.relationshipType,
        relationOrigin: item.relationOrigin,
        sourceEvidenceId: item.sourceEvidence?.id ?? null,
        toId: item.toId,
        toLabel: relationshipNodeLabel(item.toType, item.toId),
        toType: item.toType,
      })),
      reviewedAt: storedCase.reviewedAt?.toISOString() ?? null,
      reviewNotes: storedCase.reviewNotes,
      reviewStatus: storedCase.reviewStatus,
      solutions: storedCase.solutions.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        description: item.description,
        id: item.id,
        name: item.solution.normalizedName,
        nodeId: item.solution.id,
        outcomes: item.outcomes,
        probabilitySource: item.probabilitySource,
        procedures: item.procedures.map((procedure) => ({
          confidence: procedure.confidence?.toString() ?? null,
          id: procedure.id,
          instruction: procedure.instruction,
          relationOrigin: procedure.relationOrigin,
          sequenceOrder: procedure.sequenceOrder,
        })),
        relationOrigin: item.relationOrigin,
        repairConfirmed: item.repairConfirmed,
        repairSuccessful: item.repairSuccessful,
      })),
      status: storedCase.status,
      symptoms: storedCase.symptoms.map((item) => ({
        confidence: item.confidence?.toString() ?? null,
        description: item.description,
        id: item.id,
        name: item.symptom.normalizedName,
        nodeId: item.symptom.id,
        relationOrigin: item.relationOrigin,
      })),
      title: storedCase.title,
      updatedAt: storedCase.updatedAt.toISOString(),
      vehicles: storedCase.vehicles.map((item) => ({
        ...item.vehicle,
        compatibilityNote: item.compatibilityNote,
        confidence: item.confidence?.toString() ?? null,
        id: item.id,
        relationOrigin: item.relationOrigin,
      })),
      };
    }),
    characterCount:
      document?.quality?.characterCount ?? source.rawText?.length ?? 0,
    createdAt: source.createdAt.toISOString(),
    document,
    extractionJobs: source.extractionJobs.map((job) => {
      const validated = validatedAttemptSchema.safeParse(job.validatedOutput);

      return {
        durationMs:
          job.startedAt && job.finishedAt
            ? Math.max(0, job.finishedAt.getTime() - job.startedAt.getTime())
            : null,
        errorCode: job.error,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        id: job.id,
        model: job.model,
        promptVersion: job.promptVersion,
        startedAt: job.startedAt?.toISOString() ?? null,
        status: job.status,
        usage: validated.success ? (validated.data.usage ?? null) : null,
      };
    }),
    id: source.id,
    originalFilename: source.originalFilename,
    sourceDate: source.sourceDate?.toISOString() ?? null,
    status: source.status,
    type: source.type,
    updatedAt: source.updatedAt.toISOString(),
  };
}

export async function getCaseReviewSource(
  caseId: string,
): Promise<SourceDetail | null> {
  const parsedCaseId = z.uuid().safeParse(caseId);

  if (!parsedCaseId.success) return null;

  const storedCase = await getDatabaseClient().case.findUnique({
    where: { id: parsedCaseId.data },
    select: { sourceId: true },
  });

  if (!storedCase) return null;

  const source = await getSourceDetail(storedCase.sourceId);
  const selectedCase = source?.automotiveCases.find(
    (item) => item.id === parsedCaseId.data,
  );

  if (!source || !selectedCase) return null;

  return { ...source, automotiveCases: [selectedCase] };
}
