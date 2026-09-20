import { Suspense } from "react";
import { IndonesiaMapLazy } from "@/components/indonesia-map-lazy";
import { StatsCards } from "@/components/stats-cards";
import { StatsCardsSkeleton } from "@/components/stats-cards-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Timeline revalidates every 5 minutes (matches the "Diperbarui berkala" label).
export const revalidate = 300;

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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 lg:max-w-7xl lg:min-h-dvh">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:flex-1 lg:min-h-0 lg:auto-rows-fr">
          <div className="-mx-4 -mt-4 flex min-w-0 flex-col gap-3 md:mx-0 md:mt-0 lg:min-h-0">
            <IndonesiaMapLazy />
          </div>
          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  <h1>Peta Kasus Keracunan MBG</h1>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  Kasus keracunan program Makan Bergizi Gratis per kabupaten dan
                  kota di Indonesia. Setiap kasus dikurasi dari pemberitaan
                  kredibel sebelum tayang.
                </p>
                <p>
                  Ketuk titik di peta atau cari kabupaten/kota untuk melihat
                  rincian kasus.
                </p>
              </CardContent>
            </Card>
            <div className="order-first md:order-0">
              <Suspense fallback={<StatsCardsSkeleton />}>
                <StatsCards />
              </Suspense>
            </div>
          </aside>
        </div>
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
