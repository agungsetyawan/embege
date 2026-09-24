import { Inbox } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { IconStack } from "@/components/reui/icon-stack";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";
import { AdminHeader } from "./admin-header";
import { DeletedItem, type DeletedItemData } from "./deleted-item";
import {
  type DuplicateCase,
  PendingItem,
  type PendingItemData,
} from "./pending-item";
import { QueueFilters, type QueueTab } from "./queue-filters";
import { QueuePagination } from "./queue-pagination";
import { RejectedItem, type RejectedItemData } from "./rejected-item";
import { type CaseTwin, ReportItem, type ReportItemData } from "./report-item";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    q?: string;
    regionId?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const tab: QueueTab =
    params.tab === "rejected"
      ? "rejected"
      : params.tab === "reports"
        ? "reports"
        : params.tab === "deleted"
          ? "deleted"
          : "pending";
  const q = (params.q ?? "").trim().slice(0, 200);
  const region = isUuid(params.regionId ?? "")
    ? (params.regionId as string)
    : "";
  // Strip PostgREST OR-syntax chars, same as /admin/cases.
  const safe = q.replace(/[%(),]/g, " ").trim();
  const filtering = q !== "" || region !== "";
  const PAGE_SIZE = 20;
  const rawPage = Number(params.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [
    { count: pendingCount },
    { count: autoCount },
    { count: reportCount },
    { count: deletedCount },
  ] = await Promise.all([
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected")
      .eq("llm_is_relevant", false),
    supabase
      .from("case_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);

  // One search box across all queue columns (OR), same sanitizing as
  // /admin/cases. Badge counts above stay global; the list query carries
  // its own exact count so filtering costs one roundtrip. Wilayah filters
  // guessed_region_id on crawl tabs (the only region signal there), case
  // region on reports/deleted.
  const crawlOr = (s: string) =>
    ["title", "summary", "llm_summary", "media", "url"]
      .map((c) => `${c}.ilike.%${s}%`)
      .join(",");
  const buildList = (from: number, to: number) =>
    tab === "rejected"
      ? (() => {
          let query = supabase
            .from("crawl_items")
            .select(
              "id,title,summary,url,media,published_at,llm_summary,llm_reject_reason",
              { count: "exact" },
            )
            .eq("status", "rejected")
            .eq("llm_is_relevant", false);
          if (region) query = query.eq("guessed_region_id", region);
          if (safe) query = query.or(crawlOr(safe));
          return query
            .order("published_at", { ascending: false, nullsFirst: false })
            .range(from, to);
        })()
      : tab === "reports"
        ? (() => {
            let query = supabase
              .from("case_reports")
              .select(
                "id,reason,reported_victims,reported_date,note,evidence_url,created_at,case:cases!inner(id,region_id,summary,victims,occurred_on,source_url,region:regions(province,district))",
                { count: "exact" },
              )
              .eq("status", "open");
            if (region) query = query.eq("case.region_id", region);
            if (safe)
              query = query.or(
                `reason.ilike.%${safe}%,note.ilike.%${safe}%,evidence_url.ilike.%${safe}%`,
              );
            return query
              .order("created_at", { ascending: false })
              .range(from, to);
          })()
        : tab === "deleted"
          ? (() => {
              let query = supabase
                .from("cases")
                .select(
                  "id,summary,victims,occurred_on,source_media,source_url,deleted_at,region:regions(province,district)",
                  { count: "exact" },
                )
                .not("deleted_at", "is", null);
              if (region) query = query.eq("region_id", region);
              if (safe)
                query = query.or(
                  `summary.ilike.%${safe}%,source_media.ilike.%${safe}%,source_url.ilike.%${safe}%`,
                );
              return query
                .order("deleted_at", { ascending: false })
                .range(from, to);
            })()
          : (() => {
              let query = supabase
                .from("crawl_items")
                .select(
                  "id,title,summary,url,media,published_at,guessed_region_id,llm_summary,llm_victims,geo_confidence,duplicate_of_case_id,duplicate_confidence,duplicate_reason",
                  { count: "exact" },
                )
                .eq("status", "pending");
              if (region) query = query.eq("guessed_region_id", region);
              if (safe) query = query.or(crawlOr(safe));
              return query
                .order("published_at", {
                  ascending: false,
                  nullsFirst: false,
                })
                .range(from, to);
            })();
  const [first, { data: regions }] = await Promise.all([
    buildList((wantPage - 1) * PAGE_SIZE, wantPage * PAGE_SIZE - 1),
    supabase
      .from("regions")
      .select("id,province,district,centroid_ok")
      .order("province")
      .order("district"),
  ]);
  const filteredTotal = first.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);
  const items = first.data;

  // Candidate duplicates for "duplicate-news" reports: same source URL
  // (classic double-approve) or same region + same date.
  const twinsByReport = new Map<string, CaseTwin[]>();
  if (tab === "reports") {
    const dupReports = (
      (items as unknown as ReportItemData[] | undefined) ?? []
    ).filter((r) => r.reason === "duplicate");
    await Promise.all(
      dupReports.map(async (r) => {
        const c = r.case;
        const [byUrl, byEvent] = await Promise.all([
          supabase
            .from("cases")
            .select("id,summary,victims,occurred_on,source_media,source_url")
            .eq("source_url", c.source_url)
            .neq("id", c.id)
            .is("deleted_at", null)
            .limit(5),
          c.occurred_on
            ? supabase
                .from("cases")
                .select(
                  "id,summary,victims,occurred_on,source_media,source_url",
                )
                .eq("region_id", c.region_id)
                .eq("occurred_on", c.occurred_on)
                .neq("id", c.id)
                .is("deleted_at", null)
                .limit(5)
            : Promise.resolve({ data: [] as CaseTwin[] }),
        ]);
        const seen = new Set<string>();
        const twins: CaseTwin[] = [];
        for (const row of [...(byUrl.data ?? []), ...(byEvent.data ?? [])]) {
          if (seen.has(row.id) || twins.length >= 5) continue;
          seen.add(row.id);
          twins.push(row);
        }
        twinsByReport.set(r.id, twins);
      }),
    );
  }

  const pageQuery = (p: number) => {
    const params = new URLSearchParams();
    if (tab !== "pending") params.set("tab", tab);
    if (q) params.set("q", q);
    if (region) params.set("regionId", region);
    params.set("page", String(p));
    return `/admin?${params.toString()}`;
  };

  // Duplicate hints for pending items: fetch the referenced published cases.
  const duplicatesByItem = new Map<string, DuplicateCase>();
  if (tab === "pending") {
    const ids = ((items as unknown as PendingItemData[] | undefined) ?? [])
      .map((i) => i.duplicate_of_case_id)
      .filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: dupCases } = await supabase
        .from("cases")
        .select("id,summary,victims,occurred_on,source_media")
        .in("id", [...new Set(ids)]);
      for (const c of dupCases ?? []) duplicatesByItem.set(c.id, c);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <AdminHeader
        active={tab}
        title="Kurasi Berita"
        meta={
          <>
            <Badge variant="secondary">{pendingCount ?? 0} antre</Badge>
            <Badge variant="outline">{autoCount ?? 0} ditolak otomatis</Badge>
            <Badge variant="outline">{reportCount ?? 0} laporan</Badge>
            <Badge variant="outline">{deletedCount ?? 0} terhapus</Badge>
          </>
        }
        email={user.email}
      >
        <QueueFilters
          key={tab}
          initialQ={q}
          initialRegionId={region}
          tab={tab}
          regions={regions ?? []}
        />
      </AdminHeader>
      {(items?.length ?? 0) === 0 ? (
        <Frame>
          <FramePanel className="flex flex-col items-center gap-1.5 py-8 text-center">
            <IconStack aria-hidden="true">
              <Inbox className="size-4" />
            </IconStack>
            <p className="font-medium">
              {filtering
                ? "Tidak ada hasil yang cocok."
                : tab === "rejected"
                  ? "Belum ada berita yang ditolak otomatis."
                  : tab === "reports"
                    ? "Belum ada laporan masuk."
                    : tab === "deleted"
                      ? "Tidak ada case yang dihapus."
                      : "Antrean bersih."}
            </p>
            {filtering ? (
              <p className="text-sm text-muted-foreground">
                Ubah kata kunci atau wilayah, atau reset pencarian.
              </p>
            ) : (
              tab === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Berita baru masuk otomatis tiap jam.
                </p>
              )
            )}
          </FramePanel>
        </Frame>
      ) : (
        <Frame stacked>
          {tab === "rejected"
            ? (items as RejectedItemData[] | undefined)?.map((item) => (
                <RejectedItem key={item.id} item={item} />
              ))
            : tab === "reports"
              ? (items as unknown as ReportItemData[] | undefined)?.map(
                  (report) => (
                    <ReportItem
                      key={report.id}
                      report={report}
                      regions={regions ?? []}
                      twins={twinsByReport.get(report.id) ?? []}
                    />
                  ),
                )
              : tab === "deleted"
                ? (items as unknown as DeletedItemData[] | undefined)?.map(
                    (item) => <DeletedItem key={item.id} item={item} />,
                  )
                : (items as PendingItemData[] | undefined)?.map((item) => (
                    <PendingItem
                      key={item.id}
                      item={item}
                      regions={regions ?? []}
                      duplicate={
                        item.duplicate_of_case_id
                          ? (duplicatesByItem.get(item.duplicate_of_case_id) ??
                            null)
                          : null
                      }
                    />
                  ))}
        </Frame>
      )}
      {totalPages > 1 && (
        <QueuePagination
          page={page}
          totalPages={totalPages}
          total={filteredTotal}
          pageSize={PAGE_SIZE}
          pageQuery={pageQuery}
          className="sticky bottom-0 z-30 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur"
        />
      )}
    </main>
  );
}
