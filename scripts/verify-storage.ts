import { randomUUID } from "node:crypto";

import { getStorageConfig } from "./storage-config";
import { SupabaseSourceStorage } from "../src/storage/supabase-source-storage";
import { createSourceStoragePath } from "../src/storage/storage-path";

async function verifyStorage(): Promise<void> {
  const { bucket, client, maximumSizeBytes } = getStorageConfig();
  const { data: configuredBucket, error: bucketError } =
    await client.storage.getBucket(bucket);

  if (bucketError || !configuredBucket) {
    throw bucketError ?? new Error("The configured Storage bucket was not found.");
  }

  if (configuredBucket.public) {
    throw new Error("The configured Storage bucket is public.");
  }
  if (configuredBucket.file_size_limit !== maximumSizeBytes) {
    throw new Error("The Storage bucket file-size limit does not match the application limit.");
  }
  if (!configuredBucket.allowed_mime_types?.includes("application/pdf")) {
    throw new Error("The Storage bucket does not restrict uploads to PDF MIME types.");
  }

  const storage = new SupabaseSourceStorage(client, bucket);
  const path = createSourceStoragePath(randomUUID());
  const content = new Blob(["%PDF-1.7\n% synthetic verification\n%%EOF"], {
    type: "application/pdf",
  });
  let uploaded = false;

  try {
    await storage.upload({ content, contentType: "application/pdf", path });
    uploaded = true;
    const signedUrl = await storage.createSignedUrl(path, 60);
    const response = await fetch(signedUrl);

    if (!response.ok || !(await response.text()).startsWith("%PDF-")) {
      throw new Error("The signed URL did not return the uploaded PDF.");
    }
  } finally {
    if (uploaded) {
      await storage.remove(path);
    }
  }

  console.info("Private Storage upload, signed retrieval, and cleanup verification passed.");
}

verifyStorage().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Storage error.";
  console.error(`Storage verification failed: ${message}`);
  process.exitCode = 1;
});
