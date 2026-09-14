import { z } from "zod";
import { pdfTextExtractionSchema, type PdfTextExtraction } from "@/schemas/pdf-text-extraction.schema";

export interface TextQualityResult {
  version: "text-quality-v1";
  accepted: boolean;
  characterCount: number;
  nonEmptyPages: number;
  reasons: string[];
  warnings: { code: string; pageNumber: number | null }[];
}

export class TextQualityError extends Error {
  constructor(public readonly quality: TextQualityResult) {
    super("TEXT_QUALITY_FAILED");
    this.name = "TextQualityError";
  }
}

export function evaluateTextQuality(input: PdfTextExtraction): TextQualityResult {
  const document = pdfTextExtractionSchema.parse(input);
  const quality: TextQualityResult = {
    version: "text-quality-v1", accepted: true, characterCount: 0,
    nonEmptyPages: 0, reasons: [], warnings: [],
  };
  const seen = new Set<string>();
  const allStrings = [document.title, document.author, document.sourceDate, document.language];

  for (const page of document.pages) {
    const text = page.text.trim();
    quality.characterCount += page.text.length;
    if (text) quality.nonEmptyPages++;
    allStrings.push(page.text, page.uncertainty);
    if (page.textQuality !== "readable" || !text) {
      const code = page.textQuality === "unreadable" ? "PAGE_UNREADABLE" : text ? "PAGE_PARTIAL" : "PAGE_EMPTY";
      quality.warnings.push({ code, pageNumber: page.pageNumber });
    }
    const normalized = text.replace(/\s+/gu, " ");
    if (normalized.length >= 200 && seen.has(normalized)) {
      quality.warnings.push({ code: "DUPLICATE_PAGE_TEXT", pageNumber: page.pageNumber });
    }
    seen.add(normalized);
    const replacements = [...text].filter((character) => character === "\uFFFD").length;
    if (replacements >= 3 && replacements / Math.max(1, [...text].length) >= 0.01) {
      quality.reasons.push("UNICODE_CORRUPTION");
    } else if (replacements) {
      quality.warnings.push({ code: "UNICODE_REPLACEMENT", pageNumber: page.pageNumber });
    }
  }
  if (!quality.nonEmptyPages) quality.reasons.push("NO_USABLE_TEXT");
  // PostgreSQL text/JSONB cannot safely represent NUL or unpaired surrogates.
  if (allStrings.some((value) => value !== null && (value.includes("\u0000") || !value.isWellFormed()))) {
    quality.reasons.push("INVALID_TEXT_ENCODING");
  }
  quality.reasons = [...new Set(quality.reasons)];
  quality.accepted = quality.reasons.length === 0;
  return quality;
}

export function parseSourceDate(value: string | null): Date | null {
  // Preserve ambiguous/partial dates verbatim in metadata, never guess a day.
  if (!value || !z.iso.date().safeParse(value).success) return null;
  return new Date(`${value}T00:00:00.000Z`);
}
