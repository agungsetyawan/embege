import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Akses literal: Next hanya meng-inline process.env.NEXT_PUBLIC_* yang literal ke bundle browser.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Env Supabase belum diisi");
  return createBrowserClient(url, key);
}
