import { IndoMapLazy } from "@/components/indo-map-lazy";
import { Badge } from "@/components/reui/badge";
import { StatsCards } from "@/components/stats-cards";
import { ThemeToggle } from "@/components/theme-toggle";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Peta Kasus Keracunan MBG",
      url: "https://embege-poisoning.vercel.app/",
      inLanguage: "id",
    },
    {
      "@type": "Dataset",
      name: "Kasus Keracunan MBG",
      description:
        "Kasus keracunan program Makan Bergizi Gratis (MBG) di Indonesia per kabupaten/kota, dikurasi dari pemberitaan kredibel.",
      url: "https://embege-poisoning.vercel.app/",
      inLanguage: "id",
      keywords: ["MBG", "Makan Bergizi Gratis", "keracunan", "Indonesia"],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <Badge variant="secondary">Liputan data MBG</Badge>
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Peta Kasus Keracunan MBG
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Kasus keracunan program Makan Bergizi Gratis per kabupaten dan kota
            di Indonesia. Setiap kasus dikurasi dari pemberitaan kredibel
            sebelum tayang.
          </p>
          <p className="text-xs text-muted-foreground">
            Diperbarui berkala tiap jam
          </p>
        </header>
        <StatsCards />
        <IndoMapLazy />
        <footer className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            Sumber dari RSS media kredibel. Setiap berita diperiksa kurator
            sebelum tayang di peta.
          </p>
          <p>
            Data awal per 12 September 2026 dihimpun dari{" "}
            <a
              href="https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_makan_siang_gratis#Indonesia"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              daftar kasus keracunan di Wikipedia
            </a>
            .
          </p>
          <p>
            Koordinat yang belum terverifikasi tidak dianggap fakta. Data ini
            bukan data resmi pemerintah.
          </p>
        </footer>
      </main>
    </>
  );
}
