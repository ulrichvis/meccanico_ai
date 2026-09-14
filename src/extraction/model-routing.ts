import { z } from "zod";
import { OpenAITextExtractionError } from "@/ai/openai-pdf-text-extractor";
import { TextQualityError } from "@/extraction/text-quality";

export const textRoutingSchema = z.object({
  primary: z.string().trim().min(1),
  escalation: z.string().trim().min(1).optional(),
  exceptional: z.string().trim().min(1).optional(),
  maxAttempts: z.number().int().min(1).max(3).default(2),
});
export type TextRouting = z.infer<typeof textRoutingSchema>;
export type ModelRoute = { model: string; tier: "primary" | "escalation" | "exceptional" };

export function nextModelRoute(current: ModelRoute, config: TextRouting): ModelRoute {
  if (current.tier === "primary" && config.escalation && config.escalation !== current.model) {
    return { model: config.escalation, tier: "escalation" };
  }
  if (current.tier === "escalation" && config.exceptional && config.exceptional !== current.model) {
    return { model: config.exceptional, tier: "exceptional" };
  }
  return current;
}

export function canRetryExtraction(error: unknown): boolean {
  if (error instanceof TextQualityError) return true;
  return error instanceof OpenAITextExtractionError &&
    ["OPENAI_SCHEMA_INVALID", "OPENAI_RESPONSE_INVALID", "OPENAI_RESPONSE_INCOMPLETE"].includes(error.code);
}

export function extractionErrorCode(error: unknown): string {
  if (error instanceof TextQualityError) return error.message;
  if (error instanceof OpenAITextExtractionError) return error.code;
  return "TEXT_EXTRACTION_FAILED";
}
