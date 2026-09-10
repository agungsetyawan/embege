"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../actions";

export async function updateSetting(formData: FormData) {
  const supabase = await requireAdmin();
  const key = String(formData.get("key"));
  const value = String(formData.get("value") ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(key) || !value || value.length > 500) return;
  await supabase
    .from("app_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  revalidatePath("/admin/settings");
}

export async function addSetting(formData: FormData) {
  const supabase = await requireAdmin();
  const key = String(formData.get("key") ?? "")
    .trim()
    .toLowerCase();
  const value = String(formData.get("value") ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(key) || !value || value.length > 500) return;
  await supabase.from("app_settings").insert({ key, value });
  revalidatePath("/admin/settings");
}

export async function applySchedules(): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("apply_cron_schedules");
  if (error) return { ok: false, message: `Gagal: ${error.message}` };
  const d = data as { crawl_schedule: string; enrich_schedule: string } | null;
  return {
    ok: true,
    message: `Jadwal aktif — crawl: ${d?.crawl_schedule}, enrich: ${d?.enrich_schedule}`,
  };
}
