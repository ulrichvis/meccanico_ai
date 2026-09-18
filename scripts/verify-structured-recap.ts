import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import { normalizeAutomotiveExtraction } from "../src/normalization/automotive-normalizer";
import { AutomotiveGraphRepository } from "../src/persistence/automotive-graph-repository";
import type { AutomotiveExtraction } from "../src/schemas/automotive-extraction.schema";
import { AUTOMOTIVE_EXTRACTION_PROMPT_VERSION } from "../src/schemas/automotive-extraction.schema";

loadEnvConfig(process.cwd());

function italianFixture(marker: string): AutomotiveExtraction {
  return {
    source: {
      title: "Diagnosi accensione",
      author: null,
      sourceDate: null,
      language: "it",
    },
    documentAnalysis: { uncertainties: [], requiresHumanReview: false },
    cases: [
      {
        ref: "case-1",
        caseType: "diagnosi officina",
        title: "Mancata accensione intermittente",
        vehicles: [
          {
            ref: "vehicle-1",
            brand: "Fiat",
            model: "Panda",
            generation: null,
            yearFrom: 2018,
            yearTo: 2020,
            engineDescription: "1.2 benzina",
            engineCode: marker,
            fuelType: "benzina",
            power: null,
            transmission: null,
            compatibilityNote: "Verificato sul veicolo descritto",
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        primaryDtc: {
          ref: "dtc-1",
          code: `P${marker.replaceAll("-", "").slice(0, 8)}`,
          description: "Mancate accensioni multiple",
          relationOrigin: "explicit_source",
          confidence: null,
        },
        relatedDtcs: [],
        complaint: "Il motore gira in modo irregolare a freddo.",
        symptoms: [
          {
            ref: "symptom-1",
            name: `Motore irregolare ${marker}`,
            description: "Vibrazione evidente al minimo",
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        problemDescription: "Il difetto compare soprattutto al primo avviamento.",
        causes: [
          {
            ref: "cause-1",
            name: `Bobina di accensione difettosa ${marker}`,
            description: "La bobina potrebbe interrompersi a freddo",
            probabilitySource: null,
            probabilityCalculated: null,
            relationOrigin: "ai_inference",
            confidence: 0.8,
          },
        ],
        components: [
          {
            ref: "component-1",
            name: `Bobina di accensione ${marker}`,
            componentType: "accensione",
            role: "Genera l'alta tensione",
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        diagnosticChecks: [
          {
            ref: "check-1",
            description: "Misurare la tensione di alimentazione della bobina",
            expectedResult: "Circa 12 V",
            actualResult: "11,9 V",
            interpretation: "Alimentazione presente",
            sequenceOrder: 1,
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        solutions: [
          {
            ref: "solution-1",
            name: `Sostituzione della bobina ${marker}`,
            description: "Sostituire la bobina guasta",
            probabilitySource: null,
            probabilityCalculated: null,
            repairConfirmed: true,
            repairSuccessful: true,
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        repairProcedures: [
          {
            ref: "procedure-1",
            solutionRef: "solution-1",
            sequenceOrder: 1,
            instruction: "Scollegare il connettore e sostituire la bobina.",
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        measurements: [
          {
            ref: "measurement-1",
            diagnosticCheckRef: "check-1",
            parameter: "Tensione bobina",
            valueText: "11,9 V",
            numericValue: 11.9,
            unit: "V",
            conditions: "Motore spento, quadro acceso",
            minValue: 11.5,
            maxValue: 12.5,
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        partsMaterials: [
          {
            ref: "part-1",
            name: "Bobina nuova",
            partNumber: marker,
            manufacturer: "Ricambio di prova",
            notes: null,
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        repairOutcomes: [
          {
            ref: "outcome-1",
            solutionRef: "solution-1",
            attempted: true,
            successful: true,
            confirmed: true,
            caseCount: 1,
            successfulCaseCount: 1,
            notes: "Il minimo è tornato regolare.",
          },
        ],
        evidence: [
          {
            ref: "evidence-1",
            targetRef: "solution-1",
            pageNumber: 1,
            excerpt: "Dopo la sostituzione della bobina il minimo è tornato regolare.",
            evidenceType: "confirmed_repair",
            relationOrigin: "explicit_source",
            confidence: null,
          },
        ],
        relationships: [
          {
            ref: "relationship-1",
            fromType: "symptom",
            fromRef: "symptom-1",
            relationshipType: "indica",
            toType: "cause",
            toRef: "cause-1",
            evidenceRef: null,
            relationOrigin: "ai_inference",
            confidence: 0.8,
          },
        ],
      },
    ],
  };
}

async function removeSyntheticFixture(
  database: ReturnType<typeof import("../src/db/client").getDatabaseClient>,
  sourceId: string,
  marker: string,
) {
  await database.$transaction(async (transaction) => {
    await transaction.case.deleteMany({ where: { sourceId } });
    await transaction.document.deleteMany({ where: { sourceId } });
    await transaction.extractionJob.deleteMany({ where: { sourceId } });
    await transaction.source.deleteMany({ where: { id: sourceId } });
    await transaction.vehicle.deleteMany({ where: { engineCode: marker } });
    await transaction.dtc.deleteMany({
      where: {
        normalizedCode: `P${marker.replaceAll("-", "").slice(0, 8)}`,
      },
    });
    await transaction.symptom.deleteMany({
      where: { normalizedName: `motore irregolare ${marker}` },
    });
    await transaction.cause.deleteMany({
      where: { normalizedName: `bobina di accensione difettosa ${marker}` },
    });
    await transaction.solution.deleteMany({
      where: { normalizedName: `sostituzione della bobina ${marker}` },
    });
    await transaction.component.deleteMany({
      where: { normalizedName: `bobina di accensione ${marker}` },
    });
  });
}

async function main() {
  const keep = process.argv.includes("--keep");
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const cleanupArgumentIndex = process.argv.indexOf("--cleanup");

  if (cleanupArgumentIndex >= 0) {
    const cleanupSourceId = process.argv[cleanupArgumentIndex + 1];
    assert(cleanupSourceId, "--cleanup requires a source ID.");
    const cleanupSource = await database.source.findUnique({
      where: { id: cleanupSourceId },
      select: { originalFilename: true },
    });
    assert(cleanupSource, "Synthetic source was not found.");
    assert(
      cleanupSource.originalFilename,
      "Synthetic source filename was not found.",
    );
    const cleanupMarker = cleanupSource.originalFilename.replace(/\.pdf$/u, "");
    assert(
      cleanupMarker.startsWith("structured-recap-"),
      "Cleanup is limited to structured recap fixtures.",
    );
    await removeSyntheticFixture(database, cleanupSourceId, cleanupMarker);
    await database.$disconnect();
    console.info(`Removed synthetic structured recap source ${cleanupSourceId}.`);
    return;
  }

  const sourceId = randomUUID();
  const documentId = randomUUID();
  const extractionJobId = randomUUID();
  const marker = `structured-recap-${randomUUID()}`;
  const extraction = italianFixture(marker);

  try {
    await database.source.create({
      data: {
        id: sourceId,
        type: "PDF",
        status: "PROCESSING",
        originalFilename: `${marker}.pdf`,
        mimeType: "application/pdf",
        rawText: "Dopo la sostituzione della bobina il minimo è tornato regolare.",
        documents: {
          create: {
            id: documentId,
            title: "Diagnosi accensione",
            language: "it",
            pageCount: 1,
            pagesJson: [
              {
                pageNumber: 1,
                text: "Dopo la sostituzione della bobina il minimo è tornato regolare.",
                textQuality: "readable",
                uncertainty: null,
              },
            ],
            metadataJson: { reviewStatus: "unreviewed" },
          },
        },
        extractionJobs: {
          create: {
            id: extractionJobId,
            status: "COMPLETED",
            model: "synthetic-recap",
            promptVersion: AUTOMOTIVE_EXTRACTION_PROMPT_VERSION,
            startedAt: new Date(),
            finishedAt: new Date(),
            rawAiOutput: { fixture: marker },
            validatedOutput: {
              content: extraction,
              quality: { accepted: true, reasons: [] },
            },
          },
        },
      },
    });

    const repository = new AutomotiveGraphRepository(database);
    const persisted = await repository.persistAndCompleteSource({
      documentId,
      extraction: normalizeAutomotiveExtraction(extraction),
      extractionJobId,
      sourceId,
    });

    const detail = await database.source.findUnique({
      where: { id: sourceId },
      select: {
        cases: {
          select: {
            causes: {
              select: { cause: { select: { normalizedName: true } } },
            },
            complaint: true,
            evidence: { select: { excerpt: true } },
            solutions: {
              select: {
                procedures: { select: { instruction: true } },
              },
            },
            title: true,
          },
        },
        documents: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { language: true },
          take: 1,
        },
        status: true,
      },
    });
    assert(detail);
    assert.equal(detail.status, "PERSISTED");
    assert.equal(detail.documents[0]?.language, "it");
    assert.equal(detail.cases.length, 1);
    assert.equal(detail.cases[0]!.title, "Mancata accensione intermittente");
    assert.equal(detail.cases[0]!.complaint, "Il motore gira in modo irregolare a freddo.");
    assert.equal(
      detail.cases[0]!.causes[0]!.cause.normalizedName,
      `bobina di accensione difettosa ${marker}`,
    );
    assert.equal(detail.cases[0]!.solutions[0]!.procedures[0]!.instruction, "Scollegare il connettore e sostituire la bobina.");
    assert.equal(detail.cases[0]!.evidence[0]!.excerpt, "Dopo la sostituzione della bobina il minimo è tornato regolare.");

    console.info(
      JSON.stringify({
        caseId: persisted.caseIds[0] ?? null,
        sourceId,
        url: `/sources/${sourceId}`,
        verifiedLanguage: "it",
      }),
    );
    console.info(
      "Structured recap query preserved Italian extracted content and returned the complete persisted technical case.",
    );
  } finally {
    if (!keep) {
      try {
        await removeSyntheticFixture(database, sourceId, marker);
        console.info(
          "Removed only the synthetic structured recap records created by this run.",
        );
      } finally {
        await database.$disconnect();
      }
    } else {
      await database.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: structured recap verification failed.`
      : "Structured recap verification failed.",
  );
  process.exitCode = 1;
});
