import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

async function main() {
  const sourceId = process.argv[2] === "--list" ? null : z.uuid().parse(process.argv[2]);
  const { createSourceProcessor } = await import("../src/extraction/processor-factory");
  const { getDatabaseClient } = await import("../src/db/client");
  const { SupabaseSourceStorage } = await import("../src/storage/supabase-source-storage");
  const { getStorageConfig } = await import("./storage-config");
  const { client, bucket } = getStorageConfig();
  try {
    if (sourceId === null) {
      const sources = await getDatabaseClient().source.findMany({
        where: { type: "PDF", status: { in: ["UPLOADED", "FAILED", "TEXT_EXTRACTED", "EXTRACTING_TEXT"] } },
        select: { id: true, status: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
      });
      console.info(JSON.stringify(sources, null, 2));
      return;
    }
    const result = await createSourceProcessor(new SupabaseSourceStorage(client, bucket))(sourceId);
    console.info(JSON.stringify(result));
    if (result.status === "failed") process.exitCode = 1;
  } finally {
    await getDatabaseClient().$disconnect();
  }
}

main().catch(() => {
  console.error("Source processing failed. Verify the source UUID, configuration, and extraction history.");
  process.exitCode = 1;
});
