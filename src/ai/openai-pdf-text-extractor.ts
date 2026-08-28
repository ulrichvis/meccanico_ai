import { z } from "zod";

import {
  PDF_TEXT_EXTRACTION_INSTRUCTIONS,
  PDF_TEXT_EXTRACTION_PROMPT_VERSION,
} from "@/prompts/pdf-text-extraction.prompt";
import {
  PDF_TEXT_EXTRACTION_SCHEMA_NAME,
  pdfTextExtractionJsonSchema,
  pdfTextExtractionSchema,
  type PdfTextExtraction,
} from "@/schemas/pdf-text-extraction.schema";

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

export interface OpenAITextExtractionUsage {
  cachedTokens: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
}

export interface OpenAIPdfTextExtractionResult {
  model: string;
  output: PdfTextExtraction;
  promptVersion: typeof PDF_TEXT_EXTRACTION_PROMPT_VERSION;
  rawResponse: unknown;
  responseId: string;
  usage: OpenAITextExtractionUsage | null;
}

export interface OpenAIPdfTextExtractorOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  model: string;
}

export class OpenAITextExtractionError extends Error {
  constructor(
    public readonly code:
      | "OPENAI_REQUEST_FAILED"
      | "OPENAI_RESPONSE_INVALID"
      | "OPENAI_RESPONSE_INCOMPLETE"
      | "OPENAI_RESPONSE_REFUSED"
      | "OPENAI_SCHEMA_INVALID",
    public readonly status: number | null = null,
    public readonly providerCode: string | null = null,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "OpenAITextExtractionError";
  }
}

function extractOutputText(output: z.infer<typeof responseOutputItemSchema>[]): string {
  for (const item of output) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new OpenAITextExtractionError("OPENAI_RESPONSE_REFUSED");
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new OpenAITextExtractionError("OPENAI_RESPONSE_INVALID");
}

function mapUsage(
  usage: z.infer<typeof responseUsageSchema>,
): OpenAITextExtractionUsage | null {
  if (!usage) return null;

  return {
    cachedTokens: usage.input_tokens_details?.cached_tokens ?? null,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
    totalTokens: usage.total_tokens,
  };
}

export class OpenAIPdfTextExtractor {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly model: string;

  constructor(options: OpenAIPdfTextExtractorOptions) {
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.model = options.model;
  }

  async extract(fileUrl: string): Promise<OpenAIPdfTextExtractionResult> {
    let response: Response;

    try {
      response = await this.fetchImplementation(OPENAI_RESPONSES_ENDPOINT, {
        body: JSON.stringify({
          input: [
            {
              content: [
                {
                  text: "Extract faithful page-aware text from the attached PDF.",
                  type: "input_text",
                },
                {
                  file_url: fileUrl,
                  type: "input_file",
                },
              ],
              role: "user",
            },
          ],
          instructions: PDF_TEXT_EXTRACTION_INSTRUCTIONS,
          model: this.model,
          store: false,
          text: {
            format: {
              name: PDF_TEXT_EXTRACTION_SCHEMA_NAME,
              schema: pdfTextExtractionJsonSchema,
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
      throw new OpenAITextExtractionError(
        "OPENAI_REQUEST_FAILED",
        null,
        null,
        { cause: error },
      );
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const providerError = openAIErrorSchema.safeParse(body);

      throw new OpenAITextExtractionError(
        "OPENAI_REQUEST_FAILED",
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
      throw new OpenAITextExtractionError(
        "OPENAI_RESPONSE_INVALID",
        response.status,
        null,
        { cause: parsedResponse.error },
      );
    }

    if (parsedResponse.data.status !== "completed") {
      throw new OpenAITextExtractionError("OPENAI_RESPONSE_INCOMPLETE");
    }

    const outputText = extractOutputText(parsedResponse.data.output);
    let unvalidatedOutput: unknown;

    try {
      unvalidatedOutput = JSON.parse(outputText) as unknown;
    } catch (error) {
      throw new OpenAITextExtractionError(
        "OPENAI_RESPONSE_INVALID",
        response.status,
        null,
        { cause: error },
      );
    }

    const output = pdfTextExtractionSchema.safeParse(unvalidatedOutput);

    if (!output.success) {
      throw new OpenAITextExtractionError(
        "OPENAI_SCHEMA_INVALID",
        response.status,
        null,
        { cause: output.error },
      );
    }

    return {
      model: parsedResponse.data.model,
      output: output.data,
      promptVersion: PDF_TEXT_EXTRACTION_PROMPT_VERSION,
      rawResponse: body,
      responseId: parsedResponse.data.id,
      usage: mapUsage(parsedResponse.data.usage),
    };
  }
}
