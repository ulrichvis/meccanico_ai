import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient(
  url: string,
  secretKey: string,
): SupabaseClient {
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
