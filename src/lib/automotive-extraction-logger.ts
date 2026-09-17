import type { AutomotiveExtractionUsage } from "@/ai/automotive-knowledge-extractor";
import type { AutomotiveModelRoute } from "@/automotive-extraction/automotive-model-routing";

interface AutomotiveExtractionLogEvent {
  attempt: number;
  durationMs?: number;
  errorCode?: string;
  extractionJobId: string;
  outcome: "started" | "completed" | "failed";
  route: AutomotiveModelRoute;
  sourceId: string;
  triggerReason: string | null;
  usage?: AutomotiveExtractionUsage | null;
}

export function logAutomotiveExtractionEvent(
  event: AutomotiveExtractionLogEvent,
): void {
  console.info(
    JSON.stringify({
      event: "automotive_extraction",
      promptVersion: "automotive-structure-v1",
      ...event,
    }),
  );
}
