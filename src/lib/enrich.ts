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

// One Gemini call: summary + location + MBG poisoning relevance. Any failure -> null (legacy fallback behavior).
export async function enrichWithGemini(
  title: string,
  text: string,
): Promise<LlmResult | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${requiredEnv("GEMINI_API_KEY")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "Kamu kurator berita Indonesia tentang keracunan program MBG (Makan Bergizi Gratis). Relevan (is_poison_related=true) HANYA jika berita melaporkan peristiwa keracunan atau dugaan keracunan yang dikaitkan dengan MBG: korban mual/muntah/diare/dirawat usai makan MBG, jumlah korban, hasil lab, penanganan korban. Tolak (false) untuk kebijakan/anggaran/sosialisasi/pemasok, pernyataan politik, opini/usulan tanpa peristiwa korban baru, klarifikasi hoaks tanpa korban, menu/prestasi umum MBG. Jika ragu, pilih true dengan relevance_confidence rendah. victims = jumlah korban peristiwa keracunan MBG dalam berita, HANYA jika disebut angka eksplisit (contoh: 748 santri, 16 siswa dirawat); null jika tidak disebut atau samar (puluhan, banyak, sejumlah). Jika beberapa angka muncul, ambil total korban peristiwanya (5 intensif dari 100 terdampak berarti 100); jika ada update angka, ambil yang terbaru. Jawab HANYA JSON valid, tanpa markdown.",
              },
            ],
          },
          contents: [{ parts: [{ text: `Judul: ${title}\nIsi: ${text}` }] }],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: {
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
            },
          },
        }),
      },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const summary = String(parsed.summary ?? "").trim();
    if (!summary) return null;
    const conf = Number(parsed.confidence);
    const relConf = Number(parsed.relevance_confidence);
    const victimsRaw = Number(parsed.victims);
    return {
      summary: summary.slice(0, 1000),
      province: parsed.province ? String(parsed.province).trim() : null,
      district: parsed.district ? String(parsed.district).trim() : null,
      confidence: Number.isNaN(conf) ? 0 : Math.min(1, Math.max(0, conf)),
      isPoisonRelated: parsed.is_poison_related !== false,
      relevanceConfidence: Number.isNaN(relConf)
        ? 0
        : Math.min(1, Math.max(0, relConf)),
      rejectReason: parsed.reject_reason
        ? String(parsed.reject_reason).trim().slice(0, 500)
        : null,
      victims:
        parsed.victims === null ||
        parsed.victims === undefined ||
        Number.isNaN(victimsRaw) ||
        victimsRaw < 0
          ? null
          : Math.trunc(victimsRaw),
    };
  } catch {
    return null;
  }
}
