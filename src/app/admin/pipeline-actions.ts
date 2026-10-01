"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requiredEnv } from "@/lib/env";
import { requireAdmin } from "./actions";

export type PipelineResult = { ok: boolean; message: string };

// Call the cron endpoint via server-side loopback so CRON_SECRET never
// reaches the browser. Crawl/enrich logic lives only in the route.
async function callCron(
  path: "/api/cron/crawl" | "/api/cron/enrich",
): Promise<{ status: number; body: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}${path}`, {
    headers: { authorization: `Bearer ${requiredEnv("CRON_SECRET")}` },
    cache: "no-store",
  });
  return { status: res.status, body: await res.text() };
}

function summarize(status: number, body: string): PipelineResult {
  if (status !== 200) return { ok: false, message: `Gagal (HTTP ${status}).` };
  try {
    return { ok: true, message: JSON.stringify(JSON.parse(body), null, 2) };
  } catch {
    return { ok: false, message: "Gagal: respons tidak valid." };
  }
}

export async function triggerCrawl(): Promise<PipelineResult> {
  return runPipeline("crawl", "pipeline.crawl_manual");
}

export async function triggerEnrich(): Promise<PipelineResult> {
  return runPipeline("enrich", "pipeline.enrich_manual");
}

async function runPipeline(
  kind: "crawl" | "enrich",
  auditAction: "pipeline.crawl_manual" | "pipeline.enrich_manual",
): Promise<PipelineResult> {
  const { log } = await requireAdmin();
  try {
    const { status, body } = await callCron(`/api/cron/${kind}`);
    const result = summarize(status, body);
    await log({
      action: auditAction,
      table: "crawl_items",
      diff: { ok: result.ok, message: result.message },
    });
    if (result.ok) revalidatePath("/admin");
    return result;
  } catch {
    return { ok: false, message: "Gagal: tidak bisa menghubungi cron." };
  }
}
