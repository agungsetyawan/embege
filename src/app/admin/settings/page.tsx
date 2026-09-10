import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addSetting, updateSetting } from "./actions";
import { ApplyButton } from "./apply-button";

const HINTS: Record<string, string> = {
  enrich_batch: "Jumlah berita per run enrich (1–20).",
  crawl_schedule: "Jadwal crawl, format cron 5 kolom (mnt jam tgl bln hari).",
  enrich_schedule: "Jadwal enrich, format cron 5 kolom.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key,value,updated_at")
    .order("key");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header>
        <Link href="/admin" className="text-sm underline">
          ← Kurasi
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-zinc-500">
          Berlaku tanpa deploy. Jadwal cron perlu tombol Terapkan di bawah.
        </p>
      </header>

      {settings?.map((s) => (
        <form
          key={s.key}
          action={updateSetting}
          className="flex flex-col gap-1 rounded border p-3"
        >
          <input type="hidden" name="key" value={s.key} />
          <code className="text-sm font-semibold">{s.key}</code>
          {HINTS[s.key] && (
            <p className="text-xs text-zinc-500">{HINTS[s.key]}</p>
          )}
          <div className="flex gap-2">
            <input
              name="value"
              required
              defaultValue={s.value}
              className="flex-1 rounded border px-2 py-1.5 font-mono text-sm"
            />
            <button
              type="submit"
              className="rounded border px-3 py-1.5 text-sm"
            >
              Simpan
            </button>
          </div>
        </form>
      ))}

      <form
        action={addSetting}
        className="flex flex-col gap-1 rounded border p-3"
      >
        <span className="text-sm font-semibold">Tambah pengaturan</span>
        <div className="flex gap-2">
          <input
            name="key"
            required
            placeholder="nama_kunci"
            className="flex-1 rounded border px-2 py-1.5 font-mono text-sm"
          />
          <input
            name="value"
            required
            placeholder="nilai"
            className="flex-1 rounded border px-2 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Tambah
          </button>
        </div>
      </form>

      <div className="rounded border p-3">
        <ApplyButton />
      </div>
    </main>
  );
}
