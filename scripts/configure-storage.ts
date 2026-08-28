import { getStorageConfig } from "./storage-config";

async function configureStorage(): Promise<void> {
  const { bucket, client, maximumSizeBytes } = getStorageConfig();
  const { data: existingBucket, error: readError } =
    await client.storage.getBucket(bucket);
  const options = {
    allowedMimeTypes: ["application/pdf"],
    fileSizeLimit: maximumSizeBytes,
    public: false,
  };

  if (readError && readError.message !== "Bucket not found") {
    throw readError;
  }

  const { error } = existingBucket
    ? await client.storage.updateBucket(bucket, options)
    : await client.storage.createBucket(bucket, options);

  if (error) {
    throw error;
  }

  console.info(
    `Private Storage bucket '${bucket}' configured for PDF files up to ${maximumSizeBytes} bytes.`,
  );
}

configureStorage().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Storage error.";
  console.error(`Storage configuration failed: ${message}`);
  process.exitCode = 1;
});
