import type { AutomotiveExtractionPromptInput } from "@/prompts/automotive-extraction.prompt";
import type {
  AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
  AutomotiveExtraction,
} from "@/schemas/automotive-extraction.schema";

export type AutomotiveReasoningEffort =
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export interface AutomotiveExtractionUsage {
  cachedTokens: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
}

export interface AutomotiveKnowledgeExtractionResult {
  model: string;
  output: AutomotiveExtraction;
  promptVersion: typeof AUTOMOTIVE_EXTRACTION_PROMPT_VERSION;
  rawResponse: unknown;
  reasoningEffort: AutomotiveReasoningEffort;
  responseId: string;
  usage: AutomotiveExtractionUsage | null;
}

export type PreserveAutomotiveRawResponse = (
  rawResponse: unknown,
) => Promise<void>;

export interface AutomotiveKnowledgeExtractor {
  extract(
    input: AutomotiveExtractionPromptInput,
    onRawResponse?: PreserveAutomotiveRawResponse,
  ): Promise<AutomotiveKnowledgeExtractionResult>;
}

export type AutomotiveKnowledgeExtractionErrorCode =
  | "AUTOMOTIVE_AI_REQUEST_FAILED"
  | "AUTOMOTIVE_AI_RESPONSE_INVALID"
  | "AUTOMOTIVE_AI_RESPONSE_INCOMPLETE"
  | "AUTOMOTIVE_AI_RESPONSE_REFUSED"
  | "AUTOMOTIVE_AI_SCHEMA_INVALID";

export class AutomotiveKnowledgeExtractionError extends Error {
  constructor(
    public readonly code: AutomotiveKnowledgeExtractionErrorCode,
    public readonly status: number | null = null,
    public readonly providerCode: string | null = null,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AutomotiveKnowledgeExtractionError";
  }
}
