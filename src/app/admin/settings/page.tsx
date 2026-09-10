import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Kurasi
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Pengaturan
          </h1>
          <p className="text-sm text-muted-foreground">
            Berlaku tanpa deploy. Jadwal cron perlu tombol Terapkan di bawah.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Umum</h2>
        {settings?.map((s) => (
          <Card key={s.key}>
            <CardContent className="flex flex-col gap-1.5 pt-6">
              <code className="text-sm font-semibold">{s.key}</code>
              {HINTS[s.key] && (
                <p className="text-xs text-muted-foreground">{HINTS[s.key]}</p>
              )}
              <form action={updateSetting} className="flex gap-2">
                <input type="hidden" name="key" value={s.key} />
                <Input
                  name="value"
                  required
                  defaultValue={s.value}
                  className="font-mono"
                />
                <Button type="submit" variant="outline">
                  Simpan
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-6">
            <span className="text-sm font-semibold">Tambah pengaturan</span>
            <form action={addSetting} className="flex gap-2">
              <Input
                name="key"
                required
                placeholder="nama_kunci"
                className="font-mono"
              />
              <Input
                name="value"
                required
                placeholder="nilai"
                className="font-mono"
              />
              <Button type="submit" variant="outline">
                Tambah
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ApplyButton />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sumber berita</h2>
          <p className="text-xs text-muted-foreground">
            Berlaku di crawl berikutnya. Sumber mati otomatis dilewati crawler.
          </p>
        </div>
        {sources?.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center gap-2 pt-6 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                {s.rss_url ?? "(belum ada URL)"}
              </span>
              <Badge variant={s.active ? "secondary" : "outline"}>
                {s.active ? "Aktif" : "Mati"}
              </Badge>
              <form action={toggleSource}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outline" size="sm">
                  {s.active ? "Matikan" : "Aktifkan"}
                </Button>
              </form>
              <form action={deleteSource}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outline" size="sm">
                  Hapus
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
        <form action={addSource} className="flex gap-2">
          <Input
            name="name"
            required
            placeholder="Nama media"
            className="w-40"
          />
          <Input
            name="rss_url"
            required
            placeholder="https://…/rss"
            className="flex-1 font-mono"
          />
          <Button type="submit" variant="outline">
            Tambah
          </Button>
        </form>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Keyword</h2>
          <p className="text-xs text-muted-foreground">
            ≤5 huruf match utuh (MBG tidak match “lambung”), selebihnya
            substring.
          </p>
        </div>
        {keywords?.map((k) => (
          <Card key={k.id}>
            <CardContent className="flex items-center gap-2 pt-6 text-sm">
              <code className="flex-1 font-semibold">{k.keyword}</code>
              <Badge variant={k.active ? "secondary" : "outline"}>
                {k.active ? "Aktif" : "Mati"}
              </Badge>
              <form action={toggleKeyword}>
                <input type="hidden" name="id" value={k.id} />
                <Button type="submit" variant="outline" size="sm">
                  {k.active ? "Matikan" : "Aktifkan"}
                </Button>
              </form>
              <form action={deleteKeyword}>
                <input type="hidden" name="id" value={k.id} />
                <Button type="submit" variant="outline" size="sm">
                  Hapus
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
        <form action={addKeyword} className="flex gap-2">
          <Input
            name="keyword"
            required
            placeholder="keyword baru"
            className="flex-1 font-mono"
          />
          <Button type="submit" variant="outline">
            Tambah
          </Button>
        </form>
      </section>
    </main>
  );
}
