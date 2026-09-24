import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { requiredEnv } from "@/lib/env";

export const DEFAULT_MAX_TEXT = 10000;
export const DEFAULT_MAX_HTML = 1500000;

// Lowercase host, no query/fragment/trailing slash. Invalid -> null.
function normalizeCanonical(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}`;
}

export const sha256OrNull = (s: string | null) =>
  s ? createHash("sha256").update(s).digest("hex") : null;

// Exact-match headline hash for crawl-time dedup. Empty -> null (never dedups).
export function titleHash(title: string): string | null {
  const norm = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sha256OrNull(norm || null);
}

export type ArticleFetch = {
  text: string | null;
  // Normalized <link rel="canonical">, null when absent or invalid.
  canonical: string | null;
};

// Fetch article text (paragraphs only) plus canonical URL. Failure
// (403/timeout/non-HTML) -> nulls, caller falls back to the RSS snippet.
export async function fetchArticleText(
  url: string,
  opts: { maxText?: number; maxHtml?: number } = {},
): Promise<ArticleFetch> {
  const { maxText = DEFAULT_MAX_TEXT, maxHtml = DEFAULT_MAX_HTML } = opts;
  const none: ArticleFetch = { text: null, canonical: null };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return none;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return none;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        Referer: "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
      },
    }).finally(() => clearTimeout(timer));
    if (!res.ok || !res.headers.get("content-type")?.includes("html"))
      return none;
    const len = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(len) && len > maxHtml) return none;
    const html = await res.text();
    if (html.length > maxHtml) return none;
    const $ = cheerio.load(html);
    const canonical = normalizeCanonical(
      $('link[rel="canonical"]').attr("href") ?? "",
    );
    $("script, style, nav, header, footer, aside, form").remove();
    const text = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .join(" ");
    return { text: text ? text.slice(0, maxText) : null, canonical };
  } catch {
    return none;
  }
}

export type LlmResult = {
  summary: string;
  province: string | null;
  district: string | null;
  confidence: number;
  isPoisonRelated: boolean;
  relevanceConfidence: number;
  rejectReason: string | null;
  victims: number | null;
  school: string | null;
  sppg: string | null;
};

// Normalize one LLM JSON object into LlmResult. Validation failure -> null.
const clamp01 = (n: number) =>
  Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n));

function parseLlmResult(parsed: unknown): LlmResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const summary = String(p.summary ?? "").trim();
  if (!summary) return null;
  const conf = Number(p.confidence);
  const relConf = Number(p.relevance_confidence);
  const victimsRaw = Number(p.victims);
  const cleanText = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;
  return {
    summary: summary.slice(0, 1000),
    school: cleanText(p.school),
    sppg: cleanText(p.sppg),
    province:
      typeof p.province === "string" && p.province.trim()
        ? p.province.trim()
        : null,
    district:
      typeof p.district === "string" && p.district.trim()
        ? p.district.trim()
        : null,
    confidence: clamp01(conf),
    isPoisonRelated: p.is_poison_related !== false,
    relevanceConfidence: clamp01(relConf),
    rejectReason:
      typeof p.reject_reason === "string" && p.reject_reason.trim()
        ? p.reject_reason.trim().slice(0, 500)
        : null,
    victims:
      p.victims === null ||
      p.victims === undefined ||
      Number.isNaN(victimsRaw) ||
      victimsRaw < 0
        ? null
        : Math.trunc(victimsRaw),
  };
}

const CURATOR_PROMPT =
  "Kamu kurator berita Indonesia tentang keracunan program MBG (Makan Bergizi Gratis). Relevan (is_poison_related=true) HANYA jika berita melaporkan peristiwa keracunan atau dugaan keracunan yang dikaitkan dengan MBG: korban mual/muntah/diare/dirawat usai makan MBG, jumlah korban, hasil lab, penanganan korban. Tolak (false) untuk kebijakan/anggaran/sosialisasi/pemasok, pernyataan politik, opini/usulan tanpa peristiwa korban baru, klarifikasi hoaks tanpa korban, menu/prestasi umum MBG. Jika ragu, pilih true dengan relevance_confidence rendah. victims = jumlah korban peristiwa keracunan MBG dalam berita, HANYA jika disebut angka eksplisit (contoh: 748 santri, 16 siswa dirawat); null jika tidak disebut atau samar (puluhan, banyak, sejumlah). Jika beberapa angka muncul, ambil total korban peristiwanya (5 intensif dari 100 terdampak berarti 100); jika ada update angka, ambil yang terbaru. school = nama sekolah yang keracunan plus detail bila disebut (jenjang, alamat, korban per sekolah), verbatim dari berita, beberapa sekolah gabung dengan '; ', null bila tidak disebut eksplisit dan jangan tebak. sppg = nama SPPG/dapur MBG pemasok plus wilayah/penyedia bila disebut, verbatim dari berita, beberapa gabung dengan '; ', null bila tidak disebut eksplisit dan jangan tebak. Jawab HANYA JSON valid, tanpa markdown.";

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    province: { type: "STRING", nullable: true },
    district: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    is_poison_related: { type: "BOOLEAN" },
    relevance_confidence: { type: "NUMBER" },
    reject_reason: { type: "STRING", nullable: true },
    victims: { type: "INTEGER", nullable: true },
    school: { type: "STRING", nullable: true },
    sppg: { type: "STRING", nullable: true },
  },
  required: [
    "summary",
    "confidence",
    "is_poison_related",
    "relevance_confidence",
  ],
};

async function callGemini(
  contents: unknown,
  responseSchema: unknown,
  systemPrompt: string = CURATOR_PROMPT,
) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${requiredEnv("GEMINI_API_KEY")}`,
    // `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${requiredEnv("GEMINI_API_KEY")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0,
          response_schema: responseSchema,
        },
      }),
    },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

export type DuplicateCandidate = {
  id: string;
  summary: string;
  victims: number | null;
  occurred_on: string | null;
  source_media: string;
};

export type DuplicateResult = {
  isDuplicate: boolean;
  duplicateOfCaseId: string | null;
  confidence: number;
  isUpdate: boolean;
  reason: string | null;
};

const DEDUP_PROMPT =
  "Kamu pembanding berita keracunan MBG. Diberi satu berita baru dan daftar kasus yang sudah terbit (sama kabupaten/kota, tanggal berdekatan). Duplikat (is_duplicate=true) HANYA jika peristiwa sama: lokasi dan tanggal kejadian cocok dan korban sekelompok (toleransi beda angka karena update). Jika berita baru membawa angka korban lebih baru atau detail perkembangan dari peristiwa yang sama, tetap is_duplicate=true tapi is_update=true. Jika lokasi beda, tanggal beda jauh (>7 hari tanpa kaitan eksplisit), atau peristiwa berbeda, is_duplicate=false. duplicate_of_case_id = id kandidat yang cocok, null jika bukan duplikat. Jawab HANYA JSON valid, tanpa markdown.";

const DEDUP_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_duplicate: { type: "BOOLEAN" },
    duplicate_of_case_id: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    is_update: { type: "BOOLEAN" },
    reason: { type: "STRING", nullable: true },
  },
  required: ["is_duplicate", "confidence", "is_update"],
};

function parseDuplicateResult(
  parsed: unknown,
  candidates: DuplicateCandidate[],
): DuplicateResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const conf = Number(p.confidence);
  const rawId =
    typeof p.duplicate_of_case_id === "string"
      ? p.duplicate_of_case_id.trim()
      : null;
  const match = candidates.some((c) => c.id === rawId) ? rawId : null;
  const isDup = p.is_duplicate === true && match !== null;
  return {
    isDuplicate: isDup,
    duplicateOfCaseId: isDup ? match : null,
    confidence: clamp01(conf),
    isUpdate: p.is_update === true,
    reason:
      typeof p.reason === "string" && p.reason.trim()
        ? p.reason.trim().slice(0, 500)
        : null,
  };
}

// One Gemini call: is the new item the same event as an already-published case? Any failure -> null.
export async function checkDuplicateWithGemini(
  title: string,
  summary: string,
  candidates: DuplicateCandidate[],
): Promise<DuplicateResult | null> {
  try {
    const lines = candidates.map(
      (c, i) =>
        `${i + 1}. id=${c.id} tanggal=${c.occurred_on ?? "?"} korban=${c.victims ?? "?"} media=${c.source_media} ringkasan=${c.summary.slice(0, 500)}`,
    );
    const parsed = await callGemini(
      [
        {
          parts: [
            {
              text: `Berita baru: ${title} — ${summary.slice(0, 1000)}\nKandidat:\n${lines.join("\n")}`,
            },
          ],
        },
      ],
      DEDUP_SCHEMA,
      DEDUP_PROMPT,
    );
    return parsed ? parseDuplicateResult(parsed, candidates) : null;
  } catch {
    return null;
  }
}
// One Gemini call: summary + location + MBG poisoning relevance. Any failure -> null.
export async function enrichWithGemini(
  title: string,
  text: string,
): Promise<LlmResult | null> {
  try {
    const parsed = await callGemini(
      [{ parts: [{ text: `Judul: ${title}\nIsi: ${text}` }] }],
      ITEM_SCHEMA,
    );
    return parsed ? parseLlmResult(parsed) : null;
  } catch {
    return null;
  }
}
