import { IndoMapLazy } from "@/components/indo-map-lazy";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Peta Kasus Keracunan MBG Indonesia
          </h1>
          <p className="text-sm text-muted-foreground">
            Data dikurasi dari pemberitaan kredibel. Klik titik untuk detail.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <IndoMapLazy />
    </main>
  );
}
