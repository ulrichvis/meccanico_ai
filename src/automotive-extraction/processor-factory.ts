import { OpenAIAutomotiveKnowledgeExtractor } from "@/ai/openai-automotive-knowledge-extractor";
import { AutomotiveExtractionRepository } from "@/automotive-extraction/automotive-extraction-repository";
import { processAutomotiveSource } from "@/automotive-extraction/process-automotive-source";
import { getDatabaseClient } from "@/db/client";
import { env } from "@/lib/env";
import { AutomotiveGraphRepository } from "@/persistence/automotive-graph-repository";
import { persistAcceptedAutomotiveSource } from "@/services/persist-accepted-automotive-source";
import { processAutomotiveKnowledgeSource } from "@/services/process-automotive-knowledge-source";

export class AutomotiveAIConfigurationError extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY and OPENAI_AUTOMOTIVE_MODEL are required for automotive knowledge extraction.",
    );
    this.name = "AutomotiveAIConfigurationError";
  }
}

export function createAutomotiveSourceProcessor() {
  if (!env.OPENAI_API_KEY || !env.OPENAI_AUTOMOTIVE_MODEL) {
    throw new AutomotiveAIConfigurationError();
  }

  const apiKey = env.OPENAI_API_KEY;
  const primaryModel = env.OPENAI_AUTOMOTIVE_MODEL;
  const database = getDatabaseClient();
  const extractionRepository = new AutomotiveExtractionRepository(database);
  const graphRepository = new AutomotiveGraphRepository(database);

  return (sourceId: string) =>
    processAutomotiveKnowledgeSource(sourceId, {
      extract: (id) =>
        processAutomotiveSource(id, {
          repository: extractionRepository,
          routing: {
            primary: primaryModel,
            escalation: env.OPENAI_AUTOMOTIVE_MODEL_ESCALATION,
            exceptional: env.OPENAI_AUTOMOTIVE_MODEL_EXCEPTIONAL,
            maxAttempts: env.OPENAI_AUTOMOTIVE_MAX_ATTEMPTS,
          },
          createExtractor: (model) =>
            new OpenAIAutomotiveKnowledgeExtractor({
              apiKey,
              model,
              reasoningEffort: env.OPENAI_AUTOMOTIVE_REASONING_EFFORT,
            }),
        }),
      persist: (id) =>
        persistAcceptedAutomotiveSource(id, { repository: graphRepository }),
    });
}
