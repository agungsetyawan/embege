import { createHash } from "node:crypto";
import { checkBotId } from "botid/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Public report endpoint for correcting a published case (wrong count,
// wrong date, etc). Protected by Vercel BotID (invisible challenge) plus
// a honeypot and a per-case per-IP hourly rate limit enforced in the DB.
const REASONS = new Set(["victims", "date", "location", "duplicate", "other"]);

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  // Honeypot first: bots fill every field, real users never see it.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Data tidak valid." }, { status: 400 });
  }
  if (str(body.website) !== "") {
    return Response.json({ ok: true }, { status: 201 });
  }

  const verification = await checkBotId();
  if (verification.isBot) {
    return Response.json({ error: "Permintaan ditolak." }, { status: 403 });
  }

  const caseId = str(body.case_id);
  const reason = str(body.reason);
  if (!isUuid(caseId) || !REASONS.has(reason)) {
    return Response.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const noteRaw = str(body.note);
  const note = noteRaw === "" ? null : noteRaw.slice(0, 1000);

  const evidenceRaw = str(body.evidence_url);
  if (evidenceRaw !== "" && !/^https:\/\/\S{1,480}$/.test(evidenceRaw)) {
    return Response.json(
      { error: "Tautan bukti harus dimulai dengan https://" },
      { status: 400 },
    );
  }
  const evidenceUrl = evidenceRaw === "" ? null : evidenceRaw;

  let reportedVictims: number | null = null;
  let reportedDate: string | null = null;
  if (reason === "victims") {
    const raw = body.reported_victims;
    const n = typeof raw === "number" ? raw : Number(str(raw));
    if (!Number.isInteger(n) || n < 0 || n > 1000000) {
      return Response.json(
        { error: "Jumlah korban tidak valid." },
        { status: 400 },
      );
    }
    reportedVictims = n;
  } else if (reason === "date") {
    const raw = str(body.reported_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }
    reportedDate = raw;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  // ponytail: salted IP hash, one report per hash per case per hour is
  // best-effort; a determined script can rotate hashes and only the admin
  // queue catches that. Add Turnstile if this ever becomes a real problem.
  const reporterHash = createHash("sha256")
    .update(`${ip}:${process.env.CRON_SECRET ?? ""}`)
    .digest("hex");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_case_report", {
    p_case_id: caseId,
    p_reason: reason,
    p_reported_victims: reportedVictims,
    p_reported_date: reportedDate,
    p_note: note,
    p_evidence_url: evidenceUrl,
    p_reporter_hash: reporterHash,
  });
  if (error) {
    return Response.json(
      { error: "Laporan gagal dikirim. Coba lagi." },
      { status: 500 },
    );
  }
  if (data === "rate_limited") {
    return Response.json(
      { error: "Kamu sudah melaporkan kasus ini baru-baru ini." },
      { status: 429 },
    );
  }
  if (data !== "ok") {
    return Response.json({ error: "Data tidak valid." }, { status: 400 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
