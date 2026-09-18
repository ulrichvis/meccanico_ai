import { z } from "zod";

import { normalizeAutomotiveExtraction } from "@/normalization/automotive-normalizer";
import {
  AutomotiveGraphRepository,
  type CompleteAutomotiveGraphResult,
} from "@/persistence/automotive-graph-repository";

export interface PersistAcceptedAutomotiveSourceDependencies {
  repository: AutomotiveGraphRepository;
}

export interface PersistAcceptedAutomotiveSourceResult
  extends CompleteAutomotiveGraphResult {
  extractionJobId: string;
  sourceId: string;
}

export async function persistAcceptedAutomotiveSource(
  rawSourceId: string,
  dependencies: PersistAcceptedAutomotiveSourceDependencies,
): Promise<PersistAcceptedAutomotiveSourceResult> {
  const sourceId = z.uuid().parse(rawSourceId);
  const accepted = await dependencies.repository.loadAcceptedExtraction(sourceId);
  const extraction = normalizeAutomotiveExtraction(accepted.extraction);
  const result = await dependencies.repository.persistAndCompleteSource({
    ...accepted,
    extraction,
  });

  return {
    ...result,
    extractionJobId: accepted.extractionJobId,
    sourceId,
  };
}
