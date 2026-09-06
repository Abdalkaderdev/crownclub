import type { Money } from "./money";

export type PriceParse =
  | { kind: "iqd"; value: number }
  | { kind: "foreign"; currency: "USD"; value: number }
  | { kind: "none" };

const NONE: PriceParse = { kind: "none" };

/** Scale a raw figure to dinars. The spreadsheet writes 15,000 IQD as
 *  either `15000` or `15iqd`, so anything under 1000 is shorthand for
 *  thousands. Validated against 70 items present in both data sources
 *  with zero disagreements. */
function scale(n: number): PriceParse {
  if (!Number.isFinite(n) || n <= 0) return NONE;
  const value = Math.round(n < 1000 ? n * 1000 : n);
  return value > 0 ? { kind: "iqd", value } : NONE;
}

export function parsePrice(input: unknown): PriceParse {
  if (input === null || input === undefined) return NONE;

  if (typeof input === "number") return scale(input);

  if (typeof input !== "string") return NONE;

  const raw = input.trim();
  if (!raw) return NONE;

  const negative = /-\s*\d/.test(raw);

  if (raw.includes("$")) {
    const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0 || negative) return NONE;
    return { kind: "foreign", currency: "USD", value: n };
  }

  const digits = raw.replace(/iqd/gi, "").replace(/[^\d.]/g, "");
  if (!digits) return NONE;

  const n = Number.parseFloat(digits);
  if (negative) return NONE;
  return scale(n);
}

export function toMoney(p: PriceParse): Money | null {
  if (p.kind === "iqd") return { currency: "IQD", value: p.value };
  if (p.kind === "foreign") return { currency: p.currency, value: p.value };
  return null;
}

const FORMATTER = new Intl.NumberFormat("en-US");

/** Always Western digits with comma grouping, in every locale. Arabic-Indic
 *  numerals are not universal in Erbil and a misread price is worse than an
 *  unlocalised one.
 *
 *  IQD is the house currency and is left bare — the page carries a single
 *  "prices in IQD unless marked" note. Dollars always carry the symbol,
 *  because a $200 bottle sitting unmarked in a column of dinar figures
 *  would read as 200 dinars. */
export function formatMoney(m: Money): string {
  const n = FORMATTER.format(m.value);
  return m.currency === "USD" ? `$${n}` : n;
}
