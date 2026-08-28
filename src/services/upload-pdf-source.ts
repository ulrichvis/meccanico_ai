import "server-only";

import { createUploadedSource, findUploadedSource } from "@/sources/source-repository";
import { getSourceStorage } from "@/storage/source-storage.server";
import { storeSourceFile } from "@/storage/store-source-file";

export async function uploadPdfSource(sourceId: string, file: File) {
  const existingSource = await findUploadedSource(sourceId);

  if (existingSource) {
    return { source: existingSource, duplicate: true };
  }

  try {
    const source = await storeSourceFile({
      file,
      sourceId,
      storage: getSourceStorage(),
      persist: (storedFile) => createUploadedSource(sourceId, storedFile),
    });

    return { source, duplicate: false };
  } catch (error) {
    const concurrentlyCreatedSource = await findUploadedSource(sourceId);

    if (concurrentlyCreatedSource) {
      return { source: concurrentlyCreatedSource, duplicate: true };
    }

    throw error;
  }
}
