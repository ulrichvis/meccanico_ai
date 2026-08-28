import { loadEnvConfig } from "@next/env";
import { z } from "zod";

import { createSupabaseServiceClient } from "../src/supabase/client-factory";

loadEnvConfig(process.cwd());

const storageEnvironmentSchema = z.object({
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_DOCUMENTS_BUCKET: z.string().min(1).default("technical-sources"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getStorageConfig() {
  const environment = storageEnvironmentSchema.parse(process.env);

  return {
    bucket: environment.SUPABASE_DOCUMENTS_BUCKET,
    client: createSupabaseServiceClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.SUPABASE_SERVICE_ROLE_KEY,
    ),
    maximumSizeBytes: environment.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  };
}
