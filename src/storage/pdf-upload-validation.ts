import { z } from "zod";

import { env } from "@/lib/env";

const PDF_MIME_TYPE = "application/pdf";
const PDF_SIGNATURE = "%PDF-";

export const pdfUploadMetadataSchema = z.object({
  name: z.string().trim().min(1).regex(/\.pdf$/i, "PDF_EXTENSION_REQUIRED"),
  size: z
    .number()
    .int()
    .positive("PDF_EMPTY")
    .max(env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, "PDF_TOO_LARGE"),
  type: z.literal(PDF_MIME_TYPE, "PDF_MIME_TYPE_REQUIRED"),
});

export type ValidatedPdfUpload = z.infer<typeof pdfUploadMetadataSchema>;

export async function validatePdfUpload(file: File): Promise<ValidatedPdfUpload> {
  const metadata = pdfUploadMetadataSchema.parse({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  const signature = new TextDecoder("ascii").decode(
    await file.slice(0, PDF_SIGNATURE.length).arrayBuffer(),
  );

  if (signature !== PDF_SIGNATURE) {
    throw new Error("PDF_SIGNATURE_REQUIRED");
  }

  return metadata;
}
