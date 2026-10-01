import type { AutomotiveExtractionPromptInput } from "@/prompts/automotive-extraction.prompt";
import type { AutomotiveExtraction } from "@/schemas/automotive-extraction.schema";

export type AutomotiveQualityReason =
  | "EVIDENCE_WORDING_CHANGED"
  | "EVIDENCE_PAGE_OUT_OF_RANGE"
  | "HUMAN_REVIEW_FLAG_MISSING"
  | "UNCERTAINTY_PAGE_OUT_OF_RANGE"
  | "CONFIRMED_SOLUTION_OUTCOME_MISSING";

export interface AutomotiveQualityResult {
  accepted: boolean;
  reasons: AutomotiveQualityReason[];
  warnings: AutomotiveQualityReason[];
}

function pageExists(
  input: AutomotiveExtractionPromptInput,
  pageNumber: number,
): boolean {
  return input.document.pages.some((page) => page.pageNumber === pageNumber);
}

export function evaluateAutomotiveQuality(
  input: AutomotiveExtractionPromptInput,
  output: AutomotiveExtraction,
): AutomotiveQualityResult {
  const reasons = new Set<AutomotiveQualityReason>();
  const pagesByNumber = new Map(
    input.document.pages.map((page) => [page.pageNumber, page.text]),
  );
  const fullText = input.document.pages.map((page) => page.text).join("\n");

  for (const uncertainty of output.documentAnalysis.uncertainties) {
    if (
      uncertainty.pageNumber !== null &&
      !pageExists(input, uncertainty.pageNumber)
    ) {
      reasons.add("UNCERTAINTY_PAGE_OUT_OF_RANGE");
    }
  }

  for (const extractedCase of output.cases) {
    for (const evidence of extractedCase.evidence) {
      if (evidence.pageNumber !== null) {
        const pageText = pagesByNumber.get(evidence.pageNumber);

        if (pageText === undefined) {
          reasons.add("EVIDENCE_PAGE_OUT_OF_RANGE");
          continue;
        }

        if (!pageText.includes(evidence.excerpt)) {
          reasons.add("EVIDENCE_WORDING_CHANGED");
        }
      } else if (!fullText.includes(evidence.excerpt)) {
        reasons.add("EVIDENCE_WORDING_CHANGED");
      }
    }

    for (const solution of extractedCase.solutions) {
      if (
        solution.repairConfirmed === true &&
        !extractedCase.repairOutcomes.some(
          (outcome) => outcome.solutionRef === solution.ref && outcome.confirmed === true,
        )
      ) {
        reasons.add("CONFIRMED_SOLUTION_OUTCOME_MISSING");
      }
    }
  }

  const sourceNeedsReview = input.document.pages.some(
    (page) => page.textQuality !== "readable" || page.uncertainty !== null,
  );

  if (sourceNeedsReview && !output.documentAnalysis.requiresHumanReview) {
    reasons.add("HUMAN_REVIEW_FLAG_MISSING");
  }

  const orderedReasons = [...reasons].sort();

  return {
    accepted: true,
    reasons: [],
    warnings: orderedReasons,
  };
}
