import type { AutomotiveExtractionPromptInput } from "@/prompts/automotive-extraction.prompt";
import type { AutomotiveExtraction } from "@/schemas/automotive-extraction.schema";

export type AutomotiveQualityReason =
  | "EVIDENCE_EXCERPT_NOT_FOUND"
  | "EVIDENCE_PAGE_OUT_OF_RANGE"
  | "HUMAN_REVIEW_FLAG_MISSING"
  | "UNCERTAINTY_PAGE_OUT_OF_RANGE";

export interface AutomotiveQualityResult {
  accepted: boolean;
  reasons: AutomotiveQualityReason[];
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
          reasons.add("EVIDENCE_EXCERPT_NOT_FOUND");
        }
      } else if (!fullText.includes(evidence.excerpt)) {
        reasons.add("EVIDENCE_EXCERPT_NOT_FOUND");
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
    accepted: orderedReasons.length === 0,
    reasons: orderedReasons,
  };
}

export class AutomotiveQualityError extends Error {
  readonly code: AutomotiveQualityReason | "AUTOMOTIVE_QUALITY_INVALID";

  constructor(public readonly quality: AutomotiveQualityResult) {
    const code = quality.reasons[0] ?? "AUTOMOTIVE_QUALITY_INVALID";
    super(code);
    this.code = code;
    this.name = "AutomotiveQualityError";
  }
}
