import { z } from "zod";

import { ExtractionStateError } from "@/extraction/extraction-repository";
import { processSource } from "@/services/process-source.server";

export const maxDuration = 300;
export const runtime = "nodejs";

type ExtractionApiErrorCode =
  | "invalid_source"
  | "source_not_found"
  | "source_not_eligible"
  | "extraction_busy"
  | "extraction_failed"
  | "service_unavailable";

function errorResponse(code: ExtractionApiErrorCode, status: number): Response {
  return Response.json({ error: { code } }, { status });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
): Promise<Response> {
  try {
    const { sourceId } = await context.params;
    const validSourceId = z.uuid().parse(sourceId);
    const result = await processSource(validSourceId);

    if (result.status === "busy") {
      return errorResponse("extraction_busy", 409);
    }
    if (result.status === "failed") {
      return errorResponse("extraction_failed", 502);
    }

    return Response.json({
      documentId: result.documentId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_source", 400);
    }
    if (error instanceof ExtractionStateError) {
      if (error.code === "SOURCE_NOT_FOUND") {
        return errorResponse("source_not_found", 404);
      }
      if (error.code === "SOURCE_NOT_ELIGIBLE") {
        return errorResponse("source_not_eligible", 409);
      }
    }

    return errorResponse("service_unavailable", 503);
  }
}
