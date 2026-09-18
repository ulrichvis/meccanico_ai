import { z } from "zod";

export const caseLifecycleActionSchema = z.strictObject({
  action: z.enum(["review", "reject", "archive"]),
  caseId: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type CaseLifecycleAction = z.infer<typeof caseLifecycleActionSchema>;
