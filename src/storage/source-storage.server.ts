import "server-only";

import { env } from "@/lib/env";
import { SupabaseSourceStorage } from "@/storage/supabase-source-storage";
import { getSupabaseServerClient } from "@/supabase/server-client";

let sourceStorage: SupabaseSourceStorage | undefined;

export function getSourceStorage(): SupabaseSourceStorage {
  sourceStorage ??= new SupabaseSourceStorage(
    getSupabaseServerClient(),
    env.SUPABASE_DOCUMENTS_BUCKET,
  );

  return sourceStorage;
}
