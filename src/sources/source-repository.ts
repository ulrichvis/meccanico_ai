import "server-only";

import { getDatabaseClient } from "@/db/client";
import { SourceStatus, SourceType } from "@/generated/prisma/enums";
import type { StoredSourceFile } from "@/storage/store-source-file";

export interface UploadedSource {
  id: string;
  originalFilename: string | null;
  status: "UPLOADED";
}

export interface RecentSource {
  createdAt: string;
  id: string;
  mimeType: string | null;
  originalFilename: string | null;
  status: string;
  type: string;
}

export interface SourceForTextExtraction {
  id: string;
  mimeType: string | null;
  originalFilename: string | null;
  status: string;
  storagePath: string | null;
  type: string;
}

const RECENT_SOURCE_LIMIT = 50;

export async function listRecentSources(): Promise<RecentSource[]> {
  const sources = await getDatabaseClient().source.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      createdAt: true,
      id: true,
      mimeType: true,
      originalFilename: true,
      status: true,
      type: true,
    },
    take: RECENT_SOURCE_LIMIT,
  });

  return sources.map((source) => ({
    ...source,
    createdAt: source.createdAt.toISOString(),
  }));
}

export async function findUploadedSource(
  sourceId: string,
): Promise<UploadedSource | null> {
  return getDatabaseClient().source.findUnique({
    where: { id: sourceId },
    select: { id: true, originalFilename: true, status: true },
  }) as Promise<UploadedSource | null>;
}

export async function findSourceForTextExtraction(
  sourceId: string,
): Promise<SourceForTextExtraction | null> {
  return getDatabaseClient().source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      mimeType: true,
      originalFilename: true,
      status: true,
      storagePath: true,
      type: true,
    },
  });
}

export async function createUploadedSource(
  sourceId: string,
  file: StoredSourceFile,
): Promise<UploadedSource> {
  return getDatabaseClient().source.create({
    data: {
      id: sourceId,
      mimeType: file.mimeType,
      originalFilename: file.originalFilename,
      status: SourceStatus.UPLOADED,
      storagePath: file.storagePath,
      type: SourceType.PDF,
    },
    select: { id: true, originalFilename: true, status: true },
  }) as Promise<UploadedSource>;
}
