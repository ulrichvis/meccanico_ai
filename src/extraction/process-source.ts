import { z } from "zod";
import type { OpenAIPdfTextExtractionResult } from "@/ai/openai-pdf-text-extractor";
import { OpenAITextExtractionError } from "@/ai/openai-pdf-text-extractor";
import { ExtractionRepository, ExtractionStateError } from "@/extraction/extraction-repository";
import { canRetryExtraction, extractionErrorCode, nextModelRoute, textRoutingSchema, type TextRouting, type ModelRoute } from "@/extraction/model-routing";
import { evaluateTextQuality, TextQualityError } from "@/extraction/text-quality";
import { logTextExtractionEvent } from "@/lib/text-extraction-logger";
import type { SourceStorage } from "@/storage/source-storage";

export interface PdfTextExtractor {
  extract(fileUrl: string, onRawResponse: (raw: unknown) => Promise<void>): Promise<OpenAIPdfTextExtractionResult>;
}
export interface ProcessSourceDependencies {
  repository: ExtractionRepository;
  storage: SourceStorage;
  routing: TextRouting;
  maximumSizeBytes: number;
  createExtractor: (model: string) => PdfTextExtractor;
}
export type ProcessSourceResult =
  | { status: "completed" | "already_processed"; sourceId: string; documentId: string }
  | { status: "busy"; sourceId: string }
  | { status: "failed"; sourceId: string; errorCode: string };

async function prepareFile(storage: SourceStorage, path: string, maximumSizeBytes: number) {
  const info = await storage.getFileInfo(path);
  const checked = z.object({
    contentType: z.literal("application/pdf"), sizeBytes: z.number().int().positive().max(maximumSizeBytes),
  }).safeParse(info);
  if (!checked.success) throw new ExtractionStateError("SOURCE_FILE_INVALID");
  return storage.createSignedUrl(path, 600);
}

export async function processSource(sourceId: string, dependencies: ProcessSourceDependencies): Promise<ProcessSourceResult> {
  const id = z.uuid().parse(sourceId);
  const config = textRoutingSchema.parse(dependencies.routing);
  const { repository, storage, createExtractor, maximumSizeBytes } = dependencies;
  let route: ModelRoute = { model: config.primary, tier: "primary" };
  const claim = await repository.claim(id, route);
  if (claim.status === "already_processed") return { ...claim, sourceId: id };
  if (claim.status === "busy") return { status: "busy", sourceId: id };
  let jobId = claim.jobId;
  let triggerReason: string | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const started = Date.now();
    logTextExtractionEvent({
      attempt,
      extractionJobId: jobId,
      outcome: "started",
      route,
      sourceId: id,
      triggerReason,
    });

    try {
      const signedUrl = await prepareFile(storage, claim.storagePath, maximumSizeBytes);
      const result = await createExtractor(route.model).extract(signedUrl, (raw) =>
        repository.saveRaw(id, jobId, raw, route, triggerReason, signedUrl));
      const quality = evaluateTextQuality(result.output);
      await repository.saveValidated(id, jobId, result, quality);
      if (!quality.accepted) throw new TextQualityError(quality);
      const documentId = await repository.complete(id, jobId, result, quality, route);
      logTextExtractionEvent({
        attempt,
        durationMs: Date.now() - started,
        extractionJobId: jobId,
        outcome: "completed",
        route: { ...route, model: result.model },
        sourceId: id,
        triggerReason,
        usage: result.usage,
      });
      return { status: "completed", sourceId: id, documentId };
    } catch (error) {
      // A replaced worker must never mark the new owner's source/job as failed.
      if (error instanceof ExtractionStateError && error.code === "EXTRACTION_OWNERSHIP_LOST") throw error;
      const code = error instanceof ExtractionStateError ? error.code : extractionErrorCode(error);
      const retry = attempt < config.maxAttempts && canRetryExtraction(error);
      const next = retry ? nextModelRoute(route, config) : null;
      const schemaInvalid = error instanceof TextQualityError ||
        (error instanceof OpenAITextExtractionError && error.code === "OPENAI_SCHEMA_INVALID");
      const nextJobId = await repository.failAttempt(id, jobId, code, schemaInvalid, next);
      logTextExtractionEvent({
        attempt,
        durationMs: Date.now() - started,
        errorCode: code,
        extractionJobId: jobId,
        outcome: "failed",
        route,
        sourceId: id,
        triggerReason,
      });
      if (!next || !nextJobId) return { status: "failed", sourceId: id, errorCode: code };
      route = next;
      jobId = nextJobId;
      triggerReason = code;
    }
  }
  throw new ExtractionStateError("EXTRACTION_ATTEMPTS_EXHAUSTED");
}
