import { randomUUID } from "node:crypto";

import { z } from "zod";

const sourceIdSchema = z.uuid();

export function createSourceStoragePath(sourceId: string): string {
  const validSourceId = sourceIdSchema.parse(sourceId);

  return `sources/${validSourceId}/${randomUUID()}.pdf`;
}
