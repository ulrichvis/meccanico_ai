import { z } from "zod";

import {
  saveCaseReview,
  SaveCaseReviewError,
} from "@/services/save-case-review";
import {
  updateCaseLifecycle,
  UpdateCaseLifecycleError,
} from "@/services/update-case-lifecycle";

export const runtime = "nodejs";

type CaseReviewApiErrorCode =
  | "invalid_case"
  | "invalid_payload"
  | "case_not_found"
  | "invalid_transition"
  | "stale_edit"
  | "shared_reference_conflict"
  | "service_unavailable";

function errorResponse(code: CaseReviewApiErrorCode, status: number): Response {
  return Response.json({ error: { code } }, { status });
}

function logUnexpectedError(error: unknown, operation: "save" | "lifecycle") {
  console.error(
    JSON.stringify({
      errorCode:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : null,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorFrame:
        error instanceof Error
          ? error.stack
              ?.split("\n")
              .find((line) => line.includes("case-review-repository"))
              ?.trim() ?? null
          : null,
      event: "case_review_request_failed",
      operation,
    }),
  );
}

function matchesCaseId(payload: unknown, caseId: string): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "caseId" in payload &&
    payload.caseId === caseId
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  try {
    const { caseId } = await context.params;
    const validCaseId = z.uuid().parse(caseId);
    const payload: unknown = await request.json();

    if (!matchesCaseId(payload, validCaseId)) {
      return errorResponse("invalid_payload", 400);
    }

    return Response.json(await saveCaseReview(payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_case", 400);
    }
    if (error instanceof SyntaxError) {
      return errorResponse("invalid_payload", 400);
    }
    if (error instanceof SaveCaseReviewError) {
      if (error.code === "INVALID_PAYLOAD") {
        return errorResponse("invalid_payload", 400);
      }
      if (error.code === "CASE_NOT_FOUND") {
        return errorResponse("case_not_found", 404);
      }
      if (error.code === "STALE_EDIT") {
        return errorResponse("stale_edit", 409);
      }
      if (error.code === "SHARED_REFERENCE_CONFLICT") {
        return errorResponse("shared_reference_conflict", 409);
      }
    }

    logUnexpectedError(error, "save");
    return errorResponse("service_unavailable", 503);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  try {
    const { caseId } = await context.params;
    const validCaseId = z.uuid().parse(caseId);
    const payload: unknown = await request.json();

    if (!matchesCaseId(payload, validCaseId)) {
      return errorResponse("invalid_payload", 400);
    }

    return Response.json(await updateCaseLifecycle(payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_case", 400);
    }
    if (error instanceof SyntaxError) {
      return errorResponse("invalid_payload", 400);
    }
    if (error instanceof UpdateCaseLifecycleError) {
      if (error.code === "INVALID_PAYLOAD") {
        return errorResponse("invalid_payload", 400);
      }
      if (error.code === "CASE_NOT_FOUND") {
        return errorResponse("case_not_found", 404);
      }
      if (error.code === "STALE_EDIT") {
        return errorResponse("stale_edit", 409);
      }
      if (error.code === "INVALID_LIFECYCLE_TRANSITION") {
        return errorResponse("invalid_transition", 409);
      }
    }

    logUnexpectedError(error, "lifecycle");
    return errorResponse("service_unavailable", 503);
  }
}
