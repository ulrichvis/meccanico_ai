import type { OpenAITextExtractionUsage } from "@/ai/openai-pdf-text-extractor";
import type { ModelRoute } from "@/extraction/model-routing";
import { PDF_TEXT_EXTRACTION_PROMPT_VERSION } from "@/prompts/pdf-text-extraction.prompt";

interface TextExtractionLogEvent {
  attempt: number;
  durationMs?: number;
  errorCode?: string;
  extractionJobId: string;
  outcome: "started" | "completed" | "failed";
  route: ModelRoute;
  sourceId: string;
  triggerReason: string | null;
  usage?: OpenAITextExtractionUsage | null;
}

export function logTextExtractionEvent(event: TextExtractionLogEvent): void {
  console.info(
    JSON.stringify({
      attempt: event.attempt,
      durationMs: event.durationMs ?? null,
      errorCode: event.errorCode ?? null,
      extractionJobId: event.extractionJobId,
      model: event.route.model,
      outcome: event.outcome,
      promptVersion: PDF_TEXT_EXTRACTION_PROMPT_VERSION,
      sourceId: event.sourceId,
      step: "text_extraction",
      tier: event.route.tier,
      triggerReason: event.triggerReason,
      usage: event.usage ?? null,
    }),
  );
}
