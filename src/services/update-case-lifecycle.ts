import "server-only";

import { getDatabaseClient } from "@/db/client";
import {
  CaseReviewPersistenceError,
  CaseReviewRepository,
  type UpdateCaseLifecycleResult,
} from "@/persistence/case-review-repository";
import { caseLifecycleActionSchema } from "@/schemas/case-lifecycle.schema";

export class UpdateCaseLifecycleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "UpdateCaseLifecycleError";
  }
}

export async function updateCaseLifecycle(
  rawInput: unknown,
): Promise<UpdateCaseLifecycleResult> {
  const parsed = caseLifecycleActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new UpdateCaseLifecycleError("INVALID_PAYLOAD");
  }

  try {
    return await new CaseReviewRepository(
      getDatabaseClient(),
    ).updateLifecycle(parsed.data);
  } catch (error) {
    if (error instanceof CaseReviewPersistenceError) {
      throw new UpdateCaseLifecycleError(error.code);
    }
    throw error;
  }
}
