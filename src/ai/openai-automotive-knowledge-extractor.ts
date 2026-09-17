import { z } from "zod";

import {
  AutomotiveKnowledgeExtractionError,
  type AutomotiveExtractionUsage,
  type AutomotiveKnowledgeExtractionResult,
  type AutomotiveKnowledgeExtractor,
  type AutomotiveReasoningEffort,
  type PreserveAutomotiveRawResponse,
} from "@/ai/automotive-knowledge-extractor";
import {
  AUTOMOTIVE_EXTRACTION_INSTRUCTIONS,
  buildAutomotiveExtractionInput,
  type AutomotiveExtractionPromptInput,
} from "@/prompts/automotive-extraction.prompt";
import {
  AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
  AUTOMOTIVE_EXTRACTION_SCHEMA_NAME,
  automotiveExtractionJsonSchema,
  automotiveExtractionSchema,
} from "@/schemas/automotive-extraction.schema";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_REQUEST_TIMEOUT_MS = 300_000;

const responseContentSchema = z.looseObject({
  refusal: z.string().optional(),
  text: z.string().optional(),
  type: z.string(),
});

const responseOutputItemSchema = z.looseObject({
  content: z.array(responseContentSchema).optional(),
  type: z.string(),
});

const responseUsageSchema = z
  .looseObject({
    input_tokens: z.number().int().nonnegative(),
    input_tokens_details: z
      .looseObject({
        cached_tokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
    output_tokens: z.number().int().nonnegative(),
    output_tokens_details: z
      .looseObject({
        reasoning_tokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
    total_tokens: z.number().int().nonnegative(),
  })
  .optional();

const openAIResponseSchema = z.looseObject({
  id: z.string().min(1),
  model: z.string().min(1),
  output: z.array(responseOutputItemSchema),
  status: z.string(),
  usage: responseUsageSchema,
});

const openAIErrorSchema = z.looseObject({
  error: z
    .looseObject({
      code: z.string().nullable().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export interface OpenAIAutomotiveKnowledgeExtractorOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  model: string;
  reasoningEffort: AutomotiveReasoningEffort;
}

function extractOutputText(
  output: z.infer<typeof responseOutputItemSchema>[],
): string {
  for (const item of output) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new AutomotiveKnowledgeExtractionError(
          "AUTOMOTIVE_AI_RESPONSE_REFUSED",
        );
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new AutomotiveKnowledgeExtractionError(
    "AUTOMOTIVE_AI_RESPONSE_INVALID",
  );
}

function mapUsage(
  usage: z.infer<typeof responseUsageSchema>,
): AutomotiveExtractionUsage | null {
  if (!usage) return null;

  return {
    cachedTokens: usage.input_tokens_details?.cached_tokens ?? null,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
    totalTokens: usage.total_tokens,
  };
}

export class OpenAIAutomotiveKnowledgeExtractor
  implements AutomotiveKnowledgeExtractor
{
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly model: string;
  private readonly reasoningEffort: AutomotiveReasoningEffort;

  constructor(options: OpenAIAutomotiveKnowledgeExtractorOptions) {
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.model = options.model;
    this.reasoningEffort = options.reasoningEffort;
  }

  async extract(
    input: AutomotiveExtractionPromptInput,
    onRawResponse?: PreserveAutomotiveRawResponse,
  ): Promise<AutomotiveKnowledgeExtractionResult> {
    const serializedInput = buildAutomotiveExtractionInput(input);
    let response: Response;

    try {
      response = await this.fetchImplementation(OPENAI_RESPONSES_ENDPOINT, {
        body: JSON.stringify({
          input: [
            {
              content: [
                {
                  text: serializedInput,
                  type: "input_text",
                },
              ],
              role: "user",
            },
          ],
          instructions: AUTOMOTIVE_EXTRACTION_INSTRUCTIONS,
          model: this.model,
          reasoning: {
            effort: this.reasoningEffort,
          },
          store: false,
          text: {
            format: {
              name: AUTOMOTIVE_EXTRACTION_SCHEMA_NAME,
              schema: automotiveExtractionJsonSchema,
              strict: true,
              type: "json_schema",
            },
          },
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_REQUEST_FAILED",
        null,
        null,
        { cause: error },
      );
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_REQUEST_FAILED",
        response.status,
        null,
        { cause: error },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = responseText;
    }

    await onRawResponse?.(body);

    if (!response.ok) {
      const providerError = openAIErrorSchema.safeParse(body);

      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_REQUEST_FAILED",
        response.status,
        providerError.success
          ? (providerError.data.error?.code ??
              providerError.data.error?.type ??
              null)
          : null,
      );
    }

    const parsedResponse = openAIResponseSchema.safeParse(body);

    if (!parsedResponse.success) {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_RESPONSE_INVALID",
        response.status,
        null,
        { cause: parsedResponse.error },
      );
    }

    if (parsedResponse.data.status !== "completed") {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_RESPONSE_INCOMPLETE",
      );
    }

    const outputText = extractOutputText(parsedResponse.data.output);
    let unvalidatedOutput: unknown;

    try {
      unvalidatedOutput = JSON.parse(outputText) as unknown;
    } catch (error) {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_RESPONSE_INVALID",
        response.status,
        null,
        { cause: error },
      );
    }

    const output = automotiveExtractionSchema.safeParse(unvalidatedOutput);

    if (!output.success) {
      throw new AutomotiveKnowledgeExtractionError(
        "AUTOMOTIVE_AI_SCHEMA_INVALID",
        response.status,
        null,
        { cause: output.error },
      );
    }

    return {
      model: parsedResponse.data.model,
      output: output.data,
      promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
      rawResponse: body,
      reasoningEffort: this.reasoningEffort,
      responseId: parsedResponse.data.id,
      usage: mapUsage(parsedResponse.data.usage),
    };
  }
}
