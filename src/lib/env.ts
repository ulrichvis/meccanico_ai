import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.url().optional(),
);

const optionalPostgresUrl = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .regex(
      /^postgres(?:ql)?:\/\//,
      "Database URLs must start with postgres:// or postgresql://.",
    )
    .optional(),
);

const serverEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: optionalUrl.default("http://localhost:3000"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),
  DATABASE_URL: optionalPostgresUrl,
  DIRECT_URL: optionalPostgresUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_DOCUMENTS_BUCKET: optionalString.default("technical-sources"),
  OPENAI_API_KEY: optionalString,
  OPENAI_EXTRACTION_MODEL: optionalString,
});

export const env = serverEnvironmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_DOCUMENTS_BUCKET: process.env.SUPABASE_DOCUMENTS_BUCKET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_EXTRACTION_MODEL: process.env.OPENAI_EXTRACTION_MODEL,
});
