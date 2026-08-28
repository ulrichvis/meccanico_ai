import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

interface UploadResponse {
  duplicate?: boolean;
  error?: { code?: string };
  sourceId?: string;
}

async function submitFile(
  applicationUrl: string,
  uploadId: string,
  file: File,
): Promise<{ body: UploadResponse; status: number }> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("uploadId", uploadId);
  const response = await fetch(`${applicationUrl}/api/sources`, {
    body: formData,
    method: "POST",
  });

  return {
    body: (await response.json()) as UploadResponse,
    status: response.status,
  };
}

async function verifyUpload(): Promise<void> {
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { getDatabaseClient } = await import("../src/db/client");
  const { SupabaseSourceStorage } = await import(
    "../src/storage/supabase-source-storage"
  );
  const { getStorageConfig } = await import("./storage-config");
  const database = getDatabaseClient();
  const storageConfig = getStorageConfig();
  const storage = new SupabaseSourceStorage(
    storageConfig.client,
    storageConfig.bucket,
  );
  const uploadId = randomUUID();
  const invalidUploadId = randomUUID();
  let storagePath: string | null = null;

  try {
    const file = new File(["%PDF-1.7\n% upload verification\n%%EOF"], "verification.pdf", {
      type: "application/pdf",
    });
    const first = await submitFile(applicationUrl, uploadId, file);
    const repeated = await submitFile(applicationUrl, uploadId, file);

    if (
      first.status !== 200 ||
      first.body.sourceId !== uploadId ||
      first.body.duplicate !== false
    ) {
      throw new Error("The first PDF upload did not create the expected source.");
    }
    if (
      repeated.status !== 200 ||
      repeated.body.sourceId !== uploadId ||
      repeated.body.duplicate !== true
    ) {
      throw new Error("The repeated upload was not handled idempotently.");
    }

    const sources = await database.source.findMany({
      where: { id: uploadId },
      select: { storagePath: true },
    });
    if (sources.length !== 1 || !sources[0].storagePath) {
      throw new Error("The upload did not leave exactly one stored source.");
    }
    storagePath = sources[0].storagePath;

    const invalid = await submitFile(
      applicationUrl,
      invalidUploadId,
      new File(["not a pdf"], "invalid.pdf", { type: "application/pdf" }),
    );
    if (invalid.status !== 400 || invalid.body.error?.code !== "invalid_pdf") {
      throw new Error("Invalid PDF content was not rejected by the server.");
    }
    if (await database.source.findUnique({ where: { id: invalidUploadId } })) {
      throw new Error("The rejected upload unexpectedly created a source.");
    }

    console.info(
      "PDF upload, database persistence, idempotency, and invalid-content rejection passed.",
    );
  } finally {
    if (storagePath) {
      await storage.remove(storagePath);
    }
    await database.source.deleteMany({
      where: { id: { in: [uploadId, invalidUploadId] } },
    });
    await database.$disconnect();
  }
}

verifyUpload().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown upload error.";
  console.error(`Upload verification failed: ${message}`);
  process.exitCode = 1;
});
