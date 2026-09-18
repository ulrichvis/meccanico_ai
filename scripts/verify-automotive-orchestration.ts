import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import type {
  AutomotiveKnowledgeExtractor,
  AutomotiveKnowledgeExtractionResult,
} from "../src/ai/automotive-knowledge-extractor";
import { AutomotiveExtractionRepository } from "../src/automotive-extraction/automotive-extraction-repository";
import { processAutomotiveSource } from "../src/automotive-extraction/process-automotive-source";
import { AutomotiveGraphRepository } from "../src/persistence/automotive-graph-repository";
import type { AutomotiveExtraction } from "../src/schemas/automotive-extraction.schema";
import { AUTOMOTIVE_EXTRACTION_PROMPT_VERSION } from "../src/schemas/automotive-extraction.schema";
import { persistAcceptedAutomotiveSource } from "../src/services/persist-accepted-automotive-source";
import { processAutomotiveKnowledgeSource } from "../src/services/process-automotive-knowledge-source";

loadEnvConfig(process.cwd());

function extractionWithOneCase(marker: string): AutomotiveExtraction {
  return {
    source: {
      title: "Synthetic orchestration source",
      author: null,
      sourceDate: null,
      language: "en",
    },
    documentAnalysis: { uncertainties: [], requiresHumanReview: false },
    cases: [
      {
        ref: "case-1",
        caseType: "diagnostic_case",
        title: "Synthetic orchestration case",
        vehicles: [
          {
            ref: "vehicle-1",
            brand: `Synthetic ${marker}`,
            model: "Orchestrator",
            generation: null,
            yearFrom: null,
            yearTo: null,
            engineDescription: null,
            engineCode: marker,
            fuelType: null,
            power: null,
            transmission: null,
            compatibilityNote: null,
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        primaryDtc: {
          ref: "dtc-1",
          code: `P${marker.replaceAll("-", "").slice(0, 8)}`,
          description: "Synthetic orchestration DTC",
          relationOrigin: "explicit_source",
          confidence: null,
        },
        relatedDtcs: [],
        complaint: "Synthetic complaint",
        symptoms: [],
        problemDescription: null,
        causes: [],
        components: [],
        diagnosticChecks: [],
        solutions: [],
        repairProcedures: [],
        measurements: [],
        partsMaterials: [],
        repairOutcomes: [],
        evidence: [],
        relationships: [],
      },
    ],
  };
}

function emptyExtraction(): AutomotiveExtraction {
  return {
    source: {
      title: "Synthetic zero-case source",
      author: null,
      sourceDate: null,
      language: "en",
    },
    documentAnalysis: { uncertainties: [], requiresHumanReview: false },
    cases: [],
  };
}

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
    usage: null,
  };
}

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const extractionRepository = new AutomotiveExtractionRepository(database);
  const graphRepository = new AutomotiveGraphRepository(database);
  const sourceIds: string[] = [];
  const markers: string[] = [];

  const createSource = async (marker: string) => {
    const sourceId = randomUUID();
    await database.source.create({
      data: {
        id: sourceId,
        type: "PDF",
        status: "TEXT_EXTRACTED",
        originalFilename: `${marker}.pdf`,
        mimeType: "application/pdf",
        documents: {
          create: {
            title: marker,
            language: "en",
            pageCount: 1,
            pagesJson: [
              {
                pageNumber: 1,
                text: "Synthetic orchestration content.",
                textQuality: "readable",
                uncertainty: null,
              },
            ],
            metadataJson: { author: null, sourceDate: null },
          },
        },
      },
    });
    sourceIds.push(sourceId);
    markers.push(marker);
    return sourceId;
  };

  const run = async (
    sourceId: string,
    output: AutomotiveExtraction,
    calls: { count: number },
  ) =>
    processAutomotiveKnowledgeSource(sourceId, {
      extract: (id) =>
        processAutomotiveSource(id, {
          repository: extractionRepository,
          routing: { primary: "synthetic-model", maxAttempts: 1 },
          createExtractor: (model): AutomotiveKnowledgeExtractor => ({
            extract: async (_input, onRawResponse) => {
              calls.count += 1;
              const result = resultFor(model, output);
              await onRawResponse?.(result.rawResponse);
              return result;
            },
          }),
        }),
      persist: (id) =>
        persistAcceptedAutomotiveSource(id, { repository: graphRepository }),
    });

  try {
    const marker = `orchestration-${randomUUID()}`;
    const sourceId = await createSource(marker);
    const calls = { count: 0 };
    const first = await run(sourceId, extractionWithOneCase(marker), calls);
    assert.equal(first.status, "persisted");
    assert.equal(first.caseIds.length, 1);
    assert.equal(calls.count, 1);

    const source = await database.source.findUniqueOrThrow({
      where: { id: sourceId },
      include: { extractionJobs: true, cases: true },
    });
    assert.equal(source.status, "PERSISTED");
    assert.equal(source.extractionJobs.length, 1);
    assert.equal(source.extractionJobs[0]!.status, "COMPLETED");
    assert.equal(source.cases.length, 1);
    const immutableArtifact = JSON.stringify(
      source.extractionJobs[0]!.validatedOutput,
    );

    const retry = await run(sourceId, extractionWithOneCase(marker), calls);
    assert.equal(retry.status, "already_persisted");
    assert.equal(retry.caseIds.length, 1);
    assert.equal(calls.count, 1);
    assert.equal(await database.case.count({ where: { sourceId } }), 1);
    assert.equal(
      await database.extractionJob.count({ where: { sourceId } }),
      1,
    );
    assert.equal(
      JSON.stringify(
        (
          await database.extractionJob.findFirstOrThrow({
            where: { sourceId },
          })
        ).validatedOutput,
      ),
      immutableArtifact,
    );

    const zeroMarker = `zero-orchestration-${randomUUID()}`;
    const zeroSourceId = await createSource(zeroMarker);
    const zeroCalls = { count: 0 };
    const zeroFirst = await run(zeroSourceId, emptyExtraction(), zeroCalls);
    assert.equal(zeroFirst.status, "persisted");
    assert.deepEqual(zeroFirst.caseIds, []);
    assert.equal(zeroCalls.count, 1);
    assert.equal(
      (await database.source.findUniqueOrThrow({ where: { id: zeroSourceId } }))
        .status,
      "PERSISTED",
    );
    assert.equal(
      await database.case.count({ where: { sourceId: zeroSourceId } }),
      0,
    );

    const zeroRetry = await run(zeroSourceId, emptyExtraction(), zeroCalls);
    assert.equal(zeroRetry.status, "already_persisted");
    assert.deepEqual(zeroRetry.caseIds, []);
    assert.equal(zeroCalls.count, 1);
    assert.equal(
      await database.extractionJob.count({ where: { sourceId: zeroSourceId } }),
      1,
    );

    console.info(
      "End-to-end automotive orchestration, atomic completion, retry idempotency, immutable audit output, and zero-case completion passed without a repeated AI call.",
    );
  } finally {
    try {
      await database.$transaction(async (transaction) => {
        await transaction.case.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.document.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.extractionJob.deleteMany({
          where: { sourceId: { in: sourceIds } },
        });
        await transaction.source.deleteMany({
          where: { id: { in: sourceIds } },
        });
        await transaction.vehicle.deleteMany({
          where: { engineCode: { in: markers } },
        });
        await transaction.dtc.deleteMany({
          where: {
            normalizedCode: {
              in: markers.map(
                (marker) => `P${marker.replaceAll("-", "").slice(0, 8)}`,
              ),
            },
          },
        });
      });
      console.info(
        "Removed only the synthetic orchestration records created by this run.",
      );
    } finally {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: automotive orchestration verification failed.`
      : "Automotive orchestration verification failed.",
  );
  process.exitCode = 1;
});
