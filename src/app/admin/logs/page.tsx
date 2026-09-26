import { Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { IconStack } from "@/components/reui/icon-stack";
import { createClient } from "@/lib/supabase/server";
import { QueuePagination } from "../queue-pagination";

type CronLogRow = {
  id: number;
  job_kind: string;
  status_code: number | null;
  timed_out: boolean | null;
  error_msg: string | null;
  content: string | null;
  created: string;
  full_count: number;
};

const PAGE_SIZE = 20;

function asNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// One-line summary of a cron endpoint response body.
function summarize(row: CronLogRow): string {
  if (!row.content) return row.error_msg ?? "No response.";
  try {
    const data = JSON.parse(row.content) as Record<string, unknown>;
    if (row.job_kind === "crawl") {
      return (
        `${asNum(data.keywords)} keywords, ` +
        `${asNum(data.fetched)} fetched, ${asNum(data.inserted)} new`
      );
    }
    return (
      `${asNum(data.processed)} processed, ` +
      `${asNum(data.enriched)} enriched, ${asNum(data.failed)} failed`
    );
  } catch {
    return row.content.slice(0, 200);
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const rawPage = Number(params.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const fetchPage = (offset: number) =>
    supabase.rpc("get_cron_http_logs", {
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
  const { data: first } = await fetchPage((wantPage - 1) * PAGE_SIZE);
  let logs = (first ?? []) as CronLogRow[];
  // Page out of range after 6-hour rows expire: fall back to page 1.
  if (logs.length === 0 && wantPage > 1) {
    const { data: fallback } = await fetchPage(0);
    logs = (fallback ?? []) as CronLogRow[];
  }
  const filteredTotal = logs.length > 0 ? logs[0].full_count : 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);

  const pageQuery = (p: number) => `/admin/logs?page=${p}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        Cron HTTP responses from the last 6 hours. Old rows are deleted
        automatically by pg_net.
      </p>
      {logs.length === 0 ? (
        <Frame>
          <FramePanel className="flex flex-col items-center gap-1.5 py-8 text-center">
            <IconStack aria-hidden="true">
              <Activity className="size-4" />
            </IconStack>
            <p className="font-medium">No cron logs yet.</p>
            <p className="text-sm text-muted-foreground">
              Logs appear every time a crawl or enrich job runs.
            </p>
          </FramePanel>
        </Frame>
      ) : (
        <Frame stacked>
          {logs.map((row) => {
            const failed =
              row.timed_out === true ||
              (row.status_code !== null && row.status_code >= 400);
            return (
              <FramePanel key={row.id}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">
                    {new Date(row.created).toLocaleString("en-GB", {
                      timeZone: "Asia/Jakarta",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge variant="outline">{row.job_kind}</Badge>
                  <Badge variant={failed ? "destructive" : "secondary"}>
                    {row.timed_out === true
                      ? "Timed out"
                      : (row.status_code ?? "No status")}
                  </Badge>
                  <span className="w-full text-muted-foreground">
                    {summarize(row)}
                  </span>
                </div>
              </FramePanel>
            );
          })}
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
    </div>
  );
}
