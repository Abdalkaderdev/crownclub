export const LOCALES = ["en", "ar", "ckb"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const RTL: ReadonlySet<string> = new Set(["ar", "ckb"]);

export function isRtl(locale: Locale): boolean {
  return RTL.has(locale);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  ckb: "کوردی",
};
