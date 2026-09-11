import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peta Kasus Keracunan MBG Indonesia",
    short_name: "Peta MBG",
    description:
      "Peta interaktif kasus keracunan program Makan Bergizi Gratis (MBG) di Indonesia, dikurasi dari pemberitaan kredibel.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
