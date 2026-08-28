import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function verifyDatabase(): Promise<void> {
  const { getDatabaseClient } = await import("../src/db/client");
  const { SourceStatus, SourceType } = await import(
    "../src/generated/prisma/enums"
  );
  const database = getDatabaseClient();

  try {
    await database.$transaction(async (transaction) => {
      const createdSource = await transaction.source.create({
        data: {
          type: SourceType.PDF,
          status: SourceStatus.UPLOADED,
          originalFilename: "database-verification.pdf",
          mimeType: "application/pdf",
        },
      });

      const storedSource = await transaction.source.findUnique({
        where: { id: createdSource.id },
      });

      if (!storedSource || storedSource.id !== createdSource.id) {
        throw new Error("The Source create/read verification failed.");
      }

      await transaction.source.delete({ where: { id: createdSource.id } });
    });

    console.info("Database connection and Source create/read verification passed.");
  } finally {
    await database.$disconnect();
  }
}

verifyDatabase().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  console.error(`Database verification failed: ${message}`);
  process.exitCode = 1;
});
