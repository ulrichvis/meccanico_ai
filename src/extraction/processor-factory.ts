import { OpenAIPdfTextExtractor } from "@/ai/openai-pdf-text-extractor";
import { getDatabaseClient } from "@/db/client";
import { ExtractionRepository } from "@/extraction/extraction-repository";
import { processSource } from "@/extraction/process-source";
import { env } from "@/lib/env";
import type { SourceStorage } from "@/storage/source-storage";

// Called only by the server-only service or the trusted operator CLI.
export function createSourceProcessor(storage: SourceStorage) {
  const apiKey = env.OPENAI_API_KEY;
  const primary = env.OPENAI_EXTRACTION_MODEL;
  if (!apiKey || !primary) throw new Error("OPENAI_CONFIGURATION_MISSING");
  const repository = new ExtractionRepository(getDatabaseClient());
  return (sourceId: string) => processSource(sourceId, {
    repository, storage, maximumSizeBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    routing: {
      primary, escalation: env.OPENAI_EXTRACTION_MODEL_ESCALATION,
      exceptional: env.OPENAI_EXTRACTION_MODEL_EXCEPTIONAL, maxAttempts: env.OPENAI_EXTRACTION_MAX_ATTEMPTS,
    },
    createExtractor: (model) => new OpenAIPdfTextExtractor({ apiKey, model }),
  });
}
