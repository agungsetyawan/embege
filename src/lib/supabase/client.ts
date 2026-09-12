import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Literal access: Next only inlines literal process.env.NEXT_PUBLIC_* into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Env Supabase belum diisi");
  return createBrowserClient(url, key);
}
