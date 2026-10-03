import { Ambulance, Map as MapIcon, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CaseList } from "@/components/indonesia-map/case-list";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchCaseSlugs,
  fetchPublicCases,
  regionSlug,
} from "@/lib/public-cases";
import { createAnonClient } from "@/lib/supabase/anon";

export const revalidate = 300;

// "KOTA PAGAR ALAM" -> "Kota Pagar Alam"
function displayName(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const findRegion = cache(async (slug: string) => {
  const { data } = await createAnonClient()
    .from("regions")
    .select("id,province,district");
  return data?.find((r) => regionSlug(r.district) === slug) ?? null;
});

// Prebuild districts with cases; the rest render on first request.
export async function generateStaticParams() {
  const slugs = await fetchCaseSlugs(createAnonClient());
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/wilayah/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const region = await findRegion(slug);
  if (!region) return {};
  const name = `${displayName(region.district)}, ${displayName(region.province)}`;
  const title = `Kasus Keracunan MBG di ${name}`;
  const description = `Daftar kasus keracunan program Makan Bergizi Gratis (MBG) di ${name}: tanggal, jumlah korban, sekolah, SPPG, dan sumber berita yang dikurasi.`;
  return {
    title,
    description,
    alternates: { canonical: `/wilayah/${slug}` },
    openGraph: { title, description, url: `/wilayah/${slug}` },
  };
}

export default async function RegionPage({
  params,
}: PageProps<"/wilayah/[slug]">) {
  const { slug } = await params;
  const region = await findRegion(slug);
  if (!region) notFound();
  const cases = await fetchPublicCases(createAnonClient(), region.id);
  const victims = cases.reduce((t, c) => t + (c.victims ?? 0), 0);
  const name = displayName(region.district);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h1>Kasus Keracunan MBG di {name}</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {displayName(region.province)}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="primary-light">
            <Ambulance />
            {cases.length.toLocaleString("id-ID")} kasus
          </Badge>
          <Badge variant="secondary">
            <Users />
            {victims.toLocaleString("id-ID")} korban
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            nativeButton={false}
            render={<Link href={`/?region_id=${region.id}`} />}
          >
            <MapIcon />
            Lihat di peta
          </Button>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <CaseList regionId={region.id} initialCases={cases} />
        </CardContent>
      </Card>
      <footer className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
        <p>
          Setiap berita diperiksa kurator sebelum tayang.{" "}
          <Link href="/" className="underline underline-offset-4">
            Kembali ke peta nasional
          </Link>
          .
        </p>
        <p className="font-bold">Data ini bukan data resmi pemerintah.</p>
      </footer>
    </main>
  );
}
