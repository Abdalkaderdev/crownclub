import en from "./dictionaries/en.json";
import ar from "./dictionaries/ar.json";
import ckb from "./dictionaries/ckb.json";
import type { Locale } from "./config";

export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar, ckb };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
