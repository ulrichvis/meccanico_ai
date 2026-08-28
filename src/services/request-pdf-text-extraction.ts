import "server-only";

import { z } from "zod";

import { getPdfTextExtractor } from "@/ai/pdf-text-extractor.server";
import { SourceStatus, SourceType } from "@/generated/prisma/enums";
import { env } from "@/lib/env";
import { findSourceForTextExtraction } from "@/sources/source-repository";
import { getSourceStorage } from "@/storage/source-storage.server";

const sourceIdSchema = z.uuid();
const SIGNED_PDF_URL_LIFETIME_SECONDS = 600;

export class PdfTextExtractionPreparationError extends Error {
  constructor(
    public readonly code:
      | "SOURCE_NOT_FOUND"
      | "SOURCE_NOT_ELIGIBLE"
      | "SOURCE_FILE_MISSING"
      | "SOURCE_FILE_TYPE_INVALID"
      | "SOURCE_FILE_EMPTY"
      | "SOURCE_FILE_TOO_LARGE",
  ) {
    super(code);
    this.name = "PdfTextExtractionPreparationError";
  }
}

export async function requestPdfTextExtraction(sourceId: string) {
  const validSourceId = sourceIdSchema.parse(sourceId);
  const source = await findSourceForTextExtraction(validSourceId);

  if (!source) {
    throw new PdfTextExtractionPreparationError("SOURCE_NOT_FOUND");
  }
  if (source.status !== SourceStatus.UPLOADED || source.type !== SourceType.PDF) {
    throw new PdfTextExtractionPreparationError("SOURCE_NOT_ELIGIBLE");
  }
  if (source.mimeType !== "application/pdf") {
    throw new PdfTextExtractionPreparationError("SOURCE_FILE_TYPE_INVALID");
  }
  if (!source.storagePath) {
    throw new PdfTextExtractionPreparationError("SOURCE_FILE_MISSING");
  }

  const storage = getSourceStorage();
  const fileInfo = await storage.getFileInfo(source.storagePath);

  if (fileInfo.contentType !== "application/pdf") {
    throw new PdfTextExtractionPreparationError("SOURCE_FILE_TYPE_INVALID");
  }
  if (fileInfo.sizeBytes <= 0) {
    throw new PdfTextExtractionPreparationError("SOURCE_FILE_EMPTY");
  }
  if (fileInfo.sizeBytes > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    throw new PdfTextExtractionPreparationError("SOURCE_FILE_TOO_LARGE");
  }

  const fileUrl = await storage.createSignedUrl(
    source.storagePath,
    SIGNED_PDF_URL_LIFETIME_SECONDS,
  );
  const extraction = await getPdfTextExtractor().extract(fileUrl);

  return {
    extraction,
    source: {
      id: source.id,
      originalFilename: source.originalFilename,
    },
  };
}
