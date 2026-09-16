import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { createAnonClient } from "@/lib/supabase/anon";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

async function fetchStats() {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("case_summary")
      .select("count,victims")
      .gt("count", 0);
    if (error || !data) return null;
    return {
      regions: data.length,
      cases: data.reduce((n, r) => n + (r.count ?? 0), 0),
      victims: data.reduce((n, r) => n + (r.victims ?? 0), 0),
    };
  } catch {
    return null;
  }
}

// Indonesia map path for the background watermark. Satori does not support
// SVG as <img>, so the path is read from public/id.svg and rendered
// as an inline <svg> element. Read failure = plain black fallback.
async function fetchMapPath(): Promise<string | null> {
  try {
    const svg = await readFile(join(process.cwd(), "public", "id.svg"), "utf8");
    return svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [stats, mapD] = await Promise.all([fetchStats(), fetchMapPath()]);
  const fmt = (n: number) => n.toLocaleString("id-ID");

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      {mapD && (
        <svg
          width={1000}
          height={368}
          viewBox="0 0 1000 368"
          aria-hidden="true"
          style={{ position: "absolute", right: -30, bottom: 40, opacity: 0.1 }}
        >
          <path d={mapD} fill="#fff" />
        </svg>
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 28, marginTop: 20, color: "#d4d4d4" }}>
          {SITE_DESCRIPTION}
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 72, marginTop: 48 }}>
            {[
              [fmt(stats.cases), "Kasus"],
              [fmt(stats.victims), "Korban"],
              [fmt(stats.regions), "Kab/Kota terdampak"],
            ].map(([value, label]) => (
              <div
                key={label}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div style={{ fontSize: 60, fontWeight: 700 }}>{value}</div>
                <div style={{ fontSize: 26, color: "#a3a3a3" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    { ...size },
  );
}
