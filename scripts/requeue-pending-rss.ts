// One-off: requeue stale pending items and fix Google News source URLs.
// Phase 1: pending crawl_items enriched before enrich_source existed get
// their URL resolved to the publisher, LLM columns cleared, so the enrich
// cron picks them up again with full article text.
// Phase 2: published cases still pointing at a Google News redirect get
// source_url rewritten to the publisher URL (summaries untouched).
// Usage: npx tsx scripts/requeue-pending-rss.ts [--dry-run] [--include-deleted]
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { resolvePublisherUrl, sha256OrNull } from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";

// ponytail: tiny dotenv loader, no new dependency for a one-off script.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]])
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const DRY = process.argv.includes("--dry-run");
const INCLUDE_DELETED = process.argv.includes("--include-deleted");
const ACTOR = "requeue-script";

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SECRET_KEY"),
);

type Outcome = {
  id: string;
  ok: boolean;
  oldUrl?: string;
  newUrl?: string;
  reason?: string;
};
const outcomes: Outcome[] = [];

async function audit(
  table: string,
  rowId: string,
  action: string,
  diff: Record<string, unknown>,
) {
  if (DRY) return;
  await supabase.from("admin_audit_log").insert({
    actor_email: ACTOR,
    action,
    table_name: table,
    row_id: rowId,
    diff,
  });
}

async function main() {
  // Phase 1: stale pending items (LLM output exists but source untracked).
  const { data: pending, error } = await supabase
    .from("crawl_items")
    .select("id,url,raw_url")
    .eq("status", "pending")
    .not("llm_summary", "is", null)
    .is("enrich_source", null);
  if (error || !pending) throw error ?? new Error("gagal membaca antrean");
  console.log(`pending-to-requeue=${pending.length}`);

  for (const item of pending) {
    const out: Outcome = { id: item.id as string, ok: false };
    try {
      const oldUrl = item.url as string;
      const newUrl = await resolvePublisherUrl(oldUrl);
      out.oldUrl = oldUrl;
      out.newUrl = newUrl;
      if (newUrl === oldUrl) {
        out.reason = "decode-gagal, url dipertahankan";
        out.ok = true;
      } else {
        const newHash = sha256OrNull(newUrl);
        const { data: clash } = await supabase
          .from("crawl_items")
          .select("id")
          .eq("url_hash", newHash)
          .neq("id", out.id)
          .limit(1);
        if (clash && clash.length > 0) {
          out.reason = `tabrakan url_hash dengan ${clash[0].id}, dilewati`;
        } else if (!DRY) {
          const { error: upErr } = await supabase
            .from("crawl_items")
            .update({
              url: newUrl,
              raw_url: oldUrl,
              url_hash: newHash,
              llm_summary: null,
              llm_is_relevant: null,
              llm_reject_reason: null,
              llm_victims: null,
              llm_school: null,
              llm_sppg: null,
              geo_confidence: null,
              canonical_hash: null,
              enrich_source: null,
              fetched_len: null,
              duplicate_of_case_id: null,
              duplicate_confidence: null,
              duplicate_reason: null,
            })
            .eq("id", out.id);
          if (upErr) {
            out.reason = `db: ${upErr.message}`;
          } else {
            await audit("crawl_items", out.id, "crawl.requeue_rss", {
              old_url: oldUrl,
              new_url: newUrl,
            });
            out.ok = true;
          }
        } else {
          out.ok = true;
        }
      }
    } catch (e) {
      out.reason = e instanceof Error ? e.message : "unknown";
    } finally {
      outcomes.push(out);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Phase 2: human-touched cases still on a Google redirect (URL fix only).
  let casesQuery = supabase
    .from("cases")
    .select("id,source_url,updated_by_email")
    .like("source_url", "https://news.google.com/%");
  if (!INCLUDE_DELETED) casesQuery = casesQuery.is("deleted_at", null);
  const { data: cases } = await casesQuery;
  const human = (cases ?? []).filter(
    (c) =>
      c.updated_by_email !== null && c.updated_by_email !== "backfill-script",
  );
  console.log(`human-cases-to-fix-url=${human.length}`);

  for (const c of human) {
    const out: Outcome = { id: c.id as string, ok: false };
    try {
      const oldUrl = c.source_url as string;
      const newUrl = await resolvePublisherUrl(oldUrl);
      out.oldUrl = oldUrl;
      out.newUrl = newUrl;
      if (newUrl === oldUrl) {
        out.reason = "decode-gagal, url dipertahankan";
        out.ok = true;
      } else if (!DRY) {
        const { error: upErr } = await supabase
          .from("cases")
          .update({ source_url: newUrl, updated_at: new Date().toISOString() })
          .eq("id", out.id);
        if (upErr) {
          out.reason = `db: ${upErr.message}`;
        } else {
          await audit("cases", out.id, "case.fix_source_url", {
            old_url: oldUrl,
            new_url: newUrl,
          });
          out.ok = true;
        }
      } else {
        out.ok = true;
      }
    } catch (e) {
      out.reason = e instanceof Error ? e.message : "unknown";
    } finally {
      outcomes.push(out);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(
    JSON.stringify({
      total: outcomes.length,
      ok: outcomes.filter((o) => o.ok).length,
      skipped: outcomes
        .filter((o) => o.ok && o.reason)
        .map((o) => `${o.id}:${o.reason}`),
      failed: outcomes.filter((o) => !o.ok).map((o) => `${o.id}:${o.reason}`),
    }),
  );
  writeFileSync("requeue-report.json", JSON.stringify(outcomes, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
