import { ImageResponse } from "next/og";

export const alt = "Peta Kasus Keracunan MBG Indonesia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
        Peta Kasus Keracunan MBG Indonesia
      </div>
      <div style={{ fontSize: 32, marginTop: 24, color: "#d4d4d4" }}>
        Peta interaktif per kabupaten/kota dari pemberitaan kredibel
      </div>
    </div>,
    { ...size },
  );
}
