import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://embege-poisoning.vercel.app"),
  title: {
    default: "Peta Kasus Keracunan MBG",
    template: "%s | Peta Kasus Keracunan MBG",
  },
  description:
    "Peta interaktif kasus keracunan program Makan Bergizi Gratis (MBG) di Indonesia per kabupaten/kota, dikurasi dari pemberitaan kredibel dan diperbarui berkala.",
  keywords: [
    "MBG",
    "Makan Bergizi Gratis",
    "keracunan MBG",
    "peta kasus keracunan",
    "kasus keracunan Indonesia",
  ],
  authors: [{ name: "Peta Kasus Keracunan MBG" }],
  creator: "Peta Kasus Keracunan MBG",
  publisher: "Peta Kasus Keracunan MBG",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "Peta Kasus Keracunan MBG",
    title: "Peta Kasus Keracunan MBG",
    description:
      "Peta interaktif kasus keracunan program Makan Bergizi Gratis (MBG) di Indonesia per kabupaten/kota, dikurasi dari pemberitaan kredibel.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Peta Kasus Keracunan MBG",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peta Kasus Keracunan MBG",
    description:
      "Peta interaktif kasus keracunan program Makan Bergizi Gratis (MBG) di Indonesia, dikurasi dari pemberitaan kredibel.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
