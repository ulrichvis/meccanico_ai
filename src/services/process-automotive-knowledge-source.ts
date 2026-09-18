import type { ProcessAutomotiveSourceResult } from "@/automotive-extraction/process-automotive-source";
import type { PersistAcceptedAutomotiveSourceResult } from "@/services/persist-accepted-automotive-source";

export interface ProcessAutomotiveKnowledgeSourceDependencies {
  extract: (sourceId: string) => Promise<ProcessAutomotiveSourceResult>;
  persist: (
    sourceId: string,
  ) => Promise<PersistAcceptedAutomotiveSourceResult>;
}

export type ProcessAutomotiveKnowledgeSourceResult =
  | PersistAcceptedAutomotiveSourceResult
  | Extract<ProcessAutomotiveSourceResult, { status: "busy" | "failed" }>;

export async function processAutomotiveKnowledgeSource(
  sourceId: string,
  dependencies: ProcessAutomotiveKnowledgeSourceDependencies,
): Promise<ProcessAutomotiveKnowledgeSourceResult> {
  const extraction = await dependencies.extract(sourceId);

  if (extraction.status === "busy" || extraction.status === "failed") {
    return extraction;
  }

  return dependencies.persist(sourceId);
}
