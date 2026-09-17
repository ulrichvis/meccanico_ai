import { z } from "zod";

import { AutomotiveKnowledgeExtractionError } from "@/ai/automotive-knowledge-extractor";
import { AutomotiveQualityError } from "@/automotive-extraction/automotive-quality";

export const automotiveRoutingSchema = z.strictObject({
  primary: z.string().trim().min(1),
  escalation: z.string().trim().min(1).optional(),
  exceptional: z.string().trim().min(1).optional(),
  maxAttempts: z.number().int().min(1).max(3).default(2),
});

export type AutomotiveRouting = z.infer<typeof automotiveRoutingSchema>;
export type AutomotiveModelTier = "primary" | "escalation" | "exceptional";
export type AutomotiveModelRoute = {
  model: string;
  tier: AutomotiveModelTier;
};

export function nextAutomotiveModelRoute(
  current: AutomotiveModelRoute,
  config: AutomotiveRouting,
): AutomotiveModelRoute | null {
  const candidates: AutomotiveModelRoute[] = [
    { model: config.primary, tier: "primary" },
    ...(config.escalation
      ? [{ model: config.escalation, tier: "escalation" as const }]
      : []),
    ...(config.exceptional
      ? [{ model: config.exceptional, tier: "exceptional" as const }]
      : []),
  ];
  const currentIndex = candidates.findIndex(
    (candidate) =>
      candidate.tier === current.tier && candidate.model === current.model,
  );

  for (let index = currentIndex + 1; index < candidates.length; index++) {
    const candidate = candidates[index];
    if (candidate && candidate.model !== current.model) return candidate;
  }

  return null;
}

export function canRetryAutomotiveExtraction(error: unknown): boolean {
  if (error instanceof AutomotiveQualityError) return true;

  return (
    error instanceof AutomotiveKnowledgeExtractionError &&
    [
      "AUTOMOTIVE_AI_SCHEMA_INVALID",
      "AUTOMOTIVE_AI_RESPONSE_INVALID",
      "AUTOMOTIVE_AI_RESPONSE_INCOMPLETE",
    ].includes(error.code)
  );
}

export function automotiveExtractionErrorCode(error: unknown): string {
  if (error instanceof AutomotiveQualityError) return error.code;
  if (error instanceof AutomotiveKnowledgeExtractionError) return error.code;
  if (error instanceof AutomotiveExtractionStateError) return error.code;
  return "AUTOMOTIVE_EXTRACTION_FAILED";
}

export class AutomotiveExtractionStateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AutomotiveExtractionStateError";
  }
}
