import "server-only";
import { createSourceProcessor } from "@/extraction/processor-factory";
import { getSourceStorage } from "@/storage/source-storage.server";

export async function processSource(sourceId: string) {
  return createSourceProcessor(getSourceStorage())(sourceId);
}
