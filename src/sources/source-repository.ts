import "server-only";

import { getDatabaseClient } from "@/db/client";
import { SourceStatus, SourceType } from "@/generated/prisma/enums";
import type { StoredSourceFile } from "@/storage/store-source-file";

export interface UploadedSource {
  id: string;
  originalFilename: string | null;
  status: "UPLOADED";
}

export async function findUploadedSource(
  sourceId: string,
): Promise<UploadedSource | null> {
  return getDatabaseClient().source.findUnique({
    where: { id: sourceId },
    select: { id: true, originalFilename: true, status: true },
  }) as Promise<UploadedSource | null>;
}

export async function createUploadedSource(
  sourceId: string,
  file: StoredSourceFile,
): Promise<UploadedSource> {
  return getDatabaseClient().source.create({
    data: {
      id: sourceId,
      mimeType: file.mimeType,
      originalFilename: file.originalFilename,
      status: SourceStatus.UPLOADED,
      storagePath: file.storagePath,
      type: SourceType.PDF,
    },
    select: { id: true, originalFilename: true, status: true },
  }) as Promise<UploadedSource>;
}
