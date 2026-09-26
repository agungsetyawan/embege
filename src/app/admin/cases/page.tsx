import { Inbox, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Frame, FramePanel } from "@/components/reui/frame";
import { IconStack } from "@/components/reui/icon-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NavLinkStatus } from "@/components/ui/nav-link-status";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";
import { type CaseRow, CasesTable } from "./cases-table";

const PAGE_SIZES = [10, 20, 50];
const SORT_KEYS = new Set(["occurred_on", "created_at", "victims"]);

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50 dark:bg-input/30";

type Params = {
  page?: string;
  per?: string;
  search?: string;
  regionId?: string;
  status?: string;
  published?: string;
  sort?: string;
  order?: string;
};

export default async function CasesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const p = await searchParams;
  const per = PAGE_SIZES.includes(Number(p.per)) ? Number(p.per) : 20;
  const rawPage = Number(p.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = (p.search ?? "").trim().slice(0, 200);
  const region = isUuid(p.regionId ?? "") ? (p.regionId as string) : "";
  const status =
    p.status === "deleted" ? "deleted" : p.status === "all" ? "all" : "active";
  const published =
    p.published === "true" ? "true" : p.published === "false" ? "false" : "all";
  const sort = SORT_KEYS.has(p.sort ?? "") ? (p.sort as string) : "occurred_on";
  const order = p.order === "asc" ? "asc" : "desc";

  const buildQuery = () => {
    let query = supabase
      .from("cases")
      .select(
        "id,region_id,summary,school,sppg,victims,occurred_on,source_media,source_url,published,created_at,deleted_at,region:regions(province,district,centroid_ok)",
        { count: "exact" },
      );
    if (status === "active") query = query.is("deleted_at", null);
    else if (status === "deleted") query = query.not("deleted_at", "is", null);
    if (published !== "all")
      query = query.eq("published", published === "true");
    if (region) query = query.eq("region_id", region);
    if (q) {
      const safe = q.replace(/[%(),]/g, " ").trim();
      if (safe)
        query = query.or(
          `summary.ilike.%${safe}%,school.ilike.%${safe}%,sppg.ilike.%${safe}%,source_media.ilike.%${safe}%,source_url.ilike.%${safe}%`,
        );
    }
    return query;
  };

  const orderedQuery = buildQuery().order(sort, {
    ascending: order === "asc",
    nullsFirst: false,
  });
  // Stable tiebreaker: newest created_at first.
  if (sort !== "created_at")
    orderedQuery.order("created_at", { ascending: false, nullsFirst: false });

  const [{ data: rows, count: total }, { data: regions }] = await Promise.all([
    orderedQuery.range((wantPage - 1) * per, wantPage * per - 1),
    supabase
      .from("regions")
      .select("id,province,district,centroid_ok")
      .order("province")
      .order("district"),
  ]);

  const totalRows = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / per));
  const page = Math.min(wantPage, totalPages);
  const items = (rows ?? []) as unknown as CaseRow[];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <form
        action="/admin/cases"
        method="get"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="order" value={order} />
        <input type="hidden" name="per" value={String(per)} />
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="q">Cari</Label>
          <Input
            id="q"
            name="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="Ringkasan, media, URL..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="region">Wilayah</Label>
          <select
            id="region"
            name="regionId"
            defaultValue={region}
            className={selectClass}
          >
            <option value="">Semua</option>
            {(regions ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.district ? `${r.district}, ` : ""}
                {r.province}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={selectClass}
          >
            <option value="active">Aktif</option>
            <option value="deleted">Terhapus</option>
            <option value="all">Semua</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="published">Terbit</Label>
          <select
            id="published"
            name="published"
            defaultValue={published}
            className={selectClass}
          >
            <option value="all">Semua</option>
            <option value="true">Terbit</option>
            <option value="false">Draft</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            <Search />
          </Button>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/cases" />}
          >
            Reset
            <NavLinkStatus />
          </Button>
        </div>
      </form>
      {items.length === 0 ? (
        <Frame>
          <FramePanel className="flex flex-col items-center gap-1.5 py-8 text-center">
            <IconStack aria-hidden="true">
              <Inbox className="size-4" />
            </IconStack>
            <p className="font-medium">Tidak ada case yang cocok.</p>
            <p className="text-sm text-muted-foreground">
              Ubah filter atau reset pencarian.
            </p>
          </FramePanel>
        </Frame>
      ) : (
        <CasesTable
          rows={items}
          total={totalRows}
          page={page}
          per={per}
          sort={sort}
          order={order}
          kept={{ search: q, regionId: region, status, published }}
          regions={regions ?? []}
        />
      )}
    </div>
  );
}
