import type { Money } from "./money";

export type PriceParse =
  | { kind: "iqd"; value: number }
  | { kind: "foreign"; currency: "USD"; value: number }
  | { kind: "none" };

const NONE: PriceParse = { kind: "none" };

// Real menu items top out around a 250,000 IQD premium bottle. Anything
// past 100,000,000 is a fat-fingered extra zero, not a real price — reject
// it outright rather than show a customer an absurd number.
const IQD_UPPER_BOUND = 100_000_000;

/** Scale a raw figure to dinars. The spreadsheet writes 15,000 IQD as
 *  either `15000` or `15iqd`, so anything under 1000 is shorthand for
 *  thousands. Validated against 70 items present in both data sources
 *  with zero disagreements. */
function scale(n: number): PriceParse {
  if (!Number.isFinite(n) || n <= 0) return NONE;
  const value = Math.round(n < 1000 ? n * 1000 : n);
  return value > 0 && value <= IQD_UPPER_BOUND ? { kind: "iqd", value } : NONE;
}

// Any dash-like glyph: ASCII hyphen, the general hyphen/dash block
// (U+2010-U+2015), and the Unicode minus sign U+2212 — what Excel/Word
// autocorrect substitutes for a typed hyphen. A price cell has no
// legitimate reason to contain a dash, so reject outright rather than try
// to parse around it.
const DASH_LIKE = /[\u002D\u2010-\u2015\u2212]/;

// Accounting-style negatives, e.g. "(10000)".
const PAREN_WRAPPED = /^\(.*\)$/;

// No word boundaries: a price cell containing the letters "usd" for any
// reason other than dollars is not a real scenario, and staff hand-typing
// prices into a spreadsheet will write "200usd" with no space just as
// often as "200 USD".
const USD_WORD = /usd/i;

// A single run of digits, with optional comma grouping and a decimal tail.
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;

export function parsePrice(input: unknown): PriceParse {
  if (input === null || input === undefined) return NONE;

  if (typeof input === "number") return scale(input);

  if (typeof input !== "string") return NONE;

  const raw = input.trim();
  if (!raw) return NONE;

  if (DASH_LIKE.test(raw) || PAREN_WRAPPED.test(raw)) return NONE;

  const isUsd = raw.includes("$") || USD_WORD.test(raw);
  const stripped = raw.replace(/\$/g, "").replace(/usd/gi, "").replace(/iqd/gi, "");

  // Exactly one number, or it's unparseable/ambiguous. A cell with zero
  // numbers has nothing to price; a cell with two or more (a size range, a
  // pair of variant prices) is ambiguous, and guessing at an ambiguous
  // price is worse than showing "Ask staff".
  const matches = stripped.match(NUMBER_RE);
  if (!matches || matches.length !== 1) return NONE;

  const n = Number.parseFloat(matches[0].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return NONE;

  if (isUsd) return { kind: "foreign", currency: "USD", value: n };

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
