import "server-only";

import { OpenAIPdfTextExtractor } from "@/ai/openai-pdf-text-extractor";
import { env } from "@/lib/env";

let pdfTextExtractor: OpenAIPdfTextExtractor | undefined;

export class OpenAIConfigurationError extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL are required for PDF text extraction.",
    );
    this.name = "OpenAIConfigurationError";
  }
}

export function getPdfTextExtractor(): OpenAIPdfTextExtractor {
  if (!env.OPENAI_API_KEY || !env.OPENAI_EXTRACTION_MODEL) {
    throw new OpenAIConfigurationError();
  }

  pdfTextExtractor ??= new OpenAIPdfTextExtractor({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_EXTRACTION_MODEL,
  });

  return pdfTextExtractor;
}
