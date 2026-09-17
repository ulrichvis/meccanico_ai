import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import {
  AutomotiveKnowledgeExtractionError,
  type AutomotiveKnowledgeExtractor,
  type AutomotiveKnowledgeExtractionResult,
} from "../src/ai/automotive-knowledge-extractor";
import { AutomotiveExtractionRepository } from "../src/automotive-extraction/automotive-extraction-repository";
import { processAutomotiveSource } from "../src/automotive-extraction/process-automotive-source";
import { AUTOMOTIVE_EXTRACTION_PROMPT_VERSION } from "../src/schemas/automotive-extraction.schema";
import type { AutomotiveExtraction } from "../src/schemas/automotive-extraction.schema";

loadEnvConfig(process.cwd());

const incompleteOutput: AutomotiveExtraction = {
  source: {
    title: "Synthetic diagnostic note",
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

const acceptedOutput: AutomotiveExtraction = {
  ...incompleteOutput,
  documentAnalysis: {
    uncertainties: [
      {
        caseRef: null,
        pageNumber: 2,
        description: "The second page is partially unreadable.",
      },
    ],
    requiresHumanReview: true,
  },
};

function resultFor(
  model: string,
  output: AutomotiveExtraction,
): AutomotiveKnowledgeExtractionResult {
  return {
    model,
    output,
    promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
    rawResponse: { id: `synthetic-${randomUUID()}`, output },
    reasoningEffort: "medium",
    responseId: `synthetic-${randomUUID()}`,
    usage: {
      cachedTokens: 2,
      inputTokens: 20,
      outputTokens: 10,
      reasoningTokens: 3,
      totalTokens: 30,
    },
  };
}

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const repository = new AutomotiveExtractionRepository(database);
  const sourceIds: string[] = [];

  const createSource = async () => {
    const sourceId = randomUUID();
    await database.source.create({
      data: {
        id: sourceId,
        type: "PDF",
        status: "TEXT_EXTRACTED",
        originalFilename: "synthetic-automotive-verification.pdf",
        mimeType: "application/pdf",
        documents: {
          create: {
            title: "Synthetic diagnostic note",
            language: "en",
            pageCount: 2,
            pagesJson: [
              {
                pageNumber: 1,
                text: "The engine warning light is on.",
                textQuality: "readable",
                uncertainty: null,
              },
              {
                pageNumber: 2,
                text: "Connector text is incomplete.",
                textQuality: "partial",
                uncertainty: "The lower half is unreadable.",
              },
            ],
            metadataJson: { author: null, sourceDate: null },
          },
        },
      },
    });
    sourceIds.push(sourceId);
    return sourceId;
  };

  try {
    const sourceId = await createSource();
    const calledModels: string[] = [];
    const outputs = [incompleteOutput, acceptedOutput];

    const createExtractor = (model: string): AutomotiveKnowledgeExtractor => ({
      extract: async (_input, onRawResponse) => {
        calledModels.push(model);
        const output = outputs.shift();
        assert(output, "Unexpected additional automotive model call.");
        const result = resultFor(model, output);
        await onRawResponse?.(result.rawResponse);
        return result;
      },
    });

    const run = () =>
      processAutomotiveSource(sourceId, {
        repository,
        routing: {
          primary: "synthetic-primary",
          escalation: "synthetic-escalation",
          maxAttempts: 2,
        },
        createExtractor,
      });

    assert.equal((await run()).status, "completed");
    assert.deepEqual(calledModels, ["synthetic-primary", "synthetic-escalation"]);

    const jobs = await database.extractionJob.findMany({
      where: { sourceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0]?.status, "SCHEMA_INVALID");
    assert.equal(jobs[0]?.error, "HUMAN_REVIEW_FLAG_MISSING");
    assert.equal(jobs[1]?.status, "COMPLETED");
    assert.equal(jobs[0]?.model, "synthetic-primary");
    assert.equal(jobs[1]?.model, "synthetic-escalation");
    assert.equal(jobs[0]?.promptVersion, AUTOMOTIVE_EXTRACTION_PROMPT_VERSION);
    assert(jobs.every((job) => job.rawAiOutput !== null));
    assert(jobs.every((job) => job.validatedOutput !== null));
    assert(jobs.every((job) => job.startedAt && job.finishedAt));

    const firstRawOutput = JSON.stringify(jobs[0]?.rawAiOutput);
    assert.equal((await run()).status, "already_processed");
    assert.equal(
      await database.extractionJob.count({ where: { sourceId } }),
      2,
    );
    assert.equal(
      JSON.stringify(
        (
          await database.extractionJob.findUniqueOrThrow({
            where: { id: jobs[0]!.id },
          })
        ).rawAiOutput,
      ),
      firstRawOutput,
    );
    assert.equal(await database.case.count({ where: { sourceId } }), 0);
    assert.equal(
      (await database.source.findUniqueOrThrow({ where: { id: sourceId } }))
        .status,
      "PROCESSING",
    );

    const providerFailureSourceId = await createSource();
    let providerCalls = 0;
    const providerFailure = await processAutomotiveSource(
      providerFailureSourceId,
      {
        repository,
        routing: {
          primary: "synthetic-primary",
          escalation: "synthetic-escalation",
          maxAttempts: 2,
        },
        createExtractor: (): AutomotiveKnowledgeExtractor => ({
          extract: async () => {
            providerCalls += 1;
            throw new AutomotiveKnowledgeExtractionError(
              "AUTOMOTIVE_AI_REQUEST_FAILED",
            );
          },
        }),
      },
    );
    assert.equal(providerFailure.status, "failed");
    assert.equal(providerCalls, 1);
    assert.equal(
      await database.extractionJob.count({
        where: { sourceId: providerFailureSourceId },
      }),
      1,
    );
    assert.equal(
      (
        await database.source.findUniqueOrThrow({
          where: { id: providerFailureSourceId },
        })
      ).status,
      "FAILED",
    );

    console.info(
      "Automotive quality gates, bounded escalation, immutable attempt history, and zero domain-row writes passed.",
    );
  } finally {
    try {
      await database.$transaction(async (transaction) => {
        await transaction.document.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.extractionJob.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.source.deleteMany({
          where: { id: { in: sourceIds } },
        });
      });
      console.info(
        "Removed only the synthetic automotive verification records created by this run.",
      );
    } finally {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: automotive persistence verification failed.`
      : "Automotive persistence verification failed.",
  );
  process.exitCode = 1;
});
