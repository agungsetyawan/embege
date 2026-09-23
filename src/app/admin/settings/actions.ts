"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/validate";
import { requireAdmin } from "../actions";

const UPDATABLE_SETTINGS = new Set([
  "enrich_batch",
  "crawl_schedule",
  "enrich_schedule",
]);

export async function updateSetting(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const key = String(formData.get("key"));
  const value = String(formData.get("value") ?? "").trim();
  if (!UPDATABLE_SETTINGS.has(key) || !value || value.length > 500) return;
  await supabase
    .from("app_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  await log({
    action: "settings.update",
    table: "app_settings",
    diff: { key, value },
  });
  revalidatePath("/admin/settings");
}

export async function addSetting(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const key = String(formData.get("key") ?? "")
    .trim()
    .toLowerCase();
  const value = String(formData.get("value") ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(key) || !value || value.length > 500) return;
  await supabase.from("app_settings").insert({ key, value });
  await log({
    action: "settings.add",
    table: "app_settings",
    diff: { key, value },
  });
  revalidatePath("/admin/settings");
}

export async function addKeyword(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const keyword = String(formData.get("keyword") ?? "").trim();
  if (!keyword || keyword.length > 200) return;
  await supabase.from("crawl_keywords").insert({ keyword });
  await log({
    action: "settings.add_keyword",
    table: "crawl_keywords",
    diff: { keyword },
  });
  revalidatePath("/admin/settings");
}

export async function toggleKeyword(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const id = String(formData.get("id"));
  if (!isUuid(id)) return;
  const { data } = await supabase
    .from("crawl_keywords")
    .select("active")
    .eq("id", id)
    .single();
  if (!data) return;
  await supabase
    .from("crawl_keywords")
    .update({ active: !data.active })
    .eq("id", id);
  await log({
    action: "settings.toggle_keyword",
    table: "crawl_keywords",
    rowId: id,
    diff: { active: !data.active },
  });
  revalidatePath("/admin/settings");
}

export async function deleteKeyword(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const id = String(formData.get("id"));
  if (!isUuid(id)) return;
  await supabase.from("crawl_keywords").delete().eq("id", id);
  await log({
    action: "settings.delete_keyword",
    table: "crawl_keywords",
    rowId: id,
  });
  revalidatePath("/admin/settings");
}

export async function applySchedules(): Promise<{
  ok: boolean;
  message: string;
}> {
  const { supabase, log } = await requireAdmin();
  const { data, error } = await supabase.rpc("apply_cron_schedules");
  if (error) return { ok: false, message: `Gagal: ${error.message}` };
  await log({
    action: "settings.apply_schedules",
    table: "app_settings",
  });
  const d = data as { crawl_schedule: string; enrich_schedule: string } | null;
  return {
    ok: true,
    message: `Jadwal aktif: crawl ${d?.crawl_schedule}, enrich ${d?.enrich_schedule}`,
  };
}
