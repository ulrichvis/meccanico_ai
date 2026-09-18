import "server-only";

import { createAutomotiveSourceProcessor } from "@/ai/automotive-knowledge-extractor.server";

export async function processAutomotiveSourceOnServer(sourceId: string) {
  return createAutomotiveSourceProcessor()(sourceId);
}
