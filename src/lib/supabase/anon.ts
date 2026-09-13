import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env";

// Public read-only client (anon key, RLS applies). No cookies, so routes that
// use it can stay static / ISR.
export function createAnonClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}
