import "server-only";

import { createCaseEditDraft } from "@/cases/case-edit-draft";
import { getDatabaseClient } from "@/db/client";
import {
  CaseReviewPersistenceError,
  CaseReviewRepository,
  type SaveCaseReviewResult,
} from "@/persistence/case-review-repository";
import {
  caseEditSchema,
  type CaseEditDraft,
} from "@/schemas/case-edit.schema";
import { getCaseReviewSource } from "@/sources/source-detail-repository";

export class SaveCaseReviewError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "SaveCaseReviewError";
  }
}

function normalizeSequences(draft: CaseEditDraft): CaseEditDraft {
  return {
    ...draft,
    diagnosticChecks: draft.diagnosticChecks.map((item, index) => ({
      ...item,
      sequenceOrder: index,
    })),
    solutions: draft.solutions.map((solution) => ({
      ...solution,
      procedures: solution.procedures.map((procedure, index) => ({
        ...procedure,
        sequenceOrder: index,
      })),
    })),
  };
}

function technicalSnapshot(draft: CaseEditDraft): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(draft).filter(
        ([key]) => !["caseId", "reviewNotes", "updatedAt"].includes(key),
      ),
    ),
  );
}

export async function saveCaseReview(
  rawDraft: unknown,
): Promise<SaveCaseReviewResult> {
  const parsed = caseEditSchema.safeParse(rawDraft);
  if (!parsed.success) {
    throw new SaveCaseReviewError("INVALID_PAYLOAD");
  }

  const draft = normalizeSequences(parsed.data);
  const source = await getCaseReviewSource(draft.caseId);
  const currentCase = source?.automotiveCases[0];
  if (!currentCase) {
    throw new SaveCaseReviewError("CASE_NOT_FOUND");
  }

  const currentDraft = normalizeSequences(createCaseEditDraft(currentCase));
  const technicalDataChanged =
    technicalSnapshot(draft) !== technicalSnapshot(currentDraft);

  try {
    return await new CaseReviewRepository(getDatabaseClient()).save(
      draft,
      technicalDataChanged,
    );
  } catch (error) {
    if (error instanceof CaseReviewPersistenceError) {
      throw new SaveCaseReviewError(error.code);
    }
    throw error;
  }
}
