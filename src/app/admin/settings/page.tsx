import { redirect } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "../admin-header";
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
  enrich_batch: "Jumlah berita per run enrich (1-20).",
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
      <AdminHeader active="settings" title="Pengaturan" email={user.email} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Umum</h2>
        <Frame stacked>
          {settings?.map((s) => (
            <FramePanel key={s.key}>
              <div className="flex flex-col gap-1.5">
                <code className="text-sm font-semibold">{s.key}</code>
                {HINTS[s.key] && (
                  <p className="text-xs text-muted-foreground">
                    {HINTS[s.key]}
                  </p>
                )}
                <form action={updateSetting} className="flex gap-2">
                  <input type="hidden" name="key" value={s.key} />
                  <Input
                    name="value"
                    required
                    defaultValue={s.value}
                    className="font-mono"
                  />
                  <SubmitButton type="submit" variant="outline">
                    Simpan
                  </SubmitButton>
                </form>
              </div>
            </FramePanel>
          ))}
          <FramePanel>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Pengaturan baru</span>
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
                <SubmitButton type="submit" variant="outline">
                  Tambah
                </SubmitButton>
              </form>
            </div>
          </FramePanel>
          <FramePanel>
            <ApplyButton />
          </FramePanel>
        </Frame>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sumber berita</h2>
          <p className="text-xs text-muted-foreground">
            Berlaku di crawl berikutnya. Sumber mati otomatis dilewati crawler.
          </p>
        </div>
        <Frame stacked>
          {sources?.map((s) => (
            <FramePanel key={s.id}>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={s.active ? "secondary" : "outline"}>
                    {s.active ? "Aktif" : "Mati"}
                  </Badge>
                </div>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {s.rss_url ?? "(URL belum diisi)"}
                </span>
                <div className="flex gap-2">
                  <form action={toggleSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton type="submit" variant="outline" size="sm">
                      {s.active ? "Matikan" : "Aktifkan"}
                    </SubmitButton>
                  </form>
                  <form action={deleteSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton type="submit" variant="outline" size="sm">
                      Hapus
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </FramePanel>
          ))}
        </Frame>
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
            placeholder="https://contoh.id/rss"
            className="flex-1 font-mono"
          />
          <SubmitButton type="submit" variant="outline">
            Tambah
          </SubmitButton>
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
        <Frame stacked>
          {keywords?.map((k) => (
            <FramePanel key={k.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <code className="flex-1 font-semibold">{k.keyword}</code>
                <Badge variant={k.active ? "secondary" : "outline"}>
                  {k.active ? "Aktif" : "Mati"}
                </Badge>
                <form action={toggleKeyword}>
                  <input type="hidden" name="id" value={k.id} />
                  <SubmitButton type="submit" variant="outline" size="sm">
                    {k.active ? "Matikan" : "Aktifkan"}
                  </SubmitButton>
                </form>
                <form action={deleteKeyword}>
                  <input type="hidden" name="id" value={k.id} />
                  <SubmitButton type="submit" variant="outline" size="sm">
                    Hapus
                  </SubmitButton>
                </form>
              </div>
            </FramePanel>
          ))}
        </Frame>
        <form action={addKeyword} className="flex gap-2">
          <Input
            name="keyword"
            required
            placeholder="keyword baru"
            className="flex-1 font-mono"
          />
          <SubmitButton type="submit" variant="outline">
            Tambah
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
