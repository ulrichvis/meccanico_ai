import "server-only";

import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/supabase/client-factory";

let serverClient: ReturnType<typeof createSupabaseServiceClient> | undefined;

export function getSupabaseServerClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  }

  serverClient ??= createSupabaseServiceClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return serverClient;
}
