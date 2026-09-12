import { IndoMapLazy } from "@/components/indo-map-lazy";
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
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Peta Kasus Keracunan MBG
            </h1>
            <p className="text-sm text-muted-foreground">
              Data dikurasi dari pemberitaan kredibel. Klik titik untuk detail.
            </p>
          </div>
          <ThemeToggle />
        </header>
        <IndoMapLazy />
      </main>
    </>
  );
}
