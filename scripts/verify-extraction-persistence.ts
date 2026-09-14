import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { SourceStorage } from "../src/storage/source-storage";
import type { PdfTextExtraction } from "../src/schemas/pdf-text-extraction.schema";

loadEnvConfig(process.cwd());

const content: PdfTextExtraction = {
  title: "Synthetic extraction check", author: null, sourceDate: "March 2024", language: "en", pageCount: 2,
  pages: [
    { pageNumber: 1, text: "Measured voltage: 12.4 V.", textQuality: "readable", uncertainty: null },
    { pageNumber: 2, text: "Connector location", textQuality: "partial", uncertainty: "The remaining text is unreadable." },
  ],
};
const signedUrl = "https://example.invalid/document.pdf?token=private-verification-token";
const storage: SourceStorage = {
  getFileInfo: async () => ({ contentType: "application/pdf", sizeBytes: 200 }),
  createSignedUrl: async () => signedUrl,
  upload: async () => { throw new Error("Synthetic verification must not upload files."); },
  remove: async () => { throw new Error("Synthetic verification must not remove files."); },
};

function responseFor(output: unknown) {
  return {
    id: `synthetic-${randomUUID()}`, model: "synthetic-model", status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
  };
}

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const { ExtractionRepository } = await import("../src/extraction/extraction-repository");
  const { processSource } = await import("../src/extraction/process-source");
  const { OpenAIPdfTextExtractor } = await import("../src/ai/openai-pdf-text-extractor");
  const { evaluateTextQuality, parseSourceDate } = await import("../src/extraction/text-quality");
  const { pdfTextExtractionSchema } = await import("../src/schemas/pdf-text-extraction.schema");
  const database = getDatabaseClient();
  const repository = new ExtractionRepository(database);
  const sourceIds: string[] = [];
  const createSource = async () => {
    const id = randomUUID();
    await database.source.create({ data: {
      id, type: "PDF", mimeType: "application/pdf", originalFilename: "synthetic-extraction-verification.pdf",
      storagePath: `verification/${id}.pdf`,
    } });
    sourceIds.push(id);
    return id;
  };
  const runWith = (sourceId: string, responses: unknown[], models: string[] = []) => processSource(sourceId, {
    repository, storage, maximumSizeBytes: 1000,
    routing: { primary: "primary", escalation: "escalation", exceptional: "exceptional", maxAttempts: 2 },
    createExtractor: (model) => {
      models.push(model);
      return new OpenAIPdfTextExtractor({ apiKey: "synthetic", model, fetchImplementation: async () => {
        const response = responses.shift();
        assert(response !== undefined, "Unexpected additional provider call.");
        return Response.json(response);
      } });
    },
  });

  try {
    assert.equal(parseSourceDate("March 2024"), null);
    assert.equal(parseSourceDate("2024-02-30"), null);
    assert.equal(parseSourceDate("2024-02-29")?.toISOString(), "2024-02-29T00:00:00.000Z");
    assert.equal(pdfTextExtractionSchema.safeParse({ ...content, pages: [...content.pages].reverse() }).success, false);
    assert.equal(evaluateTextQuality(content).accepted, true);

    const id = await createSource();
    const models: string[] = [];
    const invalid = responseFor({ ...content, pageCount: 99 });
    const result = await runWith(id, [invalid, responseFor(content)], models);
    assert.equal(result.status, "completed");
    assert.deepEqual(models, ["primary", "escalation"]);
    const jobs = await database.extractionJob.findMany({ where: { sourceId: id }, orderBy: { createdAt: "asc" } });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].status, "SCHEMA_INVALID");
    assert.equal(jobs[1].status, "COMPLETED");
    assert(JSON.stringify(jobs[0].rawAiOutput).includes(invalid.id));
    const stored = await database.source.findUniqueOrThrow({ where: { id }, include: { documents: true } });
    assert.equal(stored.status, "TEXT_EXTRACTED");
    assert.equal(stored.rawText, content.pages.map((page) => page.text).join("\n\n"));
    assert.equal(stored.sourceDate, null);
    assert.deepEqual(stored.documents[0].pagesJson, content.pages);
    assert(JSON.stringify(stored.documents[0].metadataJson).includes("unreviewed"));
    const previousRaw = JSON.stringify(jobs[0].rawAiOutput);
    assert.equal((await runWith(id, [])).status, "already_processed");
    assert.equal(await database.document.count({ where: { sourceId: id } }), 1);
    assert.equal(await database.extractionJob.count({ where: { sourceId: id } }), 2);
    assert.equal(JSON.stringify((await database.extractionJob.findUniqueOrThrow({ where: { id: jobs[0].id } })).rawAiOutput), previousRaw);

    const failedId = await createSource();
    const empty = { ...content, pages: content.pages.map((page) => ({ ...page, text: "" })) };
    assert.equal((await runWith(failedId, [responseFor(empty), responseFor(empty)])).status, "failed");
    assert.equal(await database.document.count({ where: { sourceId: failedId } }), 0);
    assert.equal((await runWith(failedId, [responseFor(content)])).status, "completed");
    assert.equal(await database.extractionJob.count({ where: { sourceId: failedId } }), 3);

    const refusedId = await createSource();
    const refusal = { ...responseFor(content), output: [{ type: "message", content: [{ type: "refusal", refusal: signedUrl }] }] };
    assert.equal((await runWith(refusedId, [refusal])).status, "failed");
    const refusedJob = await database.extractionJob.findFirstOrThrow({ where: { sourceId: refusedId } });
    assert.equal(refusedJob.error, "OPENAI_RESPONSE_REFUSED");
    assert(!JSON.stringify(refusedJob.rawAiOutput).includes("private-verification-token"));

    const encodedId = await createSource();
    const corrupt = { ...content, title: "bad\u0000title" };
    assert.equal((await runWith(encodedId, [responseFor(corrupt), responseFor(corrupt)])).status, "failed");
    assert.equal(await database.document.count({ where: { sourceId: encodedId } }), 0);
    assert.equal(await database.extractionJob.count({ where: { sourceId: encodedId, status: "SCHEMA_INVALID" } }), 2);

    const concurrentId = await createSource();
    let releaseProvider!: () => void;
    let reportProviderStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => { reportProviderStarted = resolve; });
    const providerReleased = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const first = processSource(concurrentId, {
      repository, storage, maximumSizeBytes: 1000, routing: { primary: "primary", maxAttempts: 1 },
      createExtractor: (model) => new OpenAIPdfTextExtractor({ apiKey: "synthetic", model, fetchImplementation: async () => {
        reportProviderStarted();
        await providerReleased;
        return Response.json(responseFor(content));
      } }),
    });
    try {
      await Promise.race([providerStarted, first.then(() => { throw new Error("Provider did not start."); })]);
      assert.equal((await runWith(concurrentId, [])).status, "busy");
    } finally {
      releaseProvider();
      await first;
    }
    assert.equal(await database.document.count({ where: { sourceId: concurrentId } }), 1);
    assert.equal(await database.extractionJob.count({ where: { sourceId: concurrentId } }), 1);

    const interruptedId = await createSource();
    const interrupted = await repository.claim(interruptedId, { model: "primary", tier: "primary" });
    assert.equal(interrupted.status, "claimed");
    await database.source.update({ where: { id: interruptedId }, data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) } });
    assert.equal((await runWith(interruptedId, [responseFor(content)])).status, "completed");
    if (interrupted.status === "claimed") {
      await assert.rejects(() => repository.failAttempt(interruptedId, interrupted.jobId, "OLD_WORKER", false, null), /EXTRACTION_OWNERSHIP_LOST/);
    }
    assert.equal(await database.extractionJob.count({ where: { sourceId: interruptedId, error: "ATTEMPT_INTERRUPTED" } }), 1);

    const rollbackId = await createSource();
    const rollbackClaim = await repository.claim(rollbackId, { model: "primary", tier: "primary" });
    assert.equal(rollbackClaim.status, "claimed");
    if (rollbackClaim.status === "claimed") {
      await assert.rejects(() => repository.complete(rollbackId, rollbackClaim.jobId, {
        model: "synthetic", output: { ...content, author: "invalid\u0000author" },
        promptVersion: "text-extraction-v1.1", responseId: "rollback", rawResponse: {}, usage: null,
      }, evaluateTextQuality(content), { model: "primary", tier: "primary" }));
      assert.equal(await database.document.count({ where: { sourceId: rollbackId } }), 0);
      assert.equal((await database.source.findUniqueOrThrow({ where: { id: rollbackId } })).rawText, null);
    }
    assert.equal(await database.case.count({ where: { sourceId: { in: sourceIds } } }), 0);
    console.info("Extraction persistence, audit history, bounded escalation, retry, concurrency, stale ownership, and rollback checks passed.");
  } finally {
    try {
      await database.$transaction(async (tx) => {
        await tx.document.deleteMany({ where: { sourceId: { in: sourceIds } } });
        await tx.extractionJob.deleteMany({ where: { sourceId: { in: sourceIds } } });
        await tx.source.deleteMany({ where: { id: { in: sourceIds } } });
      });
      console.info("Removed only the synthetic verification records created by this run.");
    } finally {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: extraction verification failed.` : "Extraction verification failed.");
  process.exitCode = 1;
});
