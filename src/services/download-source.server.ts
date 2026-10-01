import "server-only";

import { findSourceForTextExtraction } from "@/sources/source-repository";
import { getSourceStorage } from "@/storage/source-storage.server";

export async function getSourceDownloadUrl(sourceId: string): Promise<string | null> {
  const source = await findSourceForTextExtraction(sourceId);

  if (!source || source.type !== "PDF" || !source.storagePath) return null;

  return getSourceStorage().createSignedUrl(
    source.storagePath,
    300,
    source.originalFilename || "document.pdf",
  );
}
