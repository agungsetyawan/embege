import { fetchPublicCases } from "@/lib/public-cases";
import { createAnonClient } from "@/lib/supabase/anon";

// Public dataset download. Static, regenerated every 5 minutes.
export const revalidate = 300;

const HEADER = [
  "id",
  "provinsi",
  "kabupaten_kota",
  "tanggal_kejadian",
  "jumlah_korban",
  "sekolah",
  "sppg",
  "ringkasan",
  "media_sumber",
  "url_sumber",
  "sumber_lain",
];

// Quote every field; prefix formula triggers so spreadsheets do not execute them.
function cell(value: string | number | null): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const cases = await fetchPublicCases(createAnonClient()).catch(() => null);
  if (!cases) return new Response("Gagal memuat data", { status: 500 });

  const lines = [
    HEADER.join(","),
    ...cases.map((c) =>
      [
        c.id,
        c.province,
        c.district,
        c.occurred_on,
        c.victims,
        c.school,
        c.sppg,
        c.summary,
        c.source_media,
        c.source_url,
        c.sources.map((s) => s.url).join(" | ") || null,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  // BOM so Excel opens the UTF-8 file with the right encoding.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kasus-mbg.csv"',
    },
  });
}
