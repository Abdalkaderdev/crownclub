import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Manrope, Noto_Kufi_Arabic } from "next/font/google";
import { LOCALES, isLocale, isRtl, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import "../globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap",
});
const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body-loaded",
  display: "swap",
});
const arabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-arabic-loaded",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: "Crown Club — Bar Menu",
    description: dict.tagline,
    openGraph: {
      title: "Crown Club — Bar Menu",
      description: dict.tagline,
      siteName: "Crown Club",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0C0A0B",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const locale = lang as Locale;

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${display.variable} ${body.variable} ${arabic.variable}`}
    >
      <body className="bg-ink text-cream min-h-screen pb-16 antialiased">{children}</body>
    </html>
  );
}
