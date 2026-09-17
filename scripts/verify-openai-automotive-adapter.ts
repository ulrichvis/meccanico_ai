import assert from "node:assert/strict";

import {
  AutomotiveKnowledgeExtractionError,
  type AutomotiveReasoningEffort,
} from "../src/ai/automotive-knowledge-extractor";
import { OpenAIAutomotiveKnowledgeExtractor } from "../src/ai/openai-automotive-knowledge-extractor";
import {
  AUTOMOTIVE_EXTRACTION_INSTRUCTIONS,
  type AutomotiveExtractionPromptInput,
} from "../src/prompts/automotive-extraction.prompt";
import {
  AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
  AUTOMOTIVE_EXTRACTION_SCHEMA_NAME,
  automotiveExtractionJsonSchema,
  type AutomotiveExtraction,
} from "../src/schemas/automotive-extraction.schema";

const input: AutomotiveExtractionPromptInput = {
  originalFilename: "untrusted-name.pdf",
  document: {
    title: "Diagnostic note",
    author: null,
    sourceDate: null,
    language: "en",
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        text: "DTC P0299 is recorded. Boost pressure measured 1.2 bar at 2,500 rpm.",
        textQuality: "readable",
        uncertainty: null,
      },
    ],
  },
};

const validExtraction: AutomotiveExtraction = {
  source: {
    title: "Diagnostic note",
    author: null,
    sourceDate: null,
    language: "en",
  },
  documentAnalysis: {
    uncertainties: [],
    requiresHumanReview: false,
  },
  cases: [],
};

function providerResponse(
  output: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "resp_automotive_synthetic",
    model: "synthetic-automotive-model",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(output),
          },
        ],
      },
    ],
    status: "completed",
    usage: {
      input_tokens: 120,
      input_tokens_details: { cached_tokens: 40 },
      output_tokens: 30,
      output_tokens_details: { reasoning_tokens: 10 },
      total_tokens: 150,
    },
    ...overrides,
  };
}

function createExtractor(
  response: Response,
  inspectRequest?: (url: string, init: RequestInit) => void,
  reasoningEffort: AutomotiveReasoningEffort = "medium",
) {
  const fetchImplementation: typeof fetch = async (request, init) => {
    assert.equal(typeof request, "string");
    assert(init);
    inspectRequest?.(request as string, init);
    return response;
  };

  return new OpenAIAutomotiveKnowledgeExtractor({
    apiKey: "synthetic-secret-key",
    fetchImplementation,
    model: "configured-automotive-model",
    reasoningEffort,
  });
}

async function expectError(
  operation: () => Promise<unknown>,
  code: AutomotiveKnowledgeExtractionError["code"],
): Promise<AutomotiveKnowledgeExtractionError> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof AutomotiveKnowledgeExtractionError);
    assert.equal(error.code, code);
    return error;
  }

  throw new Error(`Expected ${code}.`);
}

async function main(): Promise<void> {
  let rawResponse: unknown;
  const responseBody = providerResponse(validExtraction);
  const extractor = createExtractor(
    Response.json(responseBody),
    (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(init.method, "POST");
      assert.equal(init.cache, "no-store");

      const headers = new Headers(init.headers);
      assert.equal(headers.get("Authorization"), "Bearer synthetic-secret-key");
      assert.equal(headers.get("Content-Type"), "application/json");
      assert.equal(typeof init.body, "string");

      const body = JSON.parse(init.body as string) as {
        input: Array<{
          content: Array<{ text: string; type: string }>;
          role: string;
        }>;
        instructions: string;
        model: string;
        reasoning: { effort: string };
        store: boolean;
        text: {
          format: {
            name: string;
            schema: unknown;
            strict: boolean;
            type: string;
          };
        };
      };

      assert.equal(body.instructions, AUTOMOTIVE_EXTRACTION_INSTRUCTIONS);
      assert.equal(body.model, "configured-automotive-model");
      assert.deepEqual(body.reasoning, { effort: "high" });
      assert.equal(body.store, false);
      assert.deepEqual(body.text.format, {
        name: AUTOMOTIVE_EXTRACTION_SCHEMA_NAME,
        schema: automotiveExtractionJsonSchema,
        strict: true,
        type: "json_schema",
      });
      assert.equal(body.input.length, 1);
      assert.equal(body.input[0]?.role, "user");
      assert.equal(body.input[0]?.content[0]?.type, "input_text");

      const dynamicInput = JSON.parse(
        body.input[0]?.content[0]?.text ?? "",
      ) as {
        metadataAuthority: string;
        originalFilename: string;
        pages: Array<{ pageNumber: number; text: string }>;
        promptVersion: string;
      };

      assert.equal(dynamicInput.metadataAuthority, "non_authoritative");
      assert.equal(dynamicInput.originalFilename, input.originalFilename);
      assert.equal(
        dynamicInput.pages[0]?.text,
        input.document.pages[0]?.text,
      );
      assert.equal(
        dynamicInput.promptVersion,
        AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
      );
      assert(!JSON.stringify(body).includes("synthetic-secret-key"));
    },
    "high",
  );

  const result = await extractor.extract(input, async (raw) => {
    rawResponse = raw;
  });

  assert.deepEqual(rawResponse, responseBody);
  assert.deepEqual(result.output, validExtraction);
  assert.equal(result.model, "synthetic-automotive-model");
  assert.equal(result.promptVersion, AUTOMOTIVE_EXTRACTION_PROMPT_VERSION);
  assert.equal(result.reasoningEffort, "high");
  assert.equal(result.responseId, "resp_automotive_synthetic");
  assert.deepEqual(result.usage, {
    cachedTokens: 40,
    inputTokens: 120,
    outputTokens: 30,
    reasoningTokens: 10,
    totalTokens: 150,
  });

  let invalidRawResponse: unknown;
  const invalidBody = providerResponse({ source: {}, cases: [] });
  await expectError(
    () =>
      createExtractor(Response.json(invalidBody)).extract(
        input,
        async (raw) => {
          invalidRawResponse = raw;
        },
      ),
    "AUTOMOTIVE_AI_SCHEMA_INVALID",
  );
  assert.deepEqual(invalidRawResponse, invalidBody);

  const refusalBody = providerResponse(validExtraction, {
    output: [
      {
        type: "message",
        content: [{ type: "refusal", refusal: "Request refused." }],
      },
    ],
  });
  await expectError(
    () => createExtractor(Response.json(refusalBody)).extract(input),
    "AUTOMOTIVE_AI_RESPONSE_REFUSED",
  );

  await expectError(
    () =>
      createExtractor(
        Response.json(
          providerResponse(validExtraction, { status: "incomplete" }),
        ),
      ).extract(input),
    "AUTOMOTIVE_AI_RESPONSE_INCOMPLETE",
  );

  const providerError = await expectError(
    () =>
      createExtractor(
        Response.json(
          { error: { code: "rate_limit_exceeded", type: "rate_limit_error" } },
          { status: 429 },
        ),
      ).extract(input),
    "AUTOMOTIVE_AI_REQUEST_FAILED",
  );
  assert.equal(providerError.status, 429);
  assert.equal(providerError.providerCode, "rate_limit_exceeded");

  console.info(
    "OpenAI automotive adapter request, output, usage, refusal, incomplete-response, provider-error, and schema-error checks passed.",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: automotive adapter verification failed.`
      : "Automotive adapter verification failed.",
  );
  process.exitCode = 1;
});
