import assert from "node:assert/strict";

import { loadEnvConfig } from "@next/env";
import { z } from "zod";

import { OpenAIAutomotiveKnowledgeExtractor } from "../src/ai/openai-automotive-knowledge-extractor";
import { evaluateAutomotiveQuality } from "../src/automotive-extraction/automotive-quality";
import type { AutomotiveExtractionPromptInput } from "../src/prompts/automotive-extraction.prompt";

loadEnvConfig(process.cwd());

const environmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_AUTOMOTIVE_MODEL: z.string().min(1),
  OPENAI_AUTOMOTIVE_REASONING_EFFORT: z
    .enum(["low", "medium", "high", "xhigh", "max"])
    .default("medium"),
});

const fixtures: Array<{
  input: AutomotiveExtractionPromptInput;
  name: string;
  verify: (output: Awaited<ReturnType<OpenAIAutomotiveKnowledgeExtractor["extract"]>>["output"]) => void;
}> = [
  {
    name: "generic applicability and diagnostic distinctions",
    input: {
      originalFilename: "non-authoritative-specific-model-name.pdf",
      document: {
        title: "Workshop note",
        author: null,
        sourceDate: null,
        language: "en",
        pageCount: 2,
        pages: [
          {
            pageNumber: 1,
            text: "Applies to VAG vehicles with EA211 1.2 or 1.4 TSI engines. Codes P0299 and P2563 may be stored; the note does not identify a primary code. Customers report low power. Frequently, the wastegate linkage is stiff. Check linkage movement before replacing any part.",
            textQuality: "readable",
            uncertainty: null,
          },
          {
            pageNumber: 2,
            text: "Diagnostic check: command the actuator from 10% to 90% and verify smooth travel. This is a test, not a repair. If the linkage binds, cleaning is proposed. The document does not report whether cleaning was attempted or successful.",
            textQuality: "readable",
            uncertainty: null,
          },
        ],
      },
    },
    verify: (output) => {
      assert.equal(output.cases.length, 1);
      const extractedCase = output.cases[0]!;
      assert.equal(extractedCase.primaryDtc, null);
      assert.equal(extractedCase.relatedDtcs.length, 2);
      assert(extractedCase.vehicles.some((vehicle) => vehicle.brand === "VAG"));
      assert(extractedCase.vehicles.every((vehicle) => vehicle.model === null));
      assert(extractedCase.diagnosticChecks.length > 0);
      assert(extractedCase.solutions.length > 0);
      assert(extractedCase.solutions.every((solution) => solution.repairConfirmed !== true));
      assert(extractedCase.causes.some((cause) => cause.probabilitySource?.toLowerCase().includes("frequent")));
      assert(extractedCase.causes.every((cause) => cause.probabilityCalculated === null));
    },
  },
  {
    name: "multiple cases, measurements, variants, and repair outcomes",
    input: {
      originalFilename: "two-cases.pdf",
      document: {
        title: "Two independent workshop cases",
        author: null,
        sourceDate: "2025-02-10",
        language: "en",
        pageCount: 2,
        pages: [
          {
            pageNumber: 1,
            text: "Case A — Ford Focus 1.0 EcoBoost. Complaint: intermittent no-start. Battery voltage measured 9.4 V during cranking at 18 °C; expected minimum is 10.0 V. The battery was replaced, the engine then started normally, and the repair was confirmed on a road test.",
            textQuality: "readable",
            uncertainty: null,
          },
          {
            pageNumber: 2,
            text: "Case B — Fiat 500 1.2 petrol. DTC P0302. Check cylinder 2 compression before repair. Procedure variant X says tighten the plug to 18 Nm; variant Y says 22 Nm. The document does not identify which variant applies. A new ignition coil is proposed but was not fitted.",
            textQuality: "readable",
            uncertainty: null,
          },
        ],
      },
    },
    verify: (output) => {
      assert.equal(output.cases.length, 2);
      assert(output.cases.some((item) => item.measurements.some((measurement) => measurement.unit === "V")));
      assert(output.cases.some((item) => item.repairOutcomes.some((outcome) => outcome.confirmed === true)));
      assert(output.cases.some((item) => item.diagnosticChecks.some((check) => check.description.toLowerCase().includes("compression"))));
      assert(output.cases.some((item) => item.solutions.some((solution) => solution.repairConfirmed === false || solution.repairConfirmed === null)));
      assert(output.documentAnalysis.uncertainties.length > 0);
    },
  },
  {
    name: "visual-only and unreadable content boundary",
    input: {
      originalFilename: "visual-only.pdf",
      document: {
        title: null,
        author: null,
        sourceDate: null,
        language: null,
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            text: "",
            textQuality: "unreadable",
            uncertainty: "The page contains a photograph or diagram, but no readable text was recovered.",
          },
        ],
      },
    },
    verify: (output) => {
      assert.equal(output.cases.length, 0);
      assert.equal(output.documentAnalysis.requiresHumanReview, true);
      assert(output.documentAnalysis.uncertainties.length > 0);
    },
  },
];

async function main() {
  const environment = environmentSchema.parse(process.env);
  const extractor = new OpenAIAutomotiveKnowledgeExtractor({
    apiKey: environment.OPENAI_API_KEY,
    model: environment.OPENAI_AUTOMOTIVE_MODEL,
    reasoningEffort: environment.OPENAI_AUTOMOTIVE_REASONING_EFFORT,
  });
  const results: Array<Record<string, unknown>> = [];

  for (const fixture of fixtures) {
    let rawPreserved = false;
    const result = await extractor.extract(fixture.input, async () => {
      rawPreserved = true;
    });
    const quality = evaluateAutomotiveQuality(fixture.input, result.output);

    assert(rawPreserved, `${fixture.name}: raw response was not exposed.`);
    assert.deepEqual(quality.reasons, [], `${fixture.name}: deterministic quality failed.`);
    fixture.verify(result.output);
    results.push({
      caseCount: result.output.cases.length,
      model: result.model,
      name: fixture.name,
      requiresHumanReview: result.output.documentAnalysis.requiresHumanReview,
      usage: result.usage,
    });
  }

  console.info(JSON.stringify(results, null, 2));
  console.info("Live representative automotive extraction verification passed.");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof z.ZodError
      ? z.prettifyError(error)
      : error instanceof Error
        ? `${error.name}: live automotive verification failed.`
        : "Live automotive verification failed.",
  );
  process.exitCode = 1;
});
