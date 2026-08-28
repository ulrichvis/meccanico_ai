import { z } from "zod";

export const PDF_TEXT_EXTRACTION_SCHEMA_NAME = "pdf_text_extraction";

export const pageTextQualitySchema = z.enum([
  "readable",
  "partial",
  "unreadable",
]);

export const pageContentSchema = z.strictObject({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  textQuality: pageTextQualitySchema,
  uncertainty: z.string().min(1).nullable(),
});

export const pdfTextExtractionSchema = z
  .strictObject({
    title: z.string().min(1).nullable(),
    author: z.string().min(1).nullable(),
    sourceDate: z.string().min(1).nullable(),
    language: z.string().min(2).max(35).nullable(),
    pageCount: z.number().int().positive(),
    pages: z.array(pageContentSchema).min(1),
  })
  .superRefine((document, context) => {
    if (document.pages.length !== document.pageCount) {
      context.addIssue({
        code: "custom",
        message: "PAGE_COUNT_MISMATCH",
        path: ["pages"],
      });
    }

    document.pages.forEach((page, index) => {
      const expectedPageNumber = index + 1;

      if (page.pageNumber !== expectedPageNumber) {
        context.addIssue({
          code: "custom",
          message: "PAGE_ORDER_INVALID",
          path: ["pages", index, "pageNumber"],
        });
      }

      if (page.textQuality !== "readable" && !page.uncertainty) {
        context.addIssue({
          code: "custom",
          message: "PAGE_UNCERTAINTY_REQUIRED",
          path: ["pages", index, "uncertainty"],
        });
      }
    });
  });

export type PdfTextExtraction = z.infer<typeof pdfTextExtractionSchema>;

const generatedJsonSchema = z.toJSONSchema(pdfTextExtractionSchema, {
  target: "draft-7",
});

export const pdfTextExtractionJsonSchema = Object.fromEntries(
  Object.entries(generatedJsonSchema).filter(([key]) => key !== "$schema"),
) as Record<string, unknown>;

export function buildRawText(document: PdfTextExtraction): string {
  return document.pages.map((page) => page.text).join("\n\n");
}
