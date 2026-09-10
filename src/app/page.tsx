import { IndoMapLazy } from "@/components/indo-map-lazy";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <header>
        <h1 className="text-2xl font-semibold">
          Peta Kasus Keracunan MBG Indonesia
        </h1>
        <p className="text-sm text-zinc-600">
          Data dikurasi dari pemberitaan kredibel. Klik titik untuk detail.
        </p>
      </header>
      <IndoMapLazy />
    </main>
  );
}
