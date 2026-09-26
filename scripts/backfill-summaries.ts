// One-off backfill: regenerate cases.summary/school/sppg with the existing
// CURATOR_PROMPT via enrichWithGemini. Locked: victims, occurred_on, region_id.
// Restore: UPDATE cases c SET summary=b.summary, victims=b.victims,
//   occurred_on=b.occurred_on, region_id=b.region_id, school=b.school,
//   sppg=b.sppg, source_url=b.source_url, source_media=b.source_media,
//   updated_at=b.updated_at, updated_by_email=b.updated_by_email
//   FROM cases_backup_20260924 b WHERE c.id=b.id;
// Usage: npx tsx scripts/backfill-summaries.ts [--dry-run] [--limit=N]
//   [--after=ID] [--concurrency=N] [--report=PATH]
//   [--retry-report=PATH] [--fallback-report=A,B,...] [--google-url-only]
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  enrichWithGemini,
  fetchArticleText,
  resolvePublisherUrl,
} from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";

// ponytail: tiny dotenv loader, no new dependency for a one-off script.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]])
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const arg = (name: string, def: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const DRY = process.argv.includes("--dry-run");
const LIMIT = Number(arg("limit", "0")) || 0;
const AFTER = arg("after", "");
const CONCURRENCY = Number(arg("concurrency", "3")) || 3;
const DELAY_MS = Number(arg("delay-ms", "300")) || 0;
const RETRY_REPORT = arg("retry-report", "");
const FALLBACK_REPORTS = arg("fallback-report", "").split(",").filter(Boolean);
// Only cases still pointing at a Google News redirect, never touched by a
// human (updated_by_email null or backfill-script).
const GOOGLE_ONLY = process.argv.includes("--google-url-only");
const REPORT = arg(
  "report",
  DRY ? "backfill-dry.json" : "backfill-report.json",
);

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SECRET_KEY"),
);

type Item = { id: string; title: string; summary: string | null };
type Row = {
  id: string;
  summary: string;
  school: string | null;
  sppg: string | null;
  source_url: string;
  created_at: string;
  updated_by_email: string | null;
};

async function main() {
  const { data: cases, error } = await supabase
    .from("cases")
    .select("id,summary,school,sppg,source_url,created_at,updated_by_email")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !cases) throw error ?? new Error("gagal membaca cases");

  const { data: items } = await supabase
    .from("crawl_items")
    .select("id,case_id,url,title,summary")
    .not("case_id", "is", null);
  const byCase = new Map<string, Item>();
  const byUrl = new Map<string, Item>();
  for (const it of items ?? []) {
    const row = {
      id: it.id as string,
      title: it.title as string,
      summary: it.summary as string | null,
    };
    if (it.case_id) byCase.set(it.case_id as string, row);
    if (it.url) byUrl.set(it.url as string, row);
  }

  let queue = (cases as Row[]).filter((c) => !AFTER || c.created_at > AFTER);
  if (GOOGLE_ONLY) {
    queue = queue.filter(
      (c) =>
        c.source_url.startsWith("https://news.google.com/") &&
        (c.updated_by_email === null ||
          c.updated_by_email === "backfill-script"),
    );
  }
  if (RETRY_REPORT) {
    const prev = JSON.parse(readFileSync(RETRY_REPORT, "utf8")) as {
      id: string;
      ok: boolean;
    }[];
    const failed = new Set(prev.filter((o) => !o.ok).map((o) => o.id));
    queue = queue.filter((c) => failed.has(c.id));
  }
  if (FALLBACK_REPORTS.length) {
    // Re-run rows that previously succeeded via text fallback (fetch 403),
    // e.g. after improving fetch headers. Merges several report files.
    const fb = new Set<string>();
    for (const f of FALLBACK_REPORTS) {
      const prev = JSON.parse(readFileSync(f, "utf8")) as {
        id: string;
        ok: boolean;
        fallback: boolean;
      }[];
      for (const o of prev) if (o.ok && o.fallback) fb.add(o.id);
    }
    queue = queue.filter((c) => fb.has(c.id));
  }
  if (LIMIT) queue = queue.slice(0, LIMIT);
  console.log(`cases=${cases.length} queue=${queue.length} dry=${DRY}`);

  type Outcome = {
    id: string;
    ok: boolean;
    fallback: boolean;
    reason?: string;
    oldLen?: number;
    newLen?: number;
  };
  const outcomes: Outcome[] = [];
  let done = 0;

  async function handle(c: Row): Promise<void> {
    const out: Outcome = { id: c.id, ok: false, fallback: false };
    try {
      const item = byCase.get(c.id) ?? byUrl.get(c.source_url);
      const title = item?.title ?? c.summary.slice(0, 150);
      const sourceUrl = await resolvePublisherUrl(c.source_url);
      const fetched = await fetchArticleText(sourceUrl);
      out.fallback = !fetched.text;
      const fallback = [item?.title, item?.summary, c.summary].filter(Boolean);
      const enrichSource = fetched.text
        ? "article"
        : fallback.length
          ? "rss"
          : "empty";
      const fetchedLen = fetched.text?.length ?? null;
      const text = fetched.text ?? fallback.join("\n");
      const result = await enrichWithGemini(title, text);
      if (!result) {
        out.reason = "llm-gagal";
        return;
      }
      out.oldLen = c.summary.length;
      out.newLen = result.summary.length;
      if (!DRY) {
        const now = new Date().toISOString();
        const resolved = sourceUrl !== c.source_url;
        const { error: upErr } = await supabase
          .from("cases")
          .update({
            summary: result.summary,
            school: result.school,
            sppg: result.sppg,
            ...(resolved ? { source_url: sourceUrl } : null),
            updated_at: now,
            updated_by_email: "backfill-script",
          })
          .eq("id", c.id);
        if (upErr) {
          out.reason = `db: ${upErr.message}`;
          return;
        }
        if (item?.id) {
          await supabase
            .from("crawl_items")
            .update({
              llm_summary: result.summary,
              llm_school: result.school,
              llm_sppg: result.sppg,
              enrich_source: enrichSource,
              fetched_len: fetchedLen,
            })
            .eq("id", item.id);
        }
        await supabase.from("admin_audit_log").insert({
          actor_email: "backfill-script",
          action: "case.backfill_summary",
          table_name: "cases",
          row_id: c.id,
          diff: {
            fallback: out.fallback,
            old_len: out.oldLen,
            new_len: out.newLen,
            ...(resolved
              ? { old_url: c.source_url, new_url: sourceUrl }
              : null),
          },
        });
      }
      out.ok = true;
    } catch (e) {
      out.reason = e instanceof Error ? e.message : "unknown";
    } finally {
      outcomes.push(out);
      done++;
      if (done % 10 === 0 || done === queue.length)
        console.log(`progress ${done}/${queue.length}`);
    }
  }

  // ponytail: fixed worker pool, no queue library for a one-off script.
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, queue.length) },
    async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) return;
        await handle(next);
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    },
  );
  await Promise.all(workers);

  const ok = outcomes.filter((o) => o.ok);
  console.log(
    JSON.stringify({
      total: outcomes.length,
      ok: ok.length,
      fallback: ok.filter((o) => o.fallback).length,
      failed: outcomes.length - ok.length,
      failedIds: outcomes
        .filter((o) => !o.ok)
        .map((o) => `${o.id}:${o.reason}`),
    }),
  );
  writeFileSync(REPORT, JSON.stringify(outcomes, null, 1));
  console.log(`report: ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
