import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import type { AutomotiveKnowledgeExtractionResult } from "@/ai/automotive-knowledge-extractor";
import type { AutomotiveModelRoute } from "@/automotive-extraction/automotive-model-routing";
import { AutomotiveExtractionStateError } from "@/automotive-extraction/automotive-model-routing";
import type { AutomotiveQualityResult } from "@/automotive-extraction/automotive-quality";
import { automotiveExtractionPromptInputSchema } from "@/prompts/automotive-extraction.prompt";
import { AUTOMOTIVE_EXTRACTION_PROMPT_VERSION } from "@/schemas/automotive-extraction.schema";

const STALE_ATTEMPT_MS = 10 * 60 * 1000;

export type AutomotiveExtractionClaim =
  | { status: "already_processed"; extractionJobId: string }
  | { status: "busy" }
  | {
      status: "claimed";
      jobId: string;
      input: ReturnType<typeof automotiveExtractionPromptInputSchema.parse>;
    };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockSource(
  transaction: Prisma.TransactionClient,
  sourceId: string,
): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM sources WHERE id = ${sourceId}::uuid FOR UPDATE`;
}

async function assertOwnership(
  transaction: Prisma.TransactionClient,
  sourceId: string,
  jobId: string,
): Promise<void> {
  await lockSource(transaction, sourceId);
  const job = await transaction.extractionJob.findFirst({
    where: {
      id: jobId,
      sourceId,
      status: "RUNNING",
      source: { status: "PROCESSING" },
    },
    select: { id: true },
  });

  if (!job) {
    throw new AutomotiveExtractionStateError(
      "AUTOMOTIVE_EXTRACTION_OWNERSHIP_LOST",
    );
  }
}

function newJob(
  sourceId: string,
  route: AutomotiveModelRoute,
  triggerReason: string | null,
) {
  return {
    sourceId,
    model: route.model,
    promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
    status: "RUNNING" as const,
    startedAt: new Date(),
    rawAiOutput: json({
      format: "response-json-string-v1",
      responseJson: null,
      route,
      triggerReason,
    }),
  };
}

export class AutomotiveExtractionRepository {
  constructor(private readonly database: PrismaClient) {}

  async claim(
    sourceId: string,
    route: AutomotiveModelRoute,
  ): Promise<AutomotiveExtractionClaim> {
    return this.database.$transaction(async (transaction) => {
      await lockSource(transaction, sourceId);
      const source = await transaction.source.findUnique({
        where: { id: sourceId },
        include: {
          documents: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      });

      if (!source) {
        throw new AutomotiveExtractionStateError("SOURCE_NOT_FOUND");
      }

      const completedJob = await transaction.extractionJob.findFirst({
        where: {
          sourceId,
          status: "COMPLETED",
          promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      if (completedJob) {
        return {
          status: "already_processed",
          extractionJobId: completedJob.id,
        };
      }

      const document = source.documents[0];
      if (!document || document.pageCount === null || !document.pagesJson) {
        throw new AutomotiveExtractionStateError("SOURCE_TEXT_NOT_READY");
      }

      if (source.status === "PROCESSING") {
        if (source.updatedAt.getTime() > Date.now() - STALE_ATTEMPT_MS) {
          return { status: "busy" };
        }

        await transaction.extractionJob.updateMany({
          where: {
            sourceId,
            status: "RUNNING",
            promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
          },
          data: {
            status: "FAILED",
            error: "ATTEMPT_INTERRUPTED",
            finishedAt: new Date(),
          },
        });
      } else if (
        !["TEXT_EXTRACTED", "SCHEMA_INVALID", "FAILED"].includes(
          source.status,
        )
      ) {
        throw new AutomotiveExtractionStateError("SOURCE_NOT_ELIGIBLE");
      }

      const metadata = document.metadataJson as {
        author?: unknown;
        sourceDate?: unknown;
      } | null;
      const input = automotiveExtractionPromptInputSchema.parse({
        originalFilename: source.originalFilename,
        document: {
          title: document.title,
          author: typeof metadata?.author === "string" ? metadata.author : null,
          sourceDate:
            typeof metadata?.sourceDate === "string"
              ? metadata.sourceDate
              : null,
          language: document.language,
          pageCount: document.pageCount,
          pages: document.pagesJson,
        },
      });

      await transaction.source.update({
        where: { id: sourceId },
        data: { status: "PROCESSING" },
      });
      const job = await transaction.extractionJob.create({
        data: newJob(sourceId, route, null),
      });

      return { status: "claimed", jobId: job.id, input };
    });
  }

  async saveRaw(
    sourceId: string,
    jobId: string,
    rawResponse: unknown,
    route: AutomotiveModelRoute,
    triggerReason: string | null,
  ): Promise<void> {
    const responseJson = JSON.stringify(rawResponse);

    await this.database.$transaction(async (transaction) => {
      await assertOwnership(transaction, sourceId, jobId);
      await transaction.extractionJob.update({
        where: { id: jobId },
        data: {
          rawAiOutput: json({
            format: "response-json-string-v1",
            responseJson,
            route,
            triggerReason,
          }),
        },
      });
    });
  }

  async saveValidated(
    sourceId: string,
    jobId: string,
    result: AutomotiveKnowledgeExtractionResult,
    quality: AutomotiveQualityResult,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await assertOwnership(transaction, sourceId, jobId);
      await transaction.extractionJob.update({
        where: { id: jobId },
        data: {
          model: result.model,
          validatedOutput: json({
            content: result.output,
            quality,
            responseId: result.responseId,
            reasoningEffort: result.reasoningEffort,
            usage: result.usage,
          }),
        },
      });
    });
  }

  async failAttempt(
    sourceId: string,
    jobId: string,
    code: string,
    schemaInvalid: boolean,
    nextRoute: AutomotiveModelRoute | null,
  ): Promise<string | null> {
    return this.database.$transaction(async (transaction) => {
      await assertOwnership(transaction, sourceId, jobId);
      await transaction.extractionJob.update({
        where: { id: jobId },
        data: {
          status: schemaInvalid ? "SCHEMA_INVALID" : "FAILED",
          error: code,
          finishedAt: new Date(),
        },
      });
      await transaction.source.update({
        where: { id: sourceId },
        data: {
          status: nextRoute
            ? "PROCESSING"
            : schemaInvalid
              ? "SCHEMA_INVALID"
              : "FAILED",
        },
      });

      if (!nextRoute) return null;

      const nextJob = await transaction.extractionJob.create({
        data: newJob(sourceId, nextRoute, code),
      });
      return nextJob.id;
    });
  }

  async complete(sourceId: string, jobId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await assertOwnership(transaction, sourceId, jobId);
      await transaction.extractionJob.update({
        where: { id: jobId },
        data: { status: "COMPLETED", finishedAt: new Date(), error: null },
      });
    });
  }
}
