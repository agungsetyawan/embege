import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addKeyword,
  addSetting,
  addSource,
  deleteKeyword,
  deleteSource,
  toggleKeyword,
  toggleSource,
  updateSetting,
} from "./actions";
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

  const [{ data: settings }, { data: sources }, { data: keywords }] =
    await Promise.all([
      supabase.from("app_settings").select("key,value,updated_at").order("key"),
      supabase
        .from("crawl_sources")
        .select("id,name,rss_url,active")
        .order("name"),
      supabase
        .from("crawl_keywords")
        .select("id,keyword,active")
        .order("keyword"),
    ]);

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

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sumber berita</h2>
        <p className="text-xs text-zinc-500">
          Berlaku di crawl berikutnya. Sumber mati otomatis dilewati crawler.
        </p>
        {sources?.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded border p-3 text-sm"
          >
            <span className="font-medium">{s.name}</span>
            <span className="flex-1 truncate font-mono text-xs text-zinc-500">
              {s.rss_url ?? "(belum ada URL)"}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${s.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}
            >
              {s.active ? "Aktif" : "Mati"}
            </span>
            <form action={toggleSource}>
              <input type="hidden" name="id" value={s.id} />
              <button
                type="submit"
                className="rounded border px-2 py-1 text-xs"
              >
                {s.active ? "Matikan" : "Aktifkan"}
              </button>
            </form>
            <form action={deleteSource}>
              <input type="hidden" name="id" value={s.id} />
              <button
                type="submit"
                className="rounded border px-2 py-1 text-xs"
              >
                Hapus
              </button>
            </form>
          </div>
        ))}
        <form action={addSource} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Nama media"
            className="w-40 rounded border px-2 py-1.5 text-sm"
          />
          <input
            name="rss_url"
            required
            placeholder="https://…/rss"
            className="flex-1 rounded border px-2 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Tambah
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Keyword</h2>
        <p className="text-xs text-zinc-500">
          ≤5 huruf match utuh (MBG tidak match “lambung”), selebihnya substring.
        </p>
        {keywords?.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-2 rounded border p-3 text-sm"
          >
            <code className="flex-1 font-semibold">{k.keyword}</code>
            <span
              className={`rounded px-2 py-0.5 text-xs ${k.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}
            >
              {k.active ? "Aktif" : "Mati"}
            </span>
            <form action={toggleKeyword}>
              <input type="hidden" name="id" value={k.id} />
              <button
                type="submit"
                className="rounded border px-2 py-1 text-xs"
              >
                {k.active ? "Matikan" : "Aktifkan"}
              </button>
            </form>
            <form action={deleteKeyword}>
              <input type="hidden" name="id" value={k.id} />
              <button
                type="submit"
                className="rounded border px-2 py-1 text-xs"
              >
                Hapus
              </button>
            </form>
          </div>
        ))}
        <form action={addKeyword} className="flex gap-2">
          <input
            name="keyword"
            required
            placeholder="keyword baru"
            className="flex-1 rounded border px-2 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Tambah
          </button>
        </form>
      </section>
    </main>
  );
}
