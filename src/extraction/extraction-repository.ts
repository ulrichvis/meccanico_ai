import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { ModelRoute } from "@/extraction/model-routing";
import type { OpenAIPdfTextExtractionResult } from "@/ai/openai-pdf-text-extractor";
import { buildRawText } from "@/schemas/pdf-text-extraction.schema";
import { parseSourceDate, type TextQualityResult } from "@/extraction/text-quality";
import { PDF_TEXT_EXTRACTION_PROMPT_VERSION } from "@/prompts/pdf-text-extraction.prompt";

const STALE_ATTEMPT_MS = 10 * 60 * 1000;
export class ExtractionStateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ExtractionStateError";
  }
}

export type ExtractionClaim =
  | { status: "already_processed"; documentId: string }
  | { status: "busy" }
  | { status: "claimed"; jobId: string; storagePath: string };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockSource(tx: Prisma.TransactionClient, sourceId: string) {
  await tx.$queryRaw`SELECT id FROM sources WHERE id = ${sourceId}::uuid FOR UPDATE`;
}

async function assertOwnership(tx: Prisma.TransactionClient, sourceId: string, jobId: string) {
  await lockSource(tx, sourceId);
  const job = await tx.extractionJob.findFirst({
    where: { id: jobId, sourceId, status: "RUNNING", source: { status: "EXTRACTING_TEXT" } },
    select: { id: true },
  });
  if (!job) throw new ExtractionStateError("EXTRACTION_OWNERSHIP_LOST");
}

function newJob(sourceId: string, route: ModelRoute, reason: string | null) {
  return {
    sourceId, model: route.model, promptVersion: PDF_TEXT_EXTRACTION_PROMPT_VERSION,
    status: "RUNNING" as const, startedAt: new Date(),
    // Retained in rawAiOutput when the response arrives, including failed attempts.
    rawAiOutput: json({ format: "response-json-string-v1", responseJson: null, route, triggerReason: reason }),
  };
}

export class ExtractionRepository {
  constructor(private readonly database: PrismaClient) {}

  async claim(sourceId: string, route: ModelRoute): Promise<ExtractionClaim> {
    return this.database.$transaction(async (tx) => {
      await lockSource(tx, sourceId);
      const source = await tx.source.findUnique({ where: { id: sourceId } });
      if (!source) throw new ExtractionStateError("SOURCE_NOT_FOUND");
      const document = await tx.document.findFirst({ where: { sourceId }, select: { id: true } });
      if (document) return { status: "already_processed", documentId: document.id };
      if (source.type !== "PDF" || source.mimeType !== "application/pdf" || !source.storagePath) {
        throw new ExtractionStateError("SOURCE_NOT_ELIGIBLE");
      }
      if (source.status === "EXTRACTING_TEXT") {
        if (source.updatedAt.getTime() > Date.now() - STALE_ATTEMPT_MS) return { status: "busy" };
        await tx.extractionJob.updateMany({
          where: { sourceId, status: "RUNNING", promptVersion: { startsWith: "text-extraction-" } },
          data: { status: "FAILED", error: "ATTEMPT_INTERRUPTED", finishedAt: new Date() },
        });
      } else if (source.status !== "UPLOADED" && source.status !== "FAILED") {
        throw new ExtractionStateError("SOURCE_NOT_ELIGIBLE");
      }
      await tx.source.update({ where: { id: sourceId }, data: { status: "EXTRACTING_TEXT" } });
      const job = await tx.extractionJob.create({ data: newJob(sourceId, route, null) });
      return { status: "claimed", jobId: job.id, storagePath: source.storagePath };
    });
  }

  async saveRaw(sourceId: string, jobId: string, raw: unknown, route: ModelRoute, reason: string | null, signedUrl: string) {
    // Double encoding preserves even malformed JSON/NUL/surrogates for audit in JSONB.
    const responseJson = JSON.stringify(raw).split(signedUrl).join("[REDACTED_SIGNED_URL]");
    await this.database.$transaction(async (tx) => {
      await assertOwnership(tx, sourceId, jobId);
      await tx.extractionJob.update({ where: { id: jobId }, data: {
        rawAiOutput: json({ format: "response-json-string-v1", responseJson, route, triggerReason: reason }),
      } });
    });
  }

  async saveValidated(sourceId: string, jobId: string, result: OpenAIPdfTextExtractionResult, quality: TextQualityResult) {
    await this.database.$transaction(async (tx) => {
      await assertOwnership(tx, sourceId, jobId);
      await tx.extractionJob.update({ where: { id: jobId }, data: {
        model: result.model,
        // Invalid encodings remain in rawAiOutput; JSONB cannot hold those strings directly.
        validatedOutput: json(quality.reasons.includes("INVALID_TEXT_ENCODING")
          ? { quality, usage: result.usage, responseId: result.responseId }
          : { content: result.output, quality, usage: result.usage, responseId: result.responseId }),
      } });
    });
  }

  async failAttempt(sourceId: string, jobId: string, code: string, schemaInvalid: boolean, next: ModelRoute | null): Promise<string | null> {
    return this.database.$transaction(async (tx) => {
      await assertOwnership(tx, sourceId, jobId);
      await tx.extractionJob.update({ where: { id: jobId }, data: {
        status: schemaInvalid ? "SCHEMA_INVALID" : "FAILED", error: code, finishedAt: new Date(),
      } });
      await tx.source.update({ where: { id: sourceId }, data: { status: next ? "EXTRACTING_TEXT" : "FAILED" } });
      if (!next) return null;
      const job = await tx.extractionJob.create({ data: newJob(sourceId, next, code) });
      return job.id;
    });
  }

  async complete(sourceId: string, jobId: string, result: OpenAIPdfTextExtractionResult, quality: TextQualityResult, route: ModelRoute): Promise<string> {
    return this.database.$transaction(async (tx) => {
      await assertOwnership(tx, sourceId, jobId);
      const document = await tx.document.create({ data: {
        sourceId, title: result.output.title, language: result.output.language, pageCount: result.output.pageCount,
        pagesJson: json(result.output.pages),
        metadataJson: json({
          author: result.output.author, sourceDate: result.output.sourceDate,
          extractionMethod: "openai_pdf", transferMethod: "signed_url", reviewStatus: "unreviewed",
          extractionJobId: jobId, promptVersion: result.promptVersion, model: result.model,
          route, quality, responseId: result.responseId, usage: result.usage,
        }),
      } });
      await tx.source.update({ where: { id: sourceId }, data: {
        rawText: buildRawText(result.output), author: result.output.author,
        sourceDate: parseSourceDate(result.output.sourceDate), status: "TEXT_EXTRACTED",
      } });
      await tx.extractionJob.update({ where: { id: jobId }, data: { status: "COMPLETED", finishedAt: new Date(), error: null } });
      return document.id;
    });
  }
}
