import { notFound } from "next/navigation";
import menu from "@/data/menu.json";
import { Hero } from "@/components/Hero";
import { MenuBrowser } from "@/components/MenuBrowser";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import type { MenuItem } from "@/lib/menu-schema";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const locale = lang as Locale;
  const dict = getDictionary(locale);
  const items = menu.items as MenuItem[];

  return (
    <div className="mx-auto max-w-[580px] px-4">
      <Hero dict={dict} locale={locale} />
      <MenuBrowser initialItems={items} dict={dict} />
      <footer className="text-muted py-8 text-center text-xs">Crown Club</footer>
    </div>
  );
}
