import { z } from "zod";

import { uploadPdfSource } from "@/services/upload-pdf-source";
import { StorageOperationError } from "@/storage/storage-errors";

export const runtime = "nodejs";

const uploadRequestSchema = z.object({
  file: z.instanceof(File),
  uploadId: z.uuid(),
});

type UploadErrorCode =
  | "file_required"
  | "invalid_extension"
  | "invalid_mime_type"
  | "invalid_pdf"
  | "file_too_large"
  | "storage_failed"
  | "upload_failed";

function getValidationErrorCode(error: z.ZodError): UploadErrorCode {
  const message = error.issues[0]?.message;

  if (message === "PDF_EXTENSION_REQUIRED") return "invalid_extension";
  if (message === "PDF_MIME_TYPE_REQUIRED") return "invalid_mime_type";
  if (message === "PDF_TOO_LARGE") return "file_too_large";
  return "file_required";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const input = uploadRequestSchema.parse({
      file: formData.get("file"),
      uploadId: formData.get("uploadId"),
    });
    const result = await uploadPdfSource(input.uploadId, input.file);

    return Response.json({
      duplicate: result.duplicate,
      sourceId: result.source.id,
      status: "uploaded",
    });
  } catch (error) {
    let code: UploadErrorCode = "upload_failed";
    let status = 500;

    if (error instanceof z.ZodError) {
      code = getValidationErrorCode(error);
      status = 400;
    } else if (error instanceof Error && error.message === "PDF_SIGNATURE_REQUIRED") {
      code = "invalid_pdf";
      status = 400;
    } else if (error instanceof StorageOperationError) {
      code = "storage_failed";
      status = 502;
    }

    return Response.json({ error: { code } }, { status });
  }
}
