import { z } from "zod";

const firstQueryValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

export const caseBrowserQuerySchema = z.object({
  q: z.preprocess(
    firstQueryValue,
    z.string().trim().max(100).catch("").default(""),
  ),
  review: z.preprocess(
    firstQueryValue,
    z
      .enum(["all", "unreviewed", "reviewed", "corrected"])
      .catch("all")
      .default("all"),
  ),
  status: z.preprocess(
    firstQueryValue,
    z.enum(["active", "rejected", "archived"]).catch("active").default("active"),
  ),
});

export type CaseBrowserQuery = z.infer<typeof caseBrowserQuerySchema>;

export function parseCaseBrowserQuery(
  input: Record<string, string | string[] | undefined>,
): CaseBrowserQuery {
  return caseBrowserQuerySchema.parse(input);
}
