import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

async function main() {
  const sourceId = process.argv[2] === "--list" ? null : z.uuid().parse(process.argv[2]);
  const { createAutomotiveSourceProcessor } = await import(
    "../src/automotive-extraction/processor-factory"
  );
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();

  try {
    if (sourceId === null) {
      const sources = await database.source.findMany({
        where: {
          type: "PDF",
          status: {
            in: ["TEXT_EXTRACTED", "PROCESSING", "SCHEMA_INVALID", "FAILED"],
          },
          documents: { some: {} },
        },
        select: { id: true, originalFilename: true, status: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      });
      console.info(JSON.stringify(sources, null, 2));
      return;
    }

    const result = await createAutomotiveSourceProcessor()(sourceId);
    console.info(JSON.stringify(result));
    if (result.status === "failed") process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `${error.name}: automotive source processing failed.`
      : "Automotive source processing failed.",
  );
  process.exitCode = 1;
});
