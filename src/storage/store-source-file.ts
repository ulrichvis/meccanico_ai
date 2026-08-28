import type { SourceStorage } from "@/storage/source-storage";
import { StorageCompensationError } from "@/storage/storage-errors";
import { createSourceStoragePath } from "@/storage/storage-path";
import { validatePdfUpload } from "@/storage/pdf-upload-validation";

export interface StoredSourceFile {
  mimeType: "application/pdf";
  originalFilename: string;
  sizeBytes: number;
  storagePath: string;
}

interface StoreSourceFileInput<Result> {
  file: File;
  persist: (storedFile: StoredSourceFile) => Promise<Result>;
  sourceId: string;
  storage: SourceStorage;
}

export async function storeSourceFile<Result>({
  file,
  persist,
  sourceId,
  storage,
}: StoreSourceFileInput<Result>): Promise<Result> {
  const metadata = await validatePdfUpload(file);
  const storagePath = createSourceStoragePath(sourceId);

  await storage.upload({
    content: file,
    contentType: metadata.type,
    path: storagePath,
  });

  try {
    return await persist({
      mimeType: metadata.type,
      originalFilename: metadata.name,
      sizeBytes: metadata.size,
      storagePath,
    });
  } catch (persistenceError) {
    try {
      await storage.remove(storagePath);
    } catch (cleanupError) {
      throw new StorageCompensationError(
        storagePath,
        persistenceError,
        cleanupError,
      );
    }

    throw persistenceError;
  }
}
