import * as cheerio from "cheerio";
import { requiredEnv } from "@/lib/env";

const MAX_TEXT = 4000;

// Ambil teks artikel (paragraf saja). Gagal (403/timeout/non-HTML) -> null, fallback ke snippet RSS.
export async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MBG-SIG/1.0)" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok || !res.headers.get("content-type")?.includes("html"))
      return null;
    const html = await res.text();
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
};

// Satu call Gemini: ringkasan + lokasi. Gagal apa pun -> null (fallback perilaku lama).
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
                text: "Kamu mengekstrak info dari berita Indonesia tentang program MBG (Makan Bergizi Gratis). Jawab HANYA JSON valid, tanpa markdown.",
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
              },
              required: ["summary", "confidence"],
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
    return {
      summary: summary.slice(0, 1000),
      province: parsed.province ? String(parsed.province).trim() : null,
      district: parsed.district ? String(parsed.district).trim() : null,
      confidence: Number.isNaN(conf) ? 0 : Math.min(1, Math.max(0, conf)),
    };
  } catch {
    return null;
  }
}
