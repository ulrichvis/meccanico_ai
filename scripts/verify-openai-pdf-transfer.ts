import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

const verificationEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_EXTRACTION_MODEL: z.string().min(1),
});

async function verifyOpenAIPdfTransfer(): Promise<void> {
  const requestedSourceId = process.argv[2]
    ? z.uuid().parse(process.argv[2])
    : null;
  const environment = verificationEnvironmentSchema.parse(process.env);
  const { OpenAIPdfTextExtractor } = await import(
    "../src/ai/openai-pdf-text-extractor"
  );
  const { getDatabaseClient } = await import("../src/db/client");
  const { SupabaseSourceStorage } = await import(
    "../src/storage/supabase-source-storage"
  );
  const { getStorageConfig } = await import("./storage-config");
  const database = getDatabaseClient();

  try {
    const selection = {
      id: true,
      mimeType: true,
      status: true,
      storagePath: true,
      type: true,
    } as const;
    const source = requestedSourceId
      ? await database.source.findUnique({
          where: { id: requestedSourceId },
          select: selection,
        })
      : await database.source.findFirst({
          where: {
            mimeType: "application/pdf",
            status: "UPLOADED",
            storagePath: { not: null },
            type: "PDF",
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: selection,
        });

    if (
      !source ||
      source.type !== "PDF" ||
      source.status !== "UPLOADED" ||
      source.mimeType !== "application/pdf" ||
      !source.storagePath
    ) {
      throw new Error("The selected source is not an eligible uploaded PDF.");
    }

    const storageConfig = getStorageConfig();
    const storage = new SupabaseSourceStorage(
      storageConfig.client,
      storageConfig.bucket,
    );
    const fileInfo = await storage.getFileInfo(source.storagePath);

    if (
      fileInfo.contentType !== "application/pdf" ||
      fileInfo.sizeBytes <= 0 ||
      fileInfo.sizeBytes > storageConfig.maximumSizeBytes
    ) {
      throw new Error("The stored object is not an eligible non-empty PDF.");
    }

    const signedUrl = await storage.createSignedUrl(source.storagePath, 600);
    const extractor = new OpenAIPdfTextExtractor({
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_EXTRACTION_MODEL,
    });
    const result = await extractor.extract(signedUrl);
    const characterCount = result.output.pages.reduce(
      (total, page) => total + page.text.length,
      0,
    );

    console.info(
      JSON.stringify(
        {
          characterCount,
          model: result.model,
          pageCount: result.output.pageCount,
          promptVersion: result.promptVersion,
          responseId: result.responseId,
          sourceId: source.id,
          usage: result.usage,
        },
        null,
        2,
      ),
    );
  } finally {
    await database.$disconnect();
  }
}

verifyOpenAIPdfTransfer().catch((error: unknown) => {
  const message =
    error instanceof z.ZodError
      ? z.prettifyError(error)
      : error instanceof Error
        ? error.message
        : "Unknown OpenAI PDF transfer error.";
  console.error(`OpenAI PDF transfer verification failed: ${message}`);
  process.exitCode = 1;
});
