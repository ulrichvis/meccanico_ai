import "server-only";

import { z } from "zod";

import { getDatabaseClient } from "@/db/client";
import { pageContentSchema } from "@/schemas/pdf-text-extraction.schema";

const usageSchema = z.strictObject({
  cachedTokens: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative(),
});

const qualitySchema = z.strictObject({
  accepted: z.boolean(),
  characterCount: z.number().int().nonnegative(),
  nonEmptyPages: z.number().int().nonnegative(),
  reasons: z.array(z.string()),
  version: z.string(),
  warnings: z.array(
    z.strictObject({
      code: z.string(),
      pageNumber: z.number().int().positive().nullable(),
    }),
  ),
});

const documentMetadataSchema = z.looseObject({
  author: z.string().nullable().optional(),
  extractionMethod: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  quality: qualitySchema.optional(),
  reviewStatus: z.string().optional(),
  sourceDate: z.string().nullable().optional(),
  transferMethod: z.string().optional(),
  usage: usageSchema.nullable().optional(),
});

const validatedAttemptSchema = z.looseObject({
  usage: usageSchema.nullable().optional(),
});

export interface SourceDetail {
  author: string | null;
  characterCount: number;
  createdAt: string;
  document: {
    author: string | null;
    createdAt: string;
    id: string;
    language: string | null;
    model: string | null;
    pageCount: number;
    pages: Array<z.infer<typeof pageContentSchema>>;
    promptVersion: string | null;
    quality: z.infer<typeof qualitySchema> | null;
    reviewStatus: string | null;
    sourceDate: string | null;
    title: string | null;
  } | null;
  extractionJobs: Array<{
    durationMs: number | null;
    errorCode: string | null;
    finishedAt: string | null;
    id: string;
    model: string | null;
    promptVersion: string | null;
    startedAt: string | null;
    status: string;
    usage: z.infer<typeof usageSchema> | null;
  }>;
  id: string;
  originalFilename: string | null;
  sourceDate: string | null;
  status: string;
  type: string;
  updatedAt: string;
}

export async function getSourceDetail(
  sourceId: string,
): Promise<SourceDetail | null> {
  const parsedSourceId = z.uuid().safeParse(sourceId);

  if (!parsedSourceId.success) return null;

  const source = await getDatabaseClient().source.findUnique({
    where: { id: parsedSourceId.data },
    select: {
      author: true,
      createdAt: true,
      documents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          createdAt: true,
          id: true,
          language: true,
          metadataJson: true,
          pageCount: true,
          pagesJson: true,
          title: true,
        },
        take: 1,
      },
      extractionJobs: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          error: true,
          finishedAt: true,
          id: true,
          model: true,
          promptVersion: true,
          startedAt: true,
          status: true,
          validatedOutput: true,
        },
      },
      id: true,
      originalFilename: true,
      rawText: true,
      sourceDate: true,
      status: true,
      type: true,
      updatedAt: true,
    },
  });

  if (!source) return null;

  const storedDocument = source.documents[0];
  const pages = z.array(pageContentSchema).safeParse(storedDocument?.pagesJson);
  const metadata = documentMetadataSchema.safeParse(storedDocument?.metadataJson);
  const document = storedDocument && pages.success
    ? {
        author: metadata.success ? (metadata.data.author ?? null) : null,
        createdAt: storedDocument.createdAt.toISOString(),
        id: storedDocument.id,
        language: storedDocument.language,
        model: metadata.success ? (metadata.data.model ?? null) : null,
        pageCount: storedDocument.pageCount ?? pages.data.length,
        pages: pages.data,
        promptVersion: metadata.success
          ? (metadata.data.promptVersion ?? null)
          : null,
        quality: metadata.success ? (metadata.data.quality ?? null) : null,
        reviewStatus: metadata.success
          ? (metadata.data.reviewStatus ?? null)
          : null,
        sourceDate: metadata.success
          ? (metadata.data.sourceDate ?? null)
          : null,
        title: storedDocument.title,
      }
    : null;

  return {
    author: source.author,
    characterCount:
      document?.quality?.characterCount ?? source.rawText?.length ?? 0,
    createdAt: source.createdAt.toISOString(),
    document,
    extractionJobs: source.extractionJobs.map((job) => {
      const validated = validatedAttemptSchema.safeParse(job.validatedOutput);

      return {
        durationMs:
          job.startedAt && job.finishedAt
            ? Math.max(0, job.finishedAt.getTime() - job.startedAt.getTime())
            : null,
        errorCode: job.error,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        id: job.id,
        model: job.model,
        promptVersion: job.promptVersion,
        startedAt: job.startedAt?.toISOString() ?? null,
        status: job.status,
        usage: validated.success ? (validated.data.usage ?? null) : null,
      };
    }),
    id: source.id,
    originalFilename: source.originalFilename,
    sourceDate: source.sourceDate?.toISOString() ?? null,
    status: source.status,
    type: source.type,
    updatedAt: source.updatedAt.toISOString(),
  };
}
