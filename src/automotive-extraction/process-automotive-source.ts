import { z } from "zod";

import {
  AutomotiveKnowledgeExtractionError,
  type AutomotiveKnowledgeExtractor,
} from "@/ai/automotive-knowledge-extractor";
import {
  automotiveExtractionErrorCode,
  AutomotiveExtractionStateError,
  automotiveRoutingSchema,
  canRetryAutomotiveExtraction,
  nextAutomotiveModelRoute,
  type AutomotiveModelRoute,
  type AutomotiveRouting,
} from "@/automotive-extraction/automotive-model-routing";
import { AutomotiveExtractionRepository } from "@/automotive-extraction/automotive-extraction-repository";
import {
  AutomotiveQualityError,
  evaluateAutomotiveQuality,
} from "@/automotive-extraction/automotive-quality";
import { logAutomotiveExtractionEvent } from "@/lib/automotive-extraction-logger";

export interface ProcessAutomotiveSourceDependencies {
  repository: AutomotiveExtractionRepository;
  routing: AutomotiveRouting;
  createExtractor: (model: string) => AutomotiveKnowledgeExtractor;
}

export type ProcessAutomotiveSourceResult =
  | {
      status: "completed" | "already_processed";
      sourceId: string;
      extractionJobId: string;
    }
  | { status: "busy"; sourceId: string }
  | { status: "failed"; sourceId: string; errorCode: string };

export async function processAutomotiveSource(
  sourceId: string,
  dependencies: ProcessAutomotiveSourceDependencies,
): Promise<ProcessAutomotiveSourceResult> {
  const id = z.uuid().parse(sourceId);
  const config = automotiveRoutingSchema.parse(dependencies.routing);
  const { repository, createExtractor } = dependencies;
  let route: AutomotiveModelRoute = {
    model: config.primary,
    tier: "primary",
  };
  const claim = await repository.claim(id, route);

  if (claim.status === "already_processed") {
    return { ...claim, sourceId: id };
  }
  if (claim.status === "busy") return { status: "busy", sourceId: id };

  let jobId = claim.jobId;
  let triggerReason: string | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const startedAt = Date.now();
    logAutomotiveExtractionEvent({
      attempt,
      extractionJobId: jobId,
      outcome: "started",
      route,
      sourceId: id,
      triggerReason,
    });

    try {
      const result = await createExtractor(route.model).extract(
        claim.input,
        (rawResponse) =>
          repository.saveRaw(
            id,
            jobId,
            rawResponse,
            route,
            triggerReason,
          ),
      );
      const quality = evaluateAutomotiveQuality(claim.input, result.output);
      await repository.saveValidated(id, jobId, result, quality);

      if (!quality.accepted) throw new AutomotiveQualityError(quality);

      await repository.complete(id, jobId);
      logAutomotiveExtractionEvent({
        attempt,
        durationMs: Date.now() - startedAt,
        extractionJobId: jobId,
        outcome: "completed",
        route: { ...route, model: result.model },
        sourceId: id,
        triggerReason,
        usage: result.usage,
      });
      return {
        status: "completed",
        sourceId: id,
        extractionJobId: jobId,
      };
    } catch (error) {
      if (
        error instanceof AutomotiveExtractionStateError &&
        error.code === "AUTOMOTIVE_EXTRACTION_OWNERSHIP_LOST"
      ) {
        throw error;
      }

      const code = automotiveExtractionErrorCode(error);
      const retry =
        attempt < config.maxAttempts &&
        canRetryAutomotiveExtraction(error);
      const nextRoute = retry
        ? nextAutomotiveModelRoute(route, config)
        : null;
      const schemaInvalid =
        error instanceof AutomotiveQualityError ||
        (error instanceof AutomotiveKnowledgeExtractionError &&
          error.code === "AUTOMOTIVE_AI_SCHEMA_INVALID");
      const nextJobId = await repository.failAttempt(
        id,
        jobId,
        code,
        schemaInvalid,
        nextRoute,
      );

      logAutomotiveExtractionEvent({
        attempt,
        durationMs: Date.now() - startedAt,
        errorCode: code,
        extractionJobId: jobId,
        outcome: "failed",
        route,
        sourceId: id,
        triggerReason,
      });

      if (!nextRoute || !nextJobId) {
        return { status: "failed", sourceId: id, errorCode: code };
      }

      route = nextRoute;
      jobId = nextJobId;
      triggerReason = code;
    }
  }

  throw new AutomotiveExtractionStateError(
    "AUTOMOTIVE_EXTRACTION_ATTEMPTS_EXHAUSTED",
  );
}
