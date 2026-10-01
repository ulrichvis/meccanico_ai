import { z } from "zod";

export type UploadProcessingStage = "extracting" | "analyzing";
export type UploadProcessingResult =
  | { success: true; caseCount: number }
  | { success: false; stage: UploadProcessingStage };

const extractionResponseSchema = z.object({
  status: z.enum(["completed", "already_processed"]),
  documentId: z.uuid(),
});
const analysisResponseSchema = z.object({
  status: z.enum(["persisted", "already_persisted"]),
  caseCount: z.number().int().nonnegative(),
});

// Transport sequencing only: server services own AI, retries, and persistence.
export async function processUploadedSource(
  sourceId: string,
  onStage: (stage: UploadProcessingStage) => void,
  request: typeof fetch = fetch,
): Promise<UploadProcessingResult> {
  let stage: UploadProcessingStage = "extracting";
  try {
    const id = z.uuid().parse(sourceId);
    onStage(stage);
    const extraction = await request(`/api/sources/${id}/extraction`, { method: "POST" });
    if (!extraction.ok) return { success: false, stage };
    extractionResponseSchema.parse(await extraction.json());

    stage = "analyzing";
    onStage(stage);
    const analysis = await request(`/api/sources/${id}/automotive-analysis`, { method: "POST" });
    if (!analysis.ok) return { success: false, stage };
    const result = analysisResponseSchema.parse(await analysis.json());
    return { success: true, caseCount: result.caseCount };
  } catch {
    return { success: false, stage };
  }
}
