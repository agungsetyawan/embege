import * as cheerio from "cheerio";
import { requiredEnv } from "@/lib/env";

const MAX_TEXT = 4000;
const MAX_HTML = 1500000;

// Ambil teks artikel (paragraf saja). Gagal (403/timeout/non-HTML) -> null, fallback ke snippet RSS.
export async function fetchArticleText(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MBG-SIG/1.0)" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok || !res.headers.get("content-type")?.includes("html"))
      return null;
    const len = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(len) && len > MAX_HTML) return null;
    const html = await res.text();
    if (html.length > MAX_HTML) return null;
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, form").remove();
    const text = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .join(" ");
    return text ? text.slice(0, MAX_TEXT) : null;
  } catch {
    return null;
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
};

// Normalisasi satu objek JSON LLM menjadi LlmResult. Gagal validasi -> null.
function parseLlmResult(parsed: unknown): LlmResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const summary = String(p.summary ?? "").trim();
  if (!summary) return null;
  const conf = Number(p.confidence);
  const relConf = Number(p.relevance_confidence);
  const victimsRaw = Number(p.victims);
  return {
    summary: summary.slice(0, 1000),
    province:
      typeof p.province === "string" && p.province.trim()
        ? p.province.trim()
        : null,
    district:
      typeof p.district === "string" && p.district.trim()
        ? p.district.trim()
        : null,
    confidence: Number.isNaN(conf) ? 0 : Math.min(1, Math.max(0, conf)),
    isPoisonRelated: p.is_poison_related !== false,
    relevanceConfidence: Number.isNaN(relConf)
      ? 0
      : Math.min(1, Math.max(0, relConf)),
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
  "Kamu kurator berita Indonesia tentang keracunan program MBG (Makan Bergizi Gratis). Relevan (is_poison_related=true) HANYA jika berita melaporkan peristiwa keracunan atau dugaan keracunan yang dikaitkan dengan MBG: korban mual/muntah/diare/dirawat usai makan MBG, jumlah korban, hasil lab, penanganan korban. Tolak (false) untuk kebijakan/anggaran/sosialisasi/pemasok, pernyataan politik, opini/usulan tanpa peristiwa korban baru, klarifikasi hoaks tanpa korban, menu/prestasi umum MBG. Jika ragu, pilih true dengan relevance_confidence rendah. victims = jumlah korban peristiwa keracunan MBG dalam berita, HANYA jika disebut angka eksplisit (contoh: 748 santri, 16 siswa dirawat); null jika tidak disebut atau samar (puluhan, banyak, sejumlah). Jika beberapa angka muncul, ambil total korban peristiwanya (5 intensif dari 100 terdampak berarti 100); jika ada update angka, ambil yang terbaru. Jawab HANYA JSON valid, tanpa markdown.";

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
  },
  required: [
    "summary",
    "confidence",
    "is_poison_related",
    "relevance_confidence",
  ],
};

async function callGemini(contents: unknown, responseSchema: unknown) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${requiredEnv("GEMINI_API_KEY")}`,
    // `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${requiredEnv("GEMINI_API_KEY")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CURATOR_PROMPT }] },
        contents,
        generationConfig: {
          response_mime_type: "application/json",
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

export type BatchEnrichItem = { id: string; title: string; text: string };

// One Gemini call for the whole batch. Returns id -> result; unknown/invalid ids dropped.
export async function enrichBatchWithGemini(
  items: BatchEnrichItem[],
): Promise<Map<string, LlmResult>> {
  const out = new Map<string, LlmResult>();
  if (items.length === 0) return out;
  try {
    const ids = new Set(items.map((i) => i.id));
    const parsed = await callGemini(
      [
        {
          parts: [
            {
              text: `Ada ${items.length} berita. Untuk SETIAP berita, salin id-nya persis dan isi field kurasi. Jawab SATU array JSON (satu objek per berita, urutan sama).\n${JSON.stringify(items.map((i) => ({ id: i.id, judul: i.title, isi: i.text })))}`,
            },
          ],
        },
      ],
      {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { id: { type: "STRING" }, ...ITEM_SCHEMA.properties },
          required: ["id", ...ITEM_SCHEMA.required],
        },
      },
    );
    if (!Array.isArray(parsed)) return out;
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const id = String((entry as Record<string, unknown>).id ?? "");
      // ponytail: first valid object per id wins, LLM duplicates ignored
      if (!ids.has(id) || out.has(id)) continue;
      const result = parseLlmResult(entry);
      if (result) out.set(id, result);
    }
  } catch {
    // Fallthrough: caller falls back to per-item calls for missing ids.
  }
  return out;
}
