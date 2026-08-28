import { randomUUID } from "node:crypto";

import { z } from "zod";

import { env } from "../src/lib/env";
import { pdfUploadMetadataSchema, validatePdfUpload } from "../src/storage/pdf-upload-validation";
import type { SourceStorage } from "../src/storage/source-storage";
import { createSourceStoragePath } from "../src/storage/storage-path";
import { storeSourceFile } from "../src/storage/store-source-file";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectFailure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch {
    return;
  }

  throw new Error("An invalid upload was unexpectedly accepted.");
}

async function checkStorageBoundaries(): Promise<void> {
  const validFile = new File(["%PDF-1.7\n%%EOF"], "submitted name.pdf", {
    type: "application/pdf",
  });
  await validatePdfUpload(validFile);

  await expectFailure(() =>
    validatePdfUpload(
      new File(["%PDF-1.7"], "document.txt", { type: "application/pdf" }),
    ),
  );
  await expectFailure(() =>
    validatePdfUpload(
      new File(["%PDF-1.7"], "document.pdf", { type: "text/plain" }),
    ),
  );
  await expectFailure(() =>
    validatePdfUpload(
      new File(["not a pdf"], "document.pdf", { type: "application/pdf" }),
    ),
  );
  await expectFailure(() =>
    pdfUploadMetadataSchema.parse({
      name: "document.pdf",
      size: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1,
      type: "application/pdf",
    }),
  );

  const sourceId = randomUUID();
  const path = createSourceStoragePath(sourceId);
  assert(path.startsWith(`sources/${sourceId}/`), "The generated path has an invalid prefix.");
  assert(!path.includes("submitted name"), "The generated path uses the submitted filename.");

  const removedPaths: string[] = [];
  const storage: SourceStorage = {
    createSignedUrl: async () => "https://example.invalid/signed",
    getFileInfo: async () => ({
      contentType: "application/pdf",
      sizeBytes: validFile.size,
    }),
    remove: async (storagePath) => {
      removedPaths.push(storagePath);
    },
    upload: async () => undefined,
  };
  const persistenceFailure = new Error("Synthetic database failure.");

  try {
    await storeSourceFile({
      file: validFile,
      persist: async () => {
        throw persistenceFailure;
      },
      sourceId,
      storage,
    });
  } catch (error) {
    assert(error === persistenceFailure, "The persistence error was not preserved.");
  }

  assert(removedPaths.length === 1, "The uploaded file was not removed after persistence failed.");
  console.info("Storage validation, opaque paths, and compensation checks passed.");
}

checkStorageBoundaries().catch((error: unknown) => {
  const message = error instanceof z.ZodError
    ? z.prettifyError(error)
    : error instanceof Error
      ? error.message
      : "Unknown Storage check error.";
  console.error(`Storage checks failed: ${message}`);
  process.exitCode = 1;
});
