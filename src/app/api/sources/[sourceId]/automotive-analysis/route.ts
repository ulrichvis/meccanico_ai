import { z } from "zod";

import { AutomotiveExtractionStateError } from "@/automotive-extraction/automotive-model-routing";
import { AutomotiveAIConfigurationError } from "@/ai/automotive-knowledge-extractor.server";
import { AutomotiveGraphPersistenceError } from "@/persistence/automotive-graph-repository";
import { processAutomotiveSourceOnServer } from "@/services/process-automotive-source.server";

export const maxDuration = 300;
export const runtime = "nodejs";

type AutomotiveAnalysisApiErrorCode =
  | "invalid_source"
  | "source_not_found"
  | "source_not_ready"
  | "source_not_eligible"
  | "analysis_busy"
  | "analysis_failed"
  | "service_unavailable";

function errorResponse(
  code: AutomotiveAnalysisApiErrorCode,
  status: number,
): Response {
  return Response.json({ error: { code } }, { status });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
): Promise<Response> {
  try {
    const { sourceId } = await context.params;
    const validSourceId = z.uuid().parse(sourceId);
    const result = await processAutomotiveSourceOnServer(validSourceId);

    if (result.status === "busy") {
      return errorResponse("analysis_busy", 409);
    }
    if (result.status === "failed") {
      return errorResponse("analysis_failed", 502);
    }

    return Response.json({
      caseCount: result.caseIds.length,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_source", 400);
    }
    if (error instanceof AutomotiveExtractionStateError) {
      if (error.code === "SOURCE_NOT_FOUND") {
        return errorResponse("source_not_found", 404);
      }
      if (error.code === "SOURCE_TEXT_NOT_READY") {
        return errorResponse("source_not_ready", 409);
      }
      if (error.code === "SOURCE_NOT_ELIGIBLE") {
        return errorResponse("source_not_eligible", 409);
      }
    }
    if (error instanceof AutomotiveGraphPersistenceError) {
      if (error.code === "SOURCE_NOT_FOUND") {
        return errorResponse("source_not_found", 404);
      }
      if (error.code === "SOURCE_NOT_READY_FOR_PERSISTENCE") {
        return errorResponse("source_not_eligible", 409);
      }
    }
    if (error instanceof AutomotiveAIConfigurationError) {
      return errorResponse("service_unavailable", 503);
    }

    return errorResponse("service_unavailable", 503);
  }
}
