# Crown Club QR Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a three-language, instantly-rendering QR drinks menu for Crown Club (Erbil) on the client's own Vercel account, replacing the previous developer's Cloudflare Workers page.

**Architecture:** Next.js 15 App Router prerenders `/en`, `/ar`, `/ckb` from a committed `menu.json` so the first paint is static HTML off a CDN with no spinner. After hydration, a client component fetches `/api/menu` — a Route Handler that proxies and edge-caches the client's Google Sheet — and swaps in live prices only if the payload passes a sanity guard. If the sheet is unreachable, malformed, or suspiciously small, the baked prices stay and the customer sees nothing wrong.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4, Vitest, Playwright, `exceljs` (offline build script), `sharp` (offline image pipeline), `zod`, `qrcode`.

**Spec:** `docs/superpowers/specs/2026-09-06-crown-club-qr-menu-design.md`

## Global Constraints

- **Package manager: npm.** Development is on Windows 11; do not introduce pnpm or yarn.
- **Node 24+** (v24.18.0 is installed).
- **TypeScript is pinned to `^5.9.3`. Do not un-pin it and do not run `npm install typescript@latest`.** Bare `npm i -D typescript` resolves to 7.x, which drops the `ts.sys` API that Next 15's `next.config.ts` loader calls — `npm run build` then fails outright. Discovered in Task 1.
- **No AI/Claude attribution** in commits, code comments, docs, or PR text. Write commits as a human teammate would. This overrides any default harness behaviour.
- **Two currencies: IQD and USD.** A price is `{ currency, value }`, never a bare number. IQD values are whole dinars.
- **Price rule for IQD (validated against both data sources, zero disagreements):** strip `iqd`/whitespace/case, strip non-numerics, and **if the result is under 1000, multiply by 1000**.
- **Dollar prices stay in dollars.** `200$` is $200. The sub-1000 rule applies to IQD only, and no conversion ever happens — not at build time, not at runtime.
- **Display:** IQD as a bare grouped number (`15,000`) with one "prices in IQD unless marked" note on the page; USD always with the symbol (`$200`).
- **Product names are never translated and never case-normalised.** They render exactly as stored, so some are upper-case and some are not. Tests match them case-insensitively. Only UI strings and category names have `ar`/`ckb` variants.
- **Locales: exactly `en`, `ar`, `ckb`.** `ar` and `ckb` are RTL.
- **Brand colours:** saffron `#D9A353`, ink `#0C0A0B`, cream `#F2E9DC`, muted `#A6968A`.
- **The string "Amber & Oak" must not appear anywhere in the output.** It is leftover template metadata from the old site.
- **Source assets are already committed** and must not be re-downloaded: `assets/original-images/` (88 photos + `Crown-logo2.png`), `assets/source-menu.xlsx`, `assets/old-sheet-snapshot.csv`.
- **Sanity guard threshold: 50 items.** A live payload below this is rejected.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/price.ts` | Pure. Parse any observed price string; format for display. |
| `src/lib/menu-schema.ts` | Pure. `Category`, `MenuItem`, zod schemas. |
| `src/lib/merge.ts` | Pure. Reconcile Excel rows + sheet rows into `MenuItem[]`. |
| `src/lib/sheet.ts` | Fetch + parse gviz CSV; sanity guard. |
| `src/lib/slug.ts` | Pure. Shared slugifier used by ids, image paths, and the image map. |
| `src/data/menu.json` | Generated, committed. The baked menu. |
| `src/i18n/config.ts` | Locale list, RTL predicate. |
| `src/i18n/dictionaries/{en,ar,ckb}.json` | UI strings + category names. |
| `src/i18n/get-dictionary.ts` | Typed dictionary loader. |
| `src/app/layout.tsx` | Root shell, fonts. |
| `src/app/page.tsx` | Redirect `/` to a locale. |
| `src/app/[lang]/layout.tsx` | Per-locale `<html lang dir>`, metadata. |
| `src/app/[lang]/page.tsx` | Server component; reads `menu.json`, renders. |
| `src/app/api/menu/route.ts` | Edge-cached sheet proxy. |
| `src/components/Hero.tsx` | Server. Logo, tagline, language switch slot. |
| `src/components/MenuBrowser.tsx` | Client. Search, category chips, live refresh. |
| `src/components/MenuSection.tsx` | Client. One category heading + its items. |
| `src/components/ItemCard.tsx` | Client. Photo, name, glass/bottle prices, sold-out. |
| `src/components/PhotoSheet.tsx` | Client. Full-size bottle photo. |
| `src/components/ContactSheet.tsx` | Client. Instagram / WhatsApp / phone. |
| `src/components/LanguageSwitch.tsx` | Client. en / ar / ckb. |
| `scripts/build-image-map.ts` | Offline. Item id to source photo, written for human review. |
| `scripts/optimize-images.ts` | Offline. sharp to WebP at 400px + 800px. |
| `scripts/build-menu.ts` | Offline. xlsx + csv to `src/data/menu.json`. |
| `scripts/make-qr.ts` | Offline. Print-ready QR, PNG + SVG. |
| `scripts/make-client-xlsx.ts` | Offline. The clean spreadsheet deliverable. |

`price.ts`, `slug.ts`, `merge.ts`, and `menu-schema.ts` have no I/O. That is what makes the money-handling logic testable without mocks.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/slug.ts`
- Test: `src/lib/slug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `slugify(input: string): string` from `src/lib/slug.ts`. Every later task uses this for ids and file paths.

- [ ] **Step 1: Create the Next.js project in place**

The repo already contains `assets/`, `docs/`, and `.gitignore`. Scaffold without clobbering them:

```bash
npm init -y
npm install next@15 react@19 react-dom@19
npm install -D typescript @types/node @types/react @types/react-dom \
  tailwindcss@4 @tailwindcss/postcss vitest @vitejs/plugin-react \
  jsdom @testing-library/react @testing-library/jest-dom tsx
```

- [ ] **Step 2: Write the config files**

`package.json` scripts block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:menu": "tsx scripts/build-menu.ts",
    "build:images": "tsx scripts/optimize-images.ts",
    "build:imagemap": "tsx scripts/build-image-map.ts",
    "make:qr": "tsx scripts/make-qr.ts",
    "make:xlsx": "tsx scripts/make-client-xlsx.ts"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/webp"] },
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
  // process.cwd(), not __dirname — this config may be loaded as ESM,
  // where __dirname does not exist.
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});
```

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-ink: #0c0a0b;
  --color-panel: #1e1719;
  --color-saffron: #d9a353;
  --color-saffron-ink: #241505;
  --color-cream: #f2e9dc;
  --color-muted: #a6968a;

  /* The "-loaded" variables come from next/font in the locale layout
     (Task 7). Binding them here is what actually makes the fonts apply —
     declaring them in next/font alone does nothing. */
  --font-display: var(--font-display-loaded), "Bricolage Grotesque", sans-serif;
  --font-body: var(--font-body-loaded), "Manrope", system-ui, sans-serif;
  --font-arabic: var(--font-arabic-loaded), "Noto Kufi Arabic", sans-serif;
}

body {
  background: var(--color-ink);
  color: var(--color-cream);
  font-family: var(--font-body);
}

h1,
h2 {
  font-family: var(--font-display);
}

/* Arabic and Kurdish are both Arabic script — one face for the whole
   document, headings included. */
[dir="rtl"] body,
[dir="rtl"] h1,
[dir="rtl"] h2 {
  font-family: var(--font-arabic);
}
```

- [ ] **Step 3: Write the failing test for the slugifier**

The slugifier is shared by item ids, image filenames, and the image map, so a mismatch between them is a whole class of bug. Test it first.

`src/lib/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Johnnie Walker")).toBe("johnnie-walker");
  });

  it("strips leading list numbering from the source spreadsheet", () => {
    expect(slugify("1.     Hennessy Cognac V.S")).toBe("hennessy-cognac-v-s");
  });

  it("collapses runs of punctuation and whitespace into one hyphen", () => {
    expect(slugify("Pepsi - 7up  - Merinda")).toBe("pepsi-7up-merinda");
  });

  it("handles ampersands", () => {
    expect(slugify("B&G Sauvignon Blanc")).toBe("b-g-sauvignon-blanc");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Ouzo gold 7y  ")).toBe("ouzo-gold-7y");
  });

  it("returns an empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- src/lib/slug.test.ts`
Expected: FAIL — cannot resolve `./slug`.

- [ ] **Step 5: Implement the slugifier**

`src/lib/slug.ts`:

```ts
/** Lowercase, ASCII-hyphenated identifier. Used for item ids, image
 *  filenames, and image-map keys — all three must agree, so they all
 *  call this. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/lib/slug.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Add the minimal app shell so `next build` succeeds**

This is a **real** root layout with `<html>` and `<body>`. Next.js errors out
if the root layout renders neither. Task 7 demotes it to a pass-through once
`app/[lang]/layout.tsx` takes over the document element.

`src/app/layout.tsx`:

```tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Root() {
  redirect("/en");
}
```

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Tailwind, Vitest, and shared slugifier"
```

---

### Task 2: Price parsing and formatting

The spreadsheet writes prices five different ways. This module is the only place that knows about that.

**Files:**
- Create: `src/lib/money.ts`, `src/lib/price.ts`
- Test: `src/lib/price.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Money = { currency: "IQD" | "USD"; value: number }`
  - `type PriceParse = { kind: "iqd"; value: number } | { kind: "foreign"; currency: "USD"; value: number } | { kind: "none" }`
  - `parsePrice(input: unknown): PriceParse`
  - `toMoney(p: PriceParse): Money | null` — only `none` gives `null`
  - `formatMoney(m: Money): string` — `15,000` for IQD, `$200` for USD

- [ ] **Step 1: Write the failing tests**

`src/lib/price.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePrice, toMoney, formatMoney } from "./price";

describe("parsePrice", () => {
  it("reads a bare number below 1000 as thousands", () => {
    expect(parsePrice(10)).toEqual({ kind: "iqd", value: 10000 });
  });

  it("reads the 'Niqd' shorthand as thousands", () => {
    expect(parsePrice("10iqd")).toEqual({ kind: "iqd", value: 10000 });
    expect(parsePrice("10 iqd")).toEqual({ kind: "iqd", value: 10000 });
    expect(parsePrice("5iqd")).toEqual({ kind: "iqd", value: 5000 });
  });

  it("leaves values of 1000 and above alone", () => {
    expect(parsePrice(15000)).toEqual({ kind: "iqd", value: 15000 });
    expect(parsePrice("20000iqd")).toEqual({ kind: "iqd", value: 20000 });
    expect(parsePrice("25000 iqd")).toEqual({ kind: "iqd", value: 25000 });
    expect(parsePrice("150000")).toEqual({ kind: "iqd", value: 150000 });
  });

  it("treats 1000 itself as already-scaled (boundary)", () => {
    expect(parsePrice(1000)).toEqual({ kind: "iqd", value: 1000 });
  });

  it("treats 999 as needing the multiplier (boundary)", () => {
    expect(parsePrice(999)).toEqual({ kind: "iqd", value: 999000 });
  });

  it("keeps dollars as dollars and does not apply the thousands rule", () => {
    expect(parsePrice("200$")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("$200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("25$")).toEqual({ kind: "foreign", currency: "USD", value: 25 });
  });

  it("returns none for blank, null, and undefined", () => {
    expect(parsePrice("")).toEqual({ kind: "none" });
    expect(parsePrice("   ")).toEqual({ kind: "none" });
    expect(parsePrice(null)).toEqual({ kind: "none" });
    expect(parsePrice(undefined)).toEqual({ kind: "none" });
  });

  it("returns none for text with no digits", () => {
    expect(parsePrice("iqd")).toEqual({ kind: "none" });
    expect(parsePrice("ask staff")).toEqual({ kind: "none" });
  });

  it("rejects zero and negatives rather than returning a bad price", () => {
    expect(parsePrice(0)).toEqual({ kind: "none" });
    expect(parsePrice(-5)).toEqual({ kind: "none" });
    expect(parsePrice("-10iqd")).toEqual({ kind: "none" });
  });

  it("rejects NaN and Infinity", () => {
    expect(parsePrice(NaN)).toEqual({ kind: "none" });
    expect(parsePrice(Infinity)).toEqual({ kind: "none" });
  });

  it("returns whole dinars, never fractions", () => {
    expect(parsePrice(12.4)).toEqual({ kind: "iqd", value: 12400 });
    expect(parsePrice(15000.7)).toEqual({ kind: "iqd", value: 15001 });
  });
});

describe("toMoney", () => {
  it("tags IQD", () => {
    expect(toMoney({ kind: "iqd", value: 15000 })).toEqual({ currency: "IQD", value: 15000 });
  });

  it("keeps dollars as dollars rather than dropping them", () => {
    expect(toMoney({ kind: "foreign", currency: "USD", value: 200 })).toEqual({
      currency: "USD",
      value: 200,
    });
  });

  it("maps none to null", () => {
    expect(toMoney({ kind: "none" })).toBeNull();
  });
});

describe("formatMoney", () => {
  it("groups IQD thousands with commas and no symbol", () => {
    expect(formatMoney({ currency: "IQD", value: 15000 })).toBe("15,000");
    expect(formatMoney({ currency: "IQD", value: 175000 })).toBe("175,000");
  });

  it("marks dollars with a symbol so the exception is obvious", () => {
    expect(formatMoney({ currency: "USD", value: 200 })).toBe("$200");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/price.test.ts`
Expected: FAIL — cannot resolve `./price`.

- [ ] **Step 3: Implement**

Install zod now, since the money schema needs it:

```bash
npm install zod
```

`src/lib/money.ts` — the single definition of a price, imported by everything else:

```ts
import { z } from "zod";

export const CURRENCIES = ["IQD", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const moneySchema = z.object({
  currency: z.enum(CURRENCIES),
  value: z.number().positive(),
});

export type Money = z.infer<typeof moneySchema>;
```

`src/lib/price.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/price.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/price.ts src/lib/price.test.ts package.json package-lock.json
git commit -m "Add money type and price parsing with validated thousands rule"
```

---

### Task 3: Menu schema and source reconciliation

**Files:**
- Create: `src/lib/menu-schema.ts`, `src/lib/merge.ts`
- Test: `src/lib/merge.test.ts`

**Interfaces:**
- Consumes: `slugify` (Task 1); `parsePrice`, `toMoney`, `Money` (Task 2).
- Produces:
  - `CATEGORIES: readonly Category[]` and `type Category`
  - `interface MenuItem { id: string; name: string; category: Category; glass: Money | null; bottle: Money | null; available: boolean; image: string | null; tags: string[] }`
  - `menuItemSchema`, `menuPayloadSchema` (zod)
  - `interface SourceRow { category: string; name: string; glass?: unknown; bottle?: unknown; available?: string }`
  - `mergeMenu(excel: SourceRow[], sheet: SourceRow[]): MenuItem[]`
  - `normaliseCategory(raw: string): Category | null`

- [ ] **Step 1: Write the schema module**

`src/lib/menu-schema.ts`:

```ts
import { z } from "zod";
import { moneySchema } from "./money";

export const CATEGORIES = [
  "Cocktails",
  "Soft Drinks",
  "Beer",
  "Arak",
  "Cognac",
  "Gin",
  "Rum",
  "Liqueur",
  "Tequila",
  "Vodka",
  "Whisky",
  "Red Wine",
  "White Wine",
  "Rose Wine",
  "Sparkling Wine",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Every spelling of a category seen across the client's Excel and the
 *  previous developer's sheet, mapped to our canonical name. */
const CATEGORY_ALIASES: Record<string, Category> = {
  cocktail: "Cocktails",
  cocktails: "Cocktails",
  "water soft": "Soft Drinks",
  "soft drinks": "Soft Drinks",
  soft: "Soft Drinks",
  beer: "Beer",
  arak: "Arak",
  cognac: "Cognac",
  "g i n": "Gin",
  gin: "Gin",
  rum: "Rum",
  liquir: "Liqueur",
  liqueur: "Liqueur",
  liquor: "Liqueur",
  tequila: "Tequila",
  vodka: "Vodka",
  whisky: "Whisky",
  whiskey: "Whisky",
  wine: "Red Wine",
  "red wine": "Red Wine",
  white: "White Wine",
  "white wine": "White Wine",
  rose: "Rose Wine",
  "rose wine": "Rose Wine",
  "sparkling wine": "Sparkling Wine",
};

export function normaliseCategory(raw: string): Category | null {
  const key = raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return CATEGORY_ALIASES[key] ?? null;
}

export const menuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  glass: moneySchema.nullable(),
  bottle: moneySchema.nullable(),
  available: z.boolean(),
  image: z.string().nullable(),
  tags: z.array(z.string()),
});

export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuPayloadSchema = z.object({
  generatedAt: z.string(),
  items: z.array(menuItemSchema),
});

export type MenuPayload = z.infer<typeof menuPayloadSchema>;

export interface SourceRow {
  category: string;
  name: string;
  glass?: unknown;
  bottle?: unknown;
  available?: string;
}
```

- [ ] **Step 2: Write the failing tests for the merge**

These encode the reconciliation decisions from the spec. Each test is a decision the client signed off on.

`src/lib/merge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeMenu } from "./merge";
import { normaliseCategory } from "./menu-schema";
import type { SourceRow } from "./menu-schema";

const excel = (over: Partial<SourceRow>): SourceRow => ({
  category: "whisky",
  name: "JACK DANIELS",
  glass: "10iqd",
  bottle: 160000,
  ...over,
});

describe("normaliseCategory", () => {
  it("maps the Excel headings to canonical names", () => {
    expect(normaliseCategory("WATER & SOFT")).toBe("Soft Drinks");
    expect(normaliseCategory("G I N")).toBe("Gin");
    expect(normaliseCategory("LIQUIR")).toBe("Liqueur");
    expect(normaliseCategory("WINE")).toBe("Red Wine");
    expect(normaliseCategory("WHITE")).toBe("White Wine");
  });

  it("maps the sheet's spellings to the same names", () => {
    expect(normaliseCategory("Cocktail")).toBe("Cocktails");
    expect(normaliseCategory("WHITE WINE")).toBe("White Wine");
    expect(normaliseCategory("sparkling WINE")).toBe("Sparkling Wine");
  });

  it("returns null for anything unrecognised", () => {
    expect(normaliseCategory("Desserts")).toBeNull();
  });
});

describe("mergeMenu", () => {
  it("keeps the Excel price when both sources have the item", () => {
    const out = mergeMenu(
      [excel({ glass: "15iqd" })],
      [{ category: "whisky", name: "Jack Daniels", glass: "10000" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].glass).toEqual({ currency: "IQD", value: 15000 });
  });

  it("carries the bottle price, which only the Excel has", () => {
    const out = mergeMenu([excel({ bottle: 160000 })], []);
    expect(out[0].bottle).toEqual({ currency: "IQD", value: 160000 });
  });

  it("fills a missing Excel glass price from the sheet", () => {
    const out = mergeMenu(
      [excel({ category: "Vodka", name: "Finlandia", glass: "", bottle: "" })],
      [{ category: "Vodka", name: "Finlandia", glass: "10000" }],
    );
    expect(out[0].glass).toEqual({ currency: "IQD", value: 10000 });
  });

  it("keeps sheet-only cocktails, which the Excel omits entirely", () => {
    const out = mergeMenu(
      [],
      [{ category: "Cocktail", name: "Crown Signature", glass: "20000" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("Cocktails");
    expect(out[0].glass).toEqual({ currency: "IQD", value: 20000 });
    expect(out[0].bottle).toBeNull();
  });

  it("collapses the Bushmills Black spelling variants into one item", () => {
    const out = mergeMenu(
      [excel({ name: "BUSHMILLS BLACK", glass: "10iqd", bottle: 150000 })],
      [{ category: "whisky", name: "Bushmils BLACK", glass: "10000" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].bottle).toEqual({ currency: "IQD", value: 150000 });
  });

  it("collapses the Gordons Gin spelling variants into one item", () => {
    const out = mergeMenu(
      [excel({ category: "G I N", name: "Gordons Gin", glass: "15000", bottle: 100000 })],
      [{ category: "GIN", name: "Gordons Gin - Regular", glass: "15000" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].bottle).toEqual({ currency: "IQD", value: 100000 });
  });

  it("keeps a dollar bottle price in dollars", () => {
    const out = mergeMenu(
      [excel({ category: "Tequila", name: "patron silver", glass: "15iqd", bottle: "200$" })],
      [],
    );
    expect(out[0].bottle).toEqual({ currency: "USD", value: 200 });
    expect(out[0].glass).toEqual({ currency: "IQD", value: 15000 });
  });

  it("does not let the thousands rule touch a dollar figure", () => {
    const out = mergeMenu(
      [excel({ category: "Tequila", name: "patron gold", glass: "", bottle: "200$" })],
      [],
    );
    expect(out[0].bottle).toEqual({ currency: "USD", value: 200 });
  });

  it("marks an item unavailable when the sheet says no", () => {
    const out = mergeMenu(
      [excel({ name: "Corona", category: "beer", glass: "10iqd", bottle: "" })],
      [{ category: "Beer", name: "Corona", glass: "10000", available: "no" }],
    );
    expect(out[0].available).toBe(false);
  });

  it("defaults to available when the sheet leaves the flag blank", () => {
    const out = mergeMenu([excel({})], []);
    expect(out[0].available).toBe(true);
  });

  it("drops rows whose category is not recognised", () => {
    const out = mergeMenu([excel({ category: "Desserts", name: "Baklava" })], []);
    expect(out).toHaveLength(0);
  });

  it("drops rows with no name", () => {
    const out = mergeMenu([excel({ name: "   " })], []);
    expect(out).toHaveLength(0);
  });

  it("gives every item a stable, unique id", () => {
    const out = mergeMenu(
      [
        excel({ name: "JACK DANIELS" }),
        excel({ name: "JACK DANIELS HONEY" }),
      ],
      [],
    );
    expect(out.map((i) => i.id)).toEqual([
      "whisky__jack-daniels",
      "whisky__jack-daniels-honey",
    ]);
  });

  it("orders items by the canonical category order, not source order", () => {
    const out = mergeMenu(
      [
        excel({ category: "whisky", name: "JACK DANIELS" }),
        excel({ category: "beer", name: "Corona", bottle: "" }),
      ],
      [{ category: "Cocktail", name: "Mojito classic", glass: "15000" }],
    );
    expect(out.map((i) => i.category)).toEqual(["Cocktails", "Beer", "Whisky"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/lib/merge.test.ts`
Expected: FAIL — cannot resolve `./merge`.

- [ ] **Step 4: Implement the merge**

`src/lib/merge.ts`:

```ts
import { slugify } from "./slug";
import { parsePrice, toMoney } from "./price";
import type { Money } from "./money";
import {
  CATEGORIES,
  normaliseCategory,
  type Category,
  type MenuItem,
  type SourceRow,
} from "./menu-schema";

/** Same drink, spelled differently across the two sources. Left side is
 *  the slug we normalise to; right side is every alias seen in the data. */
const NAME_ALIASES: Record<string, string> = {
  "bushmils-black": "bushmills-black",
  "gordons-gin-regular": "gordons-gin",
};

function keyOf(name: string): string {
  const slug = slugify(name);
  return NAME_ALIASES[slug] ?? slug;
}

interface Draft {
  key: string;
  name: string;
  category: Category;
  glass: Money | null;
  bottle: Money | null;
  available: boolean;
}

function toDraft(row: SourceRow): Draft | null {
  const name = (row.name ?? "").trim();
  if (!name) return null;

  const category = normaliseCategory(row.category ?? "");
  if (!category) return null;

  return {
    key: keyOf(name),
    name,
    category,
    glass: toMoney(parsePrice(row.glass)),
    bottle: toMoney(parsePrice(row.bottle)),
    available: (row.available ?? "").trim().toLowerCase() !== "no",
  };
}

/**
 * Reconcile the client's Excel against the previous developer's sheet.
 *
 * The Excel is newer and is the only source with bottle prices, so it wins
 * on price and on the display name. The sheet contributes items the Excel
 * omits (the cocktails), fills glass prices the Excel left blank, and is the
 * only source of the availability flag.
 */
export function mergeMenu(excel: SourceRow[], sheet: SourceRow[]): MenuItem[] {
  const byKey = new Map<string, Draft>();

  for (const row of excel) {
    const draft = toDraft(row);
    if (draft) byKey.set(draft.key, draft);
  }

  for (const row of sheet) {
    const draft = toDraft(row);
    if (!draft) continue;

    const existing = byKey.get(draft.key);
    if (!existing) {
      byKey.set(draft.key, draft);
      continue;
    }

    // Excel wins on price; the sheet only fills gaps and sets availability.
    existing.glass ??= draft.glass;
    existing.bottle ??= draft.bottle;
    existing.available = draft.available;
  }

  const order = new Map(CATEGORIES.map((c, i) => [c, i]));

  return [...byKey.values()]
    .sort((a, b) => {
      const byCat = order.get(a.category)! - order.get(b.category)!;
      return byCat !== 0 ? byCat : a.name.localeCompare(b.name, "en");
    })
    .map((d) => ({
      id: `${slugify(d.category)}__${d.key}`,
      name: d.name,
      category: d.category,
      glass: d.glass,
      bottle: d.bottle,
      available: d.available,
      image: null, // filled in by the build script from the image map
      tags: [],
    }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/merge.test.ts`
Expected: PASS, all tests.

Note: the `id` ordering test expects source order within a category to be replaced by alphabetical order. If `jack-daniels-honey` sorts before `jack-daniels`, fix the test expectation, not the sort — alphabetical is the intended behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/lib/menu-schema.ts src/lib/merge.ts src/lib/merge.test.ts package.json package-lock.json
git commit -m "Add menu schema and Excel/sheet reconciliation"
```

---

### Task 4: Generate the baked menu

**Files:**
- Create: `scripts/build-menu.ts`, `src/data/menu.json` (generated)
- Test: `src/data/menu.test.ts`

**Interfaces:**
- Consumes: `mergeMenu`, `menuPayloadSchema` (Task 3).
- Produces: `src/data/menu.json` conforming to `MenuPayload`, committed to the repo.

- [ ] **Step 1: Install the spreadsheet reader**

```bash
npm install -D exceljs
```

- [ ] **Step 2: Write the build script**

The Excel has no header row — category names sit in column A on their own line, with items beneath. `scripts/build-menu.ts`:

```ts
import ExcelJS from "exceljs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { mergeMenu } from "../src/lib/merge";
import { normaliseCategory, menuPayloadSchema } from "../src/lib/menu-schema";
import type { SourceRow } from "../src/lib/menu-schema";

const ROOT = process.cwd();
const XLSX = path.join(ROOT, "assets/source-menu.xlsx");
const CSV = path.join(ROOT, "assets/old-sheet-snapshot.csv");
const IMAGE_MAP = path.join(ROOT, "assets/image-map.json");
const OUT = path.join(ROOT, "src/data/menu.json");

/** Column A holds either a category heading (nothing in B or C) or an item. */
async function readExcel(): Promise<SourceRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.worksheets[0];
  const rows: SourceRow[] = [];
  let category = "";

  ws.eachRow((row) => {
    const name = String(row.getCell(1).value ?? "").trim();
    if (!name) return;

    const glass = row.getCell(2).value;
    const bottle = row.getCell(3).value;
    const isHeading = !glass && !bottle && normaliseCategory(name) !== null;

    if (isHeading) {
      category = name;
      return;
    }
    if (!category) return;

    rows.push({ category, name, glass, bottle });
  });

  return rows;
}

/** Minimal RFC4180 reader — the snapshot is fully quoted. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((f) => f.trim()));
}

export function rowsFromCsv(text: string): SourceRow[] {
  const [header, ...body] = parseCsv(text);
  const idx = (n: string) => header.findIndex((h) => h.trim().toLowerCase() === n);
  const iCat = idx("category");
  const iName = idx("name");
  const iPrice = idx("price");
  const iAvail = idx("available");

  return body.map((r) => ({
    category: r[iCat] ?? "",
    name: r[iName] ?? "",
    glass: r[iPrice] ?? "",
    available: iAvail >= 0 ? r[iAvail] : "",
  }));
}

async function main() {
  const excelRows = await readExcel();
  const sheetRows = rowsFromCsv(await readFile(CSV, "utf8"));
  const items = mergeMenu(excelRows, sheetRows);

  let imageMap: Record<string, string> = {};
  try {
    imageMap = JSON.parse(await readFile(IMAGE_MAP, "utf8"));
  } catch {
    console.warn("No image-map.json yet — items will have no photos.");
  }

  const withImages = items.map((i) => ({ ...i, image: imageMap[i.id] ?? null }));
  const payload = { generatedAt: new Date().toISOString(), items: withImages };

  menuPayloadSchema.parse(payload);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const noPhoto = withImages.filter((i) => !i.image);
  const noPrice = withImages.filter((i) => !i.glass && !i.bottle);
  console.log(`Wrote ${withImages.length} items to src/data/menu.json`);
  console.log(`  without a photo: ${noPhoto.length}`, noPhoto.map((i) => i.name));
  console.log(`  without any price: ${noPrice.length}`, noPrice.map((i) => i.name));
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the build script**

Run: `npm run build:menu`
Expected: writes `src/data/menu.json`. Roughly 89 items. It will warn that there is no image map yet — that is Task 5.

- [ ] **Step 4: Write the data regression test**

This locks in the reconciliation the client approved, so a future edit to `merge.ts` cannot silently change prices.

`src/data/menu.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import menu from "./menu.json";
import { menuPayloadSchema, CATEGORIES } from "@/lib/menu-schema";

describe("baked menu.json", () => {
  it("matches the schema", () => {
    expect(() => menuPayloadSchema.parse(menu)).not.toThrow();
  });

  it("has a plausible number of items", () => {
    expect(menu.items.length).toBeGreaterThanOrEqual(85);
  });

  it("has unique ids", () => {
    const ids = menu.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only canonical categories", () => {
    for (const item of menu.items) {
      expect(CATEGORIES).toContain(item.category);
    }
  });

  it("never has a zero or negative price", () => {
    for (const item of menu.items) {
      if (item.glass !== null) expect(item.glass.value).toBeGreaterThan(0);
      if (item.bottle !== null) expect(item.bottle.value).toBeGreaterThan(0);
    }
  });

  it("prices everything in IQD except the known dollar items", () => {
    const usd = menu.items.filter(
      (i) => i.glass?.currency === "USD" || i.bottle?.currency === "USD",
    );
    expect(usd.map((i) => i.name.toLowerCase())).toEqual(["patron silver"]);
  });

  it("keeps the twelve cocktails from the sheet", () => {
    const cocktails = menu.items.filter((i) => i.category === "Cocktails");
    expect(cocktails).toHaveLength(12);
    expect(cocktails.map((c) => c.name)).toContain("Crown Signature");
  });

  it("keeps the Excel-only additions", () => {
    const names = menu.items.map((i) => i.name.toLowerCase());
    expect(names).toContain("miller");
    expect(names.some((n) => n.includes("captain morgan"))).toBe(true);
  });

  it("keeps Patron Silver's bottle in dollars rather than converting it", () => {
    const patron = menu.items.find((i) => i.name.toLowerCase().includes("patron silver"));
    expect(patron).toBeDefined();
    expect(patron!.bottle).toEqual({ currency: "USD", value: 200 });
    expect(patron!.glass).toEqual({ currency: "IQD", value: 15000 });
  });

  it("collapsed the spelling variants", () => {
    const bushmills = menu.items.filter((i) => i.name.toLowerCase().includes("black") && i.category === "Whisky");
    const names = bushmills.map((b) => b.name.toLowerCase());
    expect(names.filter((n) => n.includes("bushmi"))).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/data/menu.test.ts`
Expected: PASS. If the cocktail count is not 12 or an item is missing, fix `merge.ts` — do not weaken the test.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-menu.ts src/data/menu.json src/data/menu.test.ts package.json package-lock.json
git commit -m "Generate baked menu.json from the Excel and sheet snapshot"
```

---

### Task 5: Image map and WebP pipeline

**Files:**
- Create: `scripts/build-image-map.ts`, `scripts/optimize-images.ts`, `assets/image-map.json` (generated, reviewed by hand), `public/images/**` (generated)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `slugify` (Task 1), `src/data/menu.json` (Task 4).
- Produces: `assets/image-map.json` mapping `MenuItem.id` to a `/images/<category>/<item>.webp` path; `menu.json` regenerated with `image` populated.

- [ ] **Step 1: Install sharp**

```bash
npm install -D sharp
```

- [ ] **Step 2: Write the shared folder map**

Both scripts in this task need the same source-folder-to-category mapping. It
lives in one file so a folder added to one script cannot silently go missing
from the other — that failure mode produces no error, just drinks with no
photo.

`scripts/image-folders.ts`:

```ts
/** Photo folder name in assets/original-images -> our category slug. */
export const FOLDER_TO_CATEGORY: Record<string, string> = {
  Arak: "arak",
  Beer: "beer",
  Cocktails: "cocktails",
  Cognac: "cognac",
  Gin: "gin",
  Liquir: "liqueur",
  "Rose Wine": "rose-wine",
  Rum: "rum",
  Soft: "soft-drinks",
  "Sparkling Wine": "sparkling-wine",
  Tequila: "tequila",
  Vodka: "vodka",
  Whisky: "whisky",
  "White wine": "white-wine",
  Wine: "red-wine",
};
```

- [ ] **Step 3: Write the image-map builder**

Matching is done **once, offline, into a file a human can read and correct** — not at runtime. `scripts/build-image-map.ts`:

```ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { FOLDER_TO_CATEGORY } from "./image-folders";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets/original-images");
const OUT = path.join(ROOT, "assets/image-map.json");

const tokens = (s: string) => new Set(slugify(s).split("-").filter(Boolean));

function score(itemName: string, photoStem: string): number {
  const a = tokens(itemName);
  const b = tokens(photoStem);
  let shared = 0;
  for (const t of b) if (a.has(t)) shared++;
  return shared === 0 ? 0 : shared / Math.max(1, b.size);
}

async function main() {
  const menu = JSON.parse(await readFile(path.join(ROOT, "src/data/menu.json"), "utf8"));

  const photos: { category: string; stem: string; webp: string }[] = [];
  for (const folder of await readdir(SRC, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const category = FOLDER_TO_CATEGORY[folder.name];
    if (!category) { console.warn(`Unmapped photo folder: ${folder.name}`); continue; }
    for (const file of await readdir(path.join(SRC, folder.name))) {
      const stem = path.parse(file).name;
      photos.push({ category, stem, webp: `/images/${category}/${slugify(stem)}.webp` });
    }
  }

  const map: Record<string, string> = {};
  const unmatched: string[] = [];

  for (const item of menu.items) {
    const category = item.id.split("__")[0];
    let best: { webp: string; s: number } | null = null;
    for (const p of photos) {
      if (p.category !== category) continue;
      const s = score(item.name, p.stem);
      if (s > 0 && (!best || s > best.s)) best = { webp: p.webp, s };
    }
    if (best) map[item.id] = best.webp;
    else unmatched.push(`${item.category} / ${item.name}`);
  }

  await writeFile(OUT, JSON.stringify(map, null, 2) + "\n", "utf8");
  console.log(`Mapped ${Object.keys(map).length}/${menu.items.length} items.`);
  console.log("Unmatched (will use the category fallback):");
  for (const u of unmatched) console.log("  " + u);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Write the WebP converter**

`scripts/optimize-images.ts`:

```ts
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { slugify } from "../src/lib/slug";
import { FOLDER_TO_CATEGORY } from "./image-folders";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets/original-images");
const OUT = path.join(ROOT, "public/images");

async function main() {
  let count = 0;
  for (const folder of await readdir(SRC, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const category = FOLDER_TO_CATEGORY[folder.name];
    if (!category) continue;

    const destDir = path.join(OUT, category);
    await mkdir(destDir, { recursive: true });

    for (const file of await readdir(path.join(SRC, folder.name))) {
      const stem = slugify(path.parse(file).name);
      await sharp(path.join(SRC, folder.name, file))
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(destDir, `${stem}.webp`));
      count++;
    }
  }
  console.log(`Converted ${count} images into public/images/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

`next/image` generates the smaller responsive sizes at request time on Vercel, so one 800px source per drink is enough. The logo is copied separately in Task 7.

- [ ] **Step 5: Run both scripts, then regenerate the menu**

```bash
npm run build:images
npm run build:imagemap
npm run build:menu
```

Expected: `public/images/` holds ~88 WebP files well under 1 MB total; `assets/image-map.json` maps almost every item; `build:menu` now reports very few items without a photo.

- [ ] **Step 6: Review the unmatched list by hand**

Read the "Unmatched" output. Per the spec, **Miller is expected to have no photo**. If anything else is unmatched, add an explicit entry to `assets/image-map.json` by hand — the file exists precisely so a human can override the matcher. Re-run `npm run build:menu` after editing.

- [ ] **Step 7: Verify the photos landed on the right drinks**

Spot-check at least eight entries in `assets/image-map.json` against the
filenames in `public/images/` — `whisky__jack-daniels` must not point at a
Jameson bottle, `gin__gordons-gin` must not point at Tanqueray. Correct any
wrong entry by hand and re-run `npm run build:menu`.

There is no page to look at yet; the in-browser check happens in Task 8.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-image-map.ts scripts/optimize-images.ts assets/image-map.json \
        public/images src/data/menu.json package.json package-lock.json
git commit -m "Add image map and WebP pipeline for drink photos"
```

---

### Task 6: Locales and dictionaries

**Files:**
- Create: `src/i18n/config.ts`, `src/i18n/dictionaries/en.json`, `src/i18n/dictionaries/ar.json`, `src/i18n/dictionaries/ckb.json`, `src/i18n/get-dictionary.ts`
- Test: `src/i18n/dictionaries.test.ts`

**Interfaces:**
- Consumes: `Category` (Task 3).
- Produces:
  - `LOCALES: readonly ["en", "ar", "ckb"]`, `type Locale`, `DEFAULT_LOCALE`, `isRtl(l: Locale): boolean`, `isLocale(v: string): v is Locale`
  - `type Dictionary` and `getDictionary(l: Locale): Dictionary`

- [ ] **Step 1: Write the config**

`src/i18n/config.ts`:

```ts
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
```

- [ ] **Step 2: Write the three dictionaries**

`src/i18n/dictionaries/en.json`:

```json
{
  "tagline": "Craft pours, made to order",
  "eyebrow": "Cocktails & Bottles",
  "search": "Search the menu",
  "all": "All",
  "glass": "Glass",
  "bottle": "Bottle",
  "currency": "IQD",
  "priceNote": "All prices in IQD unless marked",
  "askStaff": "Ask staff",
  "soldOut": "Sold out",
  "noResults": "Nothing matches that search",
  "contact": "Find us",
  "contactSub": "For reservations and enquiries",
  "resultCount": "{count} drinks",
  "close": "Close",
  "categories": {
    "Cocktails": "Cocktails",
    "Soft Drinks": "Soft Drinks",
    "Beer": "Beer",
    "Arak": "Arak",
    "Cognac": "Cognac",
    "Gin": "Gin",
    "Rum": "Rum",
    "Liqueur": "Liqueur",
    "Tequila": "Tequila",
    "Vodka": "Vodka",
    "Whisky": "Whisky",
    "Red Wine": "Red Wine",
    "White Wine": "White Wine",
    "Rose Wine": "Rosé Wine",
    "Sparkling Wine": "Sparkling Wine"
  }
}
```

`src/i18n/dictionaries/ar.json`:

```json
{
  "tagline": "مشروبات تُحضّر عند الطلب",
  "eyebrow": "كوكتيلات وزجاجات",
  "search": "ابحث في القائمة",
  "all": "الكل",
  "glass": "كأس",
  "bottle": "زجاجة",
  "currency": "د.ع",
  "priceNote": "جميع الأسعار بالدينار العراقي ما لم يُذكر غير ذلك",
  "askStaff": "اسأل النادل",
  "soldOut": "غير متوفر",
  "noResults": "لا توجد نتائج مطابقة",
  "contact": "تواصل معنا",
  "contactSub": "للحجوزات والاستفسارات",
  "resultCount": "{count} مشروب",
  "close": "إغلاق",
  "categories": {
    "Cocktails": "كوكتيلات",
    "Soft Drinks": "مشروبات غازية",
    "Beer": "بيرة",
    "Arak": "عرق",
    "Cognac": "كونياك",
    "Gin": "جن",
    "Rum": "روم",
    "Liqueur": "ليكور",
    "Tequila": "تكيلا",
    "Vodka": "فودكا",
    "Whisky": "ويسكي",
    "Red Wine": "نبيذ أحمر",
    "White Wine": "نبيذ أبيض",
    "Rose Wine": "نبيذ وردي",
    "Sparkling Wine": "نبيذ فوار"
  }
}
```

`src/i18n/dictionaries/ckb.json`:

```json
{
  "tagline": "خواردنەوەی تایبەت، بە داواکاری",
  "eyebrow": "کۆکتێل و بۆتڵ",
  "search": "گەڕان لە مێنیو",
  "all": "هەموو",
  "glass": "پەرداخ",
  "bottle": "بۆتڵ",
  "currency": "د.ع",
  "priceNote": "هەموو نرخەکان بە دیناری عێراقییە مەگەر ئاماژەی پێ کرابێت",
  "askStaff": "پرسیار لە ستاف بکە",
  "soldOut": "تەواو بووە",
  "noResults": "هیچ ئەنجامێک نەدۆزرایەوە",
  "contact": "پەیوەندیمان پێوە بکە",
  "contactSub": "بۆ حەجزکردن و پرسیار",
  "resultCount": "{count} خواردنەوە",
  "close": "داخستن",
  "categories": {
    "Cocktails": "کۆکتێل",
    "Soft Drinks": "خواردنەوەی سارد",
    "Beer": "بیرە",
    "Arak": "عەرەق",
    "Cognac": "کۆنیاک",
    "Gin": "جین",
    "Rum": "ڕۆم",
    "Liqueur": "لیکۆر",
    "Tequila": "تیکیلا",
    "Vodka": "ڤۆدکا",
    "Whisky": "ویسکی",
    "Red Wine": "شەرابی سوور",
    "White Wine": "شەرابی سپی",
    "Rose Wine": "شەرابی ڕۆز",
    "Sparkling Wine": "شەرابی بلقدار"
  }
}
```

**The Kurdish copy must be checked by a native Sorani speaker before the QR codes go to print.** Flag this to the client; do not treat it as done.

- [ ] **Step 3: Write the loader**

`src/i18n/get-dictionary.ts`:

```ts
import en from "./dictionaries/en.json";
import ar from "./dictionaries/ar.json";
import ckb from "./dictionaries/ckb.json";
import type { Locale } from "./config";

export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar, ckb };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
```

`Dictionary` is derived from `en.json`, so TypeScript fails the build if `ar` or `ckb` drifts out of shape.

- [ ] **Step 4: Write the failing parity test**

`src/i18n/dictionaries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LOCALES, isRtl, isLocale } from "./config";
import { getDictionary } from "./get-dictionary";
import { CATEGORIES } from "@/lib/menu-schema";

describe("locales", () => {
  it("marks Arabic and Kurdish as right-to-left, English as not", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("ckb")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });

  it("recognises only the three supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});

describe("dictionaries", () => {
  const keys = Object.keys(getDictionary("en")).sort();

  for (const locale of LOCALES) {
    it(`${locale} has exactly the same top-level keys as en`, () => {
      expect(Object.keys(getDictionary(locale)).sort()).toEqual(keys);
    });

    it(`${locale} translates every category`, () => {
      const cats = getDictionary(locale).categories;
      for (const c of CATEGORIES) {
        expect(cats[c]).toBeTruthy();
      }
    });

    it(`${locale} has no empty strings`, () => {
      const dict = getDictionary(locale) as Record<string, unknown>;
      for (const [k, v] of Object.entries(dict)) {
        if (typeof v === "string") expect(v.trim(), k).not.toBe("");
      }
    });
  }

  it("keeps the count placeholder in every locale", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale).resultCount).toContain("{count}");
    }
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/i18n/dictionaries.test.ts`
Expected: PASS. A missing category in `ar` or `ckb` fails here rather than rendering blank on a customer's phone.

- [ ] **Step 6: Commit**

```bash
git add src/i18n
git commit -m "Add English, Arabic, and Kurdish dictionaries with parity tests"
```

---

### Task 7: Locale routing, fonts, and metadata

**Files:**
- Create: `src/app/[lang]/layout.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `public/crown-logo.svg` (copied from assets)

**Interfaces:**
- Consumes: `LOCALES`, `isRtl`, `getDictionary` (Task 6).
- Produces: prerendered `/en`, `/ar`, `/ckb`; `PageProps` shape `{ params: Promise<{ lang: Locale }> }` used by Task 8.

**Next.js 15 note:** `params` is a **Promise** and must be awaited. This is the single most common mistake when writing App Router code from Next 14 habits.

- [ ] **Step 1: Copy the logo into public**

```bash
mkdir -p public
cp assets/logo/crown-logo-cream.svg public/crown-logo.svg
```

Use the **cream** variant: it is vector, transparent, and already coloured
`#F2E9DC` for the dark background. Do not use `assets/original-images/Crown-logo2.png`
from the old site — that is a 296 KB raster with a black rectangle baked into
its background, which shows as a visible box on any non-black surface.

- [ ] **Step 2: Reduce the root layout to a pass-through**

Task 1 gave the root layout a real `<html>`/`<body>` so its build check could
pass. Now that `app/[lang]/layout.tsx` renders the document element — `lang`
and `dir` depend on the route, so it must — the root layout has to stop
rendering one, or there will be two nested `<html>` elements. Replace the file
entirely. `src/app/layout.tsx`:

```tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 3: Write the locale layout**

`src/app/[lang]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Manrope, Noto_Kufi_Arabic } from "next/font/google";
import { LOCALES, isLocale, isRtl, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import "../globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-display-loaded",
});
const body = Manrope({
  subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body-loaded",
});
const arabic = Noto_Kufi_Arabic({
  subsets: ["arabic"], weight: ["400", "600", "700"], variable: "--font-arabic-loaded",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
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

export const viewport = { themeColor: "#0C0A0B" };

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
      <body className="bg-ink text-cream min-h-screen pb-16 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Point the root at a locale**

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/i18n/config";

export default function Root() {
  redirect(`/${DEFAULT_LOCALE}`);
}
```

- [ ] **Step 5: Add a placeholder page so the route builds**

`src/app/[lang]/page.tsx`:

```tsx
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <main className="p-8">Menu for {lang}</main>;
}
```

- [ ] **Step 6: Verify the three routes prerender**

Run: `npm run build`
Expected: the route summary lists `/en`, `/ar`, and `/ckb` as static (`●` or `○`), not dynamic.

Run: `npm run dev`, then check the served HTML directly:

```bash
curl -s http://localhost:3000/ar | grep -o 'dir="[a-z]*"'
```

Expected: `dir="rtl"` — present in the **server HTML**, before any JavaScript runs.

- [ ] **Step 7: Commit**

```bash
git add src/app public/crown-logo.svg
git commit -m "Add locale routing with server-rendered dir and lang"
```

---

### Task 8: Render the menu

**Files:**
- Create: `src/components/Hero.tsx`, `src/components/ItemCard.tsx`, `src/components/MenuSection.tsx`
- Modify: `src/app/[lang]/page.tsx`

**Interfaces:**
- Consumes: `MenuItem` (Task 3), `Dictionary` (Task 6), `formatMoney` and `Money` (Task 2).
- Produces:
  - `<ItemCard item={MenuItem} dict={Dictionary} onPhoto={(item: MenuItem) => void} />`
  - `<MenuSection category={Category} items={MenuItem[]} dict={Dictionary} onPhoto={...} />`
  - `<Hero dict={Dictionary} locale={Locale} />`

- [ ] **Step 1: Write the item card**

Prices are the whole point of the page, so they get the strongest typographic treatment after the name. `src/components/ItemCard.tsx`:

```tsx
"use client";

import Image from "next/image";
import { formatMoney } from "@/lib/price";
import type { Money } from "@/lib/money";
import type { MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

function Price({ label, value, ask }: { label: string; value: Money | null; ask: string }) {
  return (
    <div className="text-end">
      <div className="text-muted text-[0.62rem] uppercase tracking-[0.16em]">{label}</div>
      <div
        dir="ltr"
        className={
          value === null
            ? "text-muted text-xs italic"
            : "text-saffron font-semibold tabular-nums"
        }
      >
        {value === null ? ask : formatMoney(value)}
      </div>
    </div>
  );
}

export function ItemCard({
  item,
  dict,
  onPhoto,
}: {
  item: MenuItem;
  dict: Dictionary;
  onPhoto: (item: MenuItem) => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 border-b border-cream/10 py-3 ${
        item.available ? "" : "opacity-45"
      }`}
    >
      <button
        type="button"
        onClick={() => item.image && onPhoto(item)}
        disabled={!item.image}
        aria-label={item.name}
        className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-panel disabled:cursor-default"
      >
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <span className="text-saffron/50 grid size-full place-items-center text-lg">
            {item.name.charAt(0)}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.name}</p>
        {!item.available && (
          <span className="text-[0.62rem] uppercase tracking-[0.16em] text-muted">
            {dict.soldOut}
          </span>
        )}
      </div>

      <div className="flex shrink-0 gap-4">
        {item.glass !== null && <Price label={dict.glass} value={item.glass} ask={dict.askStaff} />}
        {(item.bottle !== null || item.glass === null) && (
          <Price label={dict.bottle} value={item.bottle} ask={dict.askStaff} />
        )}
      </div>
    </li>
  );
}
```

The price columns are deliberately conditional: a beer has no bottle-service price and should not show an empty column, but an item with **neither** price still shows one "Ask staff" cell rather than a blank row.

- [ ] **Step 2: Write the section**

`src/components/MenuSection.tsx`:

```tsx
"use client";

import { ItemCard } from "./ItemCard";
import type { Category, MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function MenuSection({
  category,
  items,
  dict,
  onPhoto,
}: {
  category: Category;
  items: MenuItem[];
  dict: Dictionary;
  onPhoto: (item: MenuItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section id={category} className="mb-8 scroll-mt-32">
      <h2 className="text-saffron mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
        {dict.categories[category]}
      </h2>
      <ul className="list-none p-0">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} dict={dict} onPhoto={onPhoto} />
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Write the hero**

`src/components/Hero.tsx`:

```tsx
import { LanguageSwitch } from "./LanguageSwitch";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <header className="px-4 pb-5 pt-8 text-center">
      <div className="mb-4 flex justify-center">
        <LanguageSwitch current={locale} />
      </div>
      <p className="text-saffron mb-3 text-[0.68rem] uppercase tracking-[0.2em]">
        {dict.eyebrow}
      </p>
      {/* A plain img, not next/image: the logo is vector, so there is
          nothing to optimise, and next/image refuses local SVGs unless
          `dangerouslyAllowSVG` is turned on. */}
      <img
        src="/crown-logo.svg"
        alt="Crown Club"
        width={180}
        height={133}
        className="mx-auto mb-3 h-auto w-[180px] max-w-[70%] object-contain"
      />
      <p className="text-muted text-sm">{dict.tagline}</p>
      <p className="text-muted/70 mt-2 text-[0.68rem]">{dict.priceNote}</p>
    </header>
  );
}
```

- [ ] **Step 4: Write a stub language switch so this compiles**

Task 12 replaces this. `src/components/LanguageSwitch.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

export function LanguageSwitch({ current }: { current: Locale }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <nav className="border-cream/15 inline-flex gap-1 rounded-full border p-1">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}`}
          aria-current={l === current ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-xs ${
            l === current ? "bg-saffron text-saffron-ink font-semibold" : "text-muted"
          }`}
        >
          {LOCALE_LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Render the real page**

`src/app/[lang]/page.tsx`:

```tsx
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
```

- [ ] **Step 6: Write a temporary MenuBrowser so the page renders**

Task 11 replaces this with search and live refresh. For now:

```tsx
"use client";

import { useState } from "react";
import { MenuSection } from "./MenuSection";
import { CATEGORIES, type MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function MenuBrowser({
  initialItems,
  dict,
}: {
  initialItems: MenuItem[];
  dict: Dictionary;
}) {
  const [items] = useState(initialItems);

  return (
    <main>
      {CATEGORIES.map((c) => (
        <MenuSection
          key={c}
          category={c}
          items={items.filter((i) => i.category === c)}
          dict={dict}
          onPhoto={() => {}}
        />
      ))}
    </main>
  );
}
```

- [ ] **Step 7: Verify it renders without JavaScript**

Run: `npm run build && npm start`

**Product names keep the exact casing they have in `src/data/menu.json`** — the
spec forbids transforming them, so several are upper-case (`JOHNNIE WALKER RED
LABEL`) while others are not (`Toma`). Read the real string out of the data
before asserting on it:

```bash
node -e "console.log(require('./src/data/menu.json').items.slice(0,5).map(i=>i.name))"
curl -s http://localhost:3000/en | grep -ci "johnnie walker"
```

Expected: a non-zero count. The drink names must be in the **server HTML**. If the count is 0, the menu is being rendered client-side only and the no-JS requirement is broken.

Also open `http://localhost:3000/ar` in a browser and confirm the layout
mirrors, prices sit on the correct side, and the drink photos are on the right
drinks (this is the in-browser check deferred from Task 5).

- [ ] **Step 8: Commit**

```bash
git add src/components src/app/[lang]/page.tsx
git commit -m "Render the menu server-side with glass and bottle prices"
```

---

### Task 9: Fetch and validate the live sheet

**Files:**
- Create: `src/lib/sheet.ts`
- Test: `src/lib/sheet.test.ts`

**Interfaces:**
- Consumes: `mergeMenu` (Task 3), `menuPayloadSchema` (Task 3).
- Produces:
  - `parseGvizCsv(text: string): SourceRow[]`
  - `isSanePayload(items: MenuItem[]): boolean`
  - `fetchLiveMenu(sheetId: string, gid?: string): Promise<MenuItem[] | null>` — `null` on any failure

- [ ] **Step 1: Write the failing tests**

The guard is the safety net for the whole live-refresh design, so it gets adversarial tests. `src/lib/sheet.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseGvizCsv, isSanePayload, fetchLiveMenu } from "./sheet";
import type { MenuItem } from "./menu-schema";

const item = (over: Partial<MenuItem> = {}): MenuItem => ({
  id: "whisky__x",
  name: "X",
  category: "Whisky",
  glass: { currency: "IQD", value: 10000 },
  bottle: null,
  available: true,
  image: null,
  tags: [],
  ...over,
});

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => item({ id: `whisky__x${i}`, name: `X${i}` }));

afterEach(() => vi.restoreAllMocks());

describe("parseGvizCsv", () => {
  it("reads quoted rows into source rows", () => {
    const csv =
      '"Category","Name","Description","Price","Bottle","Available","Tags"\n' +
      '"Beer","Corona","","10000","","yes",""\n';
    expect(parseGvizCsv(csv)).toEqual([
      { category: "Beer", name: "Corona", glass: "10000", bottle: "", available: "yes" },
    ]);
  });

  it("reads the Bottle column when the sheet has one", () => {
    const csv =
      '"Category","Name","Price","Bottle","Available"\n' +
      '"Whisky","Jack Daniels","10000","160000","yes"\n';
    expect(parseGvizCsv(csv)[0]).toEqual({
      category: "Whisky", name: "Jack Daniels",
      glass: "10000", bottle: "160000", available: "yes",
    });
  });

  it("tolerates a sheet with no Bottle column", () => {
    const csv = '"Category","Name","Price"\n' + '"Beer","Corona","10000"\n';
    expect(parseGvizCsv(csv)[0].bottle).toBe("");
  });

  it("keeps a dollar bottle price from the sheet in dollars", () => {
    const csv =
      '"Category","Name","Price","Bottle"\n' +
      '"Tequila","Patron Silver","15000","200$"\n';
    expect(parseGvizCsv(csv)[0].bottle).toBe("200$");
  });

  it("survives commas inside quoted fields", () => {
    const csv =
      '"Category","Name","Price"\n' + '"Soft Drinks","Pepsi, 7up","5000"\n';
    expect(parseGvizCsv(csv)[0].name).toBe("Pepsi, 7up");
  });

  it("returns an empty array for an empty document", () => {
    expect(parseGvizCsv("")).toEqual([]);
  });
});

describe("isSanePayload", () => {
  it("accepts a full menu", () => {
    expect(isSanePayload(many(60))).toBe(true);
  });

  it("rejects a suspiciously small menu", () => {
    expect(isSanePayload(many(49))).toBe(false);
  });

  it("rejects an empty menu", () => {
    expect(isSanePayload([])).toBe(false);
  });

  it("rejects a menu containing a non-positive price", () => {
    const zero = item({ id: "whisky__bad", glass: { currency: "IQD", value: 0 } });
    const neg = item({ id: "whisky__neg", glass: { currency: "IQD", value: -1 } });
    expect(isSanePayload([...many(60), zero])).toBe(false);
    expect(isSanePayload([...many(60), neg])).toBe(false);
  });

  it("accepts items with null prices, which mean 'ask staff'", () => {
    expect(isSanePayload([...many(60), item({ id: "whisky__ask", glass: null, bottle: null })])).toBe(true);
  });
});

describe("fetchLiveMenu", () => {
  it("returns null when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null when the sheet is emptied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '"Category","Name","Price"\n',
    }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null when Google serves an HTML error page instead of CSV", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => "<!DOCTYPE html><html>Sign in</html>",
    }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns items when the sheet is healthy", async () => {
    const header = '"Category","Name","Price","Available"\n';
    const rows = Array.from({ length: 60 }, (_, i) => `"Whisky","Item ${i}","10000","yes"`).join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => header + rows + "\n",
    }));
    const out = await fetchLiveMenu("abc");
    expect(out).not.toBeNull();
    expect(out!.length).toBe(60);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/sheet.test.ts`
Expected: FAIL — cannot resolve `./sheet`.

- [ ] **Step 3: Implement**

`src/lib/sheet.ts`:

```ts
import { mergeMenu } from "./merge";
import type { MenuItem, SourceRow } from "./menu-schema";

const MIN_ITEMS = 50;

function splitCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((f) => f.trim()));
}

export function parseGvizCsv(text: string): SourceRow[] {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iCat = header.indexOf("category");
  const iName = header.indexOf("name");
  const iPrice = header.indexOf("price");
  const iAvail = header.indexOf("available");
  if (iCat < 0 || iName < 0) return [];

  return rows.slice(1).map((r) => ({
    category: r[iCat] ?? "",
    name: r[iName] ?? "",
    glass: iPrice >= 0 ? (r[iPrice] ?? "") : "",
    available: iAvail >= 0 ? (r[iAvail] ?? "") : "",
  }));
}

/**
 * The last line of defence before live data replaces the baked menu.
 * A sheet that has been emptied, truncated, or had its sharing revoked
 * must never blank the customer's menu.
 */
export function isSanePayload(items: MenuItem[]): boolean {
  if (items.length < MIN_ITEMS) return false;
  return items.every(
    (i) =>
      i.name.trim() !== "" &&
      (i.glass === null || i.glass.value > 0) &&
      (i.bottle === null || i.bottle.value > 0),
  );
}

export async function fetchLiveMenu(
  sheetId: string,
  gid = "0",
): Promise<MenuItem[] | null> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:csv&gid=${gid}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const text = await res.text();
    // A revoked or moved sheet serves an HTML sign-in page with a 200.
    if (text.trimStart().startsWith("<")) return null;

    const items = mergeMenu([], parseGvizCsv(text));
    return isSanePayload(items) ? items : null;
  } catch {
    return null;
  }
}
```

Note `mergeMenu([], rows)` — the live sheet is passed as the *sheet* argument, so the same reconciliation and category normalisation apply to live data as to baked data. There is only one code path for turning rows into items.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/sheet.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheet.ts src/lib/sheet.test.ts
git commit -m "Add live sheet fetching with a sanity guard"
```

---

### Task 10: The edge-cached menu API

**Files:**
- Create: `src/app/api/menu/route.ts`, `.env.example`, `.env.local`
- Test: `src/app/api/menu/route.test.ts`

**Interfaces:**
- Consumes: `fetchLiveMenu` (Task 9).
- Produces: `GET /api/menu` returning `{ items: MenuItem[], source: "live" }` with 200, or `{ items: [], source: "baked" }` with 200 when live data is unusable. **Never a 5xx** — the client treats any non-`live` response as "keep what you have".

- [ ] **Step 1: Add the environment variable**

`.env.example`:

```
# Public, view-only Google Sheet holding the live menu.
# Columns: Category | Name | Description | Price | Image | Available | Tags
NEXT_PUBLIC_SHEET_ID=
SHEET_GID=0
```

`.env.local` — until the client supplies their own sheet, point at the snapshot's source so the path is exercised end to end:

```
NEXT_PUBLIC_SHEET_ID=1DOTlYqT6HOG4JJTJn1vctXDbuCZpLHY9iR3GmQze7Kw
SHEET_GID=0
```

Confirm `.env*.local` is already in `.gitignore` (it was added in the initial commit).

- [ ] **Step 2: Write the route**

`src/app/api/menu/route.ts`:

```ts
import { NextResponse } from "next/server";
import { fetchLiveMenu } from "@/lib/sheet";

export const revalidate = 60;

export async function GET() {
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;

  if (!sheetId) {
    return NextResponse.json({ items: [], source: "baked" as const });
  }

  const items = await fetchLiveMenu(sheetId, process.env.SHEET_GID ?? "0");

  if (!items) {
    return NextResponse.json({ items: [], source: "baked" as const });
  }

  return NextResponse.json(
    { items, source: "live" as const },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
```

`stale-while-revalidate=600` means a burst of scans on a busy night is served instantly from the edge while one background request refreshes it.

- [ ] **Step 3: Write the tests**

`src/app/api/menu/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/sheet", () => ({ fetchLiveMenu: vi.fn() }));

import { GET } from "./route";
import { fetchLiveMenu } from "@/lib/sheet";

const mocked = vi.mocked(fetchLiveMenu);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SHEET_ID", "sheet-123");
  mocked.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/menu", () => {
  it("reports 'baked' when no sheet is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHEET_ID", "");
    const body = await (await GET()).json();
    expect(body).toEqual({ items: [], source: "baked" });
  });

  it("reports 'baked' rather than erroring when the sheet is unusable", async () => {
    mocked.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("baked");
  });

  it("returns live items when the sheet is healthy", async () => {
    mocked.mockResolvedValue([
      { id: "beer__corona", name: "Corona", category: "Beer",
        glass: { currency: "IQD", value: 10000 },
        bottle: null, available: true, image: null, tags: [] },
    ]);
    const body = await (await GET()).json();
    expect(body.source).toBe("live");
    expect(body.items).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/app/api/menu/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify against the real sheet**

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3000/api/menu | head -c 300
```

Expected: `{"items":[...],"source":"live"}` with real drink names.

- [ ] **Step 6: Commit**

```bash
git add src/app/api .env.example
git commit -m "Add edge-cached menu API over the live sheet"
```

---

### Task 11: Search, category filter, and the live swap

**Files:**
- Modify: `src/components/MenuBrowser.tsx`
- Create: `src/components/SearchBar.tsx`, `src/components/CategoryChips.tsx`
- Test: `src/components/MenuBrowser.test.tsx`

**Interfaces:**
- Consumes: `MenuItem`, `CATEGORIES`, `Dictionary`, `GET /api/menu` (Task 10).
- Produces: the finished `<MenuBrowser initialItems dict />`.

**Merge rule for live data:** a live value may only ever *replace* a baked one, never *clear* it. The client's sheet does carry a Bottle column, so bottle prices are live-editable — but a blank or unparseable cell must fall back to the baked price rather than wiping it, and an item missing from the live payload entirely must survive untouched. Assigning `update.bottle` unconditionally would erase every bottle price the moment a row went blank. This is the most dangerous line in the task.

- [ ] **Step 1: Write the failing tests**

`src/components/MenuBrowser.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MenuBrowser } from "./MenuBrowser";
import { getDictionary } from "@/i18n/get-dictionary";
import type { MenuItem } from "@/lib/menu-schema";

const dict = getDictionary("en");

const iqd = (value: number) => ({ currency: "IQD" as const, value });

const items: MenuItem[] = [
  { id: "beer__corona", name: "Corona", category: "Beer",
    glass: iqd(10000), bottle: null, available: true, image: null, tags: [] },
  // Deliberately distinct from Corona's 10,000: getByText throws when two
  // elements carry the same text.
  { id: "whisky__jack-daniels", name: "Jack Daniels", category: "Whisky",
    glass: iqd(13000), bottle: iqd(160000), available: true, image: null, tags: [] },
  { id: "tequila__patron-silver", name: "Patron Silver", category: "Tequila",
    glass: iqd(15000), bottle: { currency: "USD", value: 200 },
    available: true, image: null, tags: [] },
];

afterEach(() => vi.restoreAllMocks());

describe("MenuBrowser", () => {
  it("shows every item initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.getByText("Jack Daniels")).toBeInTheDocument();
  });

  it("filters as you type, case-insensitively", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.type(screen.getByRole("searchbox"), "coro");
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.queryByText("Jack Daniels")).not.toBeInTheDocument();
  });

  it("shows a message when nothing matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText(dict.noResults)).toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.click(screen.getByRole("button", { name: "Beer" }));
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.queryByText("Jack Daniels")).not.toBeInTheDocument();
  });

  it("keeps baked prices when the API reports 'baked'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("10,000")).toBeInTheDocument());
    expect(screen.getByText("13,000")).toBeInTheDocument();
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("keeps baked prices when the API request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("Corona")).toBeInTheDocument());
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("applies a live glass price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "live",
        items: [{ id: "beer__corona", name: "Corona", category: "Beer", glass: iqd(12000),
                  bottle: null, available: true, image: null, tags: [] }],
      }),
    }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("12,000")).toBeInTheDocument());
  });

  it("shows a dollar bottle price with its symbol", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: "baked", items: [] }) }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    expect(screen.getByText("$200")).toBeInTheDocument();
  });

  it("never converts a dollar price when live data arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "live",
        items: [{ id: "tequila__patron-silver", name: "Patron Silver", category: "Tequila",
                  glass: iqd(16000), bottle: null, available: true, image: null, tags: [] }],
      }),
    }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("16,000")).toBeInTheDocument());
    expect(screen.getByText("$200")).toBeInTheDocument();
  });

  it("applies a live bottle price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "live",
        items: [{ id: "whisky__jack-daniels", name: "Jack Daniels", category: "Whisky",
                  glass: iqd(13000), bottle: iqd(180000), available: true, image: null, tags: [] }],
      }),
    }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("180,000")).toBeInTheDocument());
  });

  it("NEVER lets a live refresh erase a bottle price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "live",
        items: [{ id: "whisky__jack-daniels", name: "Jack Daniels", category: "Whisky",
                  glass: iqd(11000), bottle: null, available: true, image: null, tags: [] }],
      }),
    }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("11,000")).toBeInTheDocument());
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("does not drop baked items that are absent from the live payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "live",
        items: [{ id: "beer__corona", name: "Corona", category: "Beer", glass: iqd(12000),
                  bottle: null, available: true, image: null, tags: [] }],
      }),
    }));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("12,000")).toBeInTheDocument());
    expect(screen.getByText("Jack Daniels")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Install the interaction library**

```bash
npm install -D @testing-library/user-event
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/components/MenuBrowser.test.tsx`
Expected: FAIL — no searchbox, no chips.

- [ ] **Step 4: Write the search bar**

`src/components/SearchBar.tsx`:

```tsx
"use client";

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border-cream/15 bg-panel flex items-center gap-2 rounded-xl border px-3 py-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" className="text-muted size-4 shrink-0">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="text-cream placeholder:text-muted w-full bg-transparent outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 5: Write the category chips**

`src/components/CategoryChips.tsx`:

```tsx
"use client";

import { CATEGORIES, type Category } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function CategoryChips({
  present,
  active,
  onSelect,
  dict,
}: {
  present: Category[];
  active: Category | null;
  onSelect: (c: Category | null) => void;
  dict: Dictionary;
}) {
  const ordered = CATEGORIES.filter((c) => present.includes(c));

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs ${
          active === null ? "bg-saffron text-saffron-ink font-semibold" : "border-cream/15 text-muted border"
        }`}
      >
        {dict.all}
      </button>
      {ordered.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(active === c ? null : c)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${
            active === c ? "bg-saffron text-saffron-ink font-semibold" : "border-cream/15 text-muted border"
          }`}
        >
          {dict.categories[c]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write the real MenuBrowser**

`src/components/MenuBrowser.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuSection } from "./MenuSection";
import { SearchBar } from "./SearchBar";
import { CategoryChips } from "./CategoryChips";
import { PhotoSheet } from "./PhotoSheet";
import { CATEGORIES, type Category, type MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Fold live sheet values into the baked menu.
 *
 * A live value REPLACES a baked one; it never CLEARS one. `?? item.x` is
 * doing that work: a blank, deleted, or unparseable cell arrives as null and
 * leaves the baked price standing. An item absent from the live payload is
 * left entirely alone, so a partially-filled sheet cannot shrink the menu.
 *
 * Availability is the deliberate exception — it is a boolean the sheet owns
 * outright, and "no" has to be able to win.
 *
 * Currency travels inside the Money value, so a dollar price replaced by a
 * dinar one is a visible change rather than a silent tenfold error.
 */
function applyLive(baked: MenuItem[], live: MenuItem[]): MenuItem[] {
  const byId = new Map(live.map((i) => [i.id, i]));
  return baked.map((item) => {
    const update = byId.get(item.id);
    if (!update) return item;
    return {
      ...item,
      glass: update.glass ?? item.glass,
      bottle: update.bottle ?? item.bottle,
      available: update.available,
    };
  });
}

export function MenuBrowser({
  initialItems,
  dict,
}: {
  initialItems: MenuItem[];
  dict: Dictionary;
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Category | null>(null);
  const [photo, setPhoto] = useState<MenuItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/menu");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || data.source !== "live" || !Array.isArray(data.items)) return;
        setItems((current) => applyLive(current, data.items));
      } catch {
        // Offline or blocked. The baked menu is already on screen.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (active === null || i.category === active) &&
        (q === "" || i.name.toLowerCase().includes(q)),
    );
  }, [items, query, active]);

  const present = useMemo(
    () => CATEGORIES.filter((c) => items.some((i) => i.category === c)),
    [items],
  );

  return (
    <main>
      <div className="bg-ink/95 sticky top-0 z-10 py-2 backdrop-blur">
        <SearchBar value={query} onChange={setQuery} placeholder={dict.search} />
        <CategoryChips present={present} active={active} onSelect={setActive} dict={dict} />
      </div>

      {visible.length === 0 ? (
        <p className="text-muted py-12 text-center text-sm">{dict.noResults}</p>
      ) : (
        CATEGORIES.map((c) => (
          <MenuSection
            key={c}
            category={c}
            items={visible.filter((i) => i.category === c)}
            dict={dict}
            onPhoto={setPhoto}
          />
        ))
      )}

      <PhotoSheet item={photo} dict={dict} onClose={() => setPhoto(null)} />
    </main>
  );
}
```

- [ ] **Step 7: Add a minimal PhotoSheet so this compiles**

Task 12 finishes it. `src/components/PhotoSheet.tsx`:

```tsx
"use client";

import Image from "next/image";
import type { MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function PhotoSheet({
  item,
  dict,
  onClose,
}: {
  item: MenuItem | null;
  dict: Dictionary;
  onClose: () => void;
}) {
  if (!item?.image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6"
    >
      <div className="text-center">
        <Image src={item.image} alt={item.name} width={420} height={560}
               className="mx-auto h-auto w-full max-w-[320px] rounded-2xl object-contain" />
        <p className="mt-3 font-semibold">{item.name}</p>
        <button type="button" onClick={onClose} className="text-muted mt-4 text-xs underline">
          {dict.close}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/components/MenuBrowser.test.tsx`
Expected: PASS, all nine tests — especially "NEVER lets a live refresh erase a bottle price".

- [ ] **Step 9: Commit**

```bash
git add src/components package.json package-lock.json
git commit -m "Add search, category filter, and safe live price refresh"
```

---

### Task 12: Contact sheet and language persistence

**Files:**
- Create: `src/components/ContactSheet.tsx`, `src/lib/contact.ts`
- Modify: `src/components/Hero.tsx`, `src/components/LanguageSwitch.tsx`

**Interfaces:**
- Consumes: `Dictionary` (Task 6).
- Produces: `CONTACT` config in `src/lib/contact.ts`; `<ContactSheet dict />`.

- [ ] **Step 1: Write the contact config**

Carried over from the old site, with the "Amber & Oak" placeholders removed. `src/lib/contact.ts`:

```ts
export interface ContactLink {
  key: "instagram" | "whatsapp" | "phone-1" | "phone-2";
  label: string;
  /** Shown to the customer in the local 07xx form they recognise. */
  handle: string;
  /** Dialled/opened. Always the full international form — a 07xx tel: link
   *  fails for anyone roaming or calling from outside Iraq. */
  url: string;
}

export const CONTACT: { links: ContactLink[]; address: string; mapsUrl: string } = {
  address: "",
  mapsUrl: "",
  links: [
    {
      key: "instagram",
      label: "Instagram",
      handle: "@crownclub.erbil",
      url: "https://www.instagram.com/crownclub.erbil",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      handle: "0750 243 8339",
      url: "https://wa.me/9647502438339",
    },
    {
      key: "phone-1",
      label: "Call",
      handle: "0750 243 8339",
      url: "tel:+9647502438339",
    },
    {
      key: "phone-2",
      label: "Call",
      handle: "0775 833 8339",
      url: "tel:+9647758338339",
    },
  ],
};
```

Both numbers are **client-confirmed** (2026-09-06): 0750 243 8339 and
0775 833 8339, for reservations and enquiries.

The old site's Facebook entry pointed at bare `https://facebook.com/` and its
WhatsApp entry at bare `https://wa.me/` — neither reached Crown Club. Facebook
is dropped, and both numbers are now wired into working `tel:` and `wa.me`
URLs.

- [ ] **Step 2: Write the contact sheet**

`src/components/ContactSheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CONTACT } from "@/lib/contact";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ContactSheet({ dict }: { dict: Dictionary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-cream/15 text-muted rounded-full border px-4 py-1.5 text-xs"
      >
        {dict.contact}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dict.contact}
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-panel w-full rounded-t-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">{dict.contact}</h2>
            <p className="text-muted mb-4 text-sm">{dict.contactSub}</p>
            <ul className="list-none space-y-2 p-0">
              {CONTACT.links.map((l) => (
                <li key={l.key}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-cream/10 flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <span className="font-semibold">{l.label}</span>
                    <span className="text-muted text-sm" dir="ltr">{l.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted mt-4 w-full py-2 text-center text-xs underline"
            >
              {dict.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

`dir="ltr"` on the phone numbers is deliberate: a `+964 750...` number renders wrong inside an RTL paragraph without it.

- [ ] **Step 3: Put the contact button in the hero**

In `src/components/Hero.tsx`, change the top row to hold both controls:

```tsx
<div className="mb-4 flex items-center justify-between">
  <LanguageSwitch current={locale} />
  <ContactSheet dict={dict} />
</div>
```

Add `import { ContactSheet } from "./ContactSheet";` at the top.

- [ ] **Step 4: Persist the chosen language**

Append to `src/components/LanguageSwitch.tsx`, inside the component:

```tsx
  useEffect(() => {
    try {
      window.localStorage.setItem("crown.lang", current);
    } catch {
      // Private browsing. Not worth surfacing.
    }
  }, [current]);
```

Add `import { useEffect } from "react";` at the top.

- [ ] **Step 5: Verify by hand**

Run: `npm run dev`. On `/ar`:
- the contact sheet opens and the phone numbers read left-to-right,
- the language pills sit at the correct edge,
- switching to `ckb` keeps you on the menu.

- [ ] **Step 6: Commit**

```bash
git add src/components src/lib/contact.ts
git commit -m "Add contact sheet and remember the chosen language"
```

---

### Task 13: End-to-end smoke tests

**Files:**
- Create: `playwright.config.ts`, `e2e/menu.spec.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: the built app.
- Produces: `npm run test:e2e`.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Add to `.gitignore`:

```
/test-results
/playwright-report
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Write the config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000", ...devices["iPhone 13"] },
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

The mobile viewport is the real one — this menu is only ever opened by scanning a QR with a phone.

- [ ] **Step 3: Write the specs**

`e2e/menu.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Product names are NOT case-normalised (see Global Constraints), so these
// specs match case-insensitively rather than hard-coding a casing that the
// client may later change in their spreadsheet.
const JW = /johnnie walker red label/i;
const CORONA = /^corona$/i;

test("renders the menu with prices", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByText(JW)).toBeVisible();
  await expect(page.getByText("Glass").first()).toBeVisible();
});

test("Arabic is right-to-left in the server HTML", async ({ page }) => {
  const res = await page.goto("/ar");
  const html = await res!.text();
  expect(html).toContain('dir="rtl"');
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("Kurdish is right-to-left", async ({ page }) => {
  await page.goto("/ckb");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("all three languages are reachable from the switch", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await page.getByRole("link", { name: "کوردی" }).click();
  await expect(page).toHaveURL(/\/ckb$/);
});

test("search narrows the list", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("searchbox").fill("corona");
  await expect(page.getByText(CORONA)).toBeVisible();
  await expect(page.getByText(JW)).toBeHidden();
});

test("the menu still renders with the API unreachable", async ({ page }) => {
  await page.route("**/api/menu", (route) => route.abort());
  await page.goto("/en");
  await expect(page.getByText(JW)).toBeVisible();
});

test("no leftover template branding", async ({ page }) => {
  const res = await page.goto("/en");
  expect((await res!.text()).toLowerCase()).not.toContain("amber & oak");
});
```

- [ ] **Step 4: Run the suite**

Run: `npm run test:e2e`
Expected: all 7 pass. If a drink name in a test does not exist, check `src/data/menu.json` and use a real one — do not delete the assertion. Match names case-insensitively; do not "fix" the casing in the data.

- [ ] **Step 5: Run the whole test suite**

Run: `npm test && npm run test:e2e && npm run build`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e .gitignore package.json package-lock.json
git commit -m "Add end-to-end smoke tests across all three locales"
```

---

### Task 14: Client deliverables — QR code and clean spreadsheet

**Files:**
- Create: `scripts/make-qr.ts`, `scripts/make-client-xlsx.ts`, `deliverables/` (generated)

**Interfaces:**
- Consumes: `src/data/menu.json` (Task 4).
- Produces: `deliverables/crown-menu-qr.png`, `deliverables/crown-menu-qr.svg`, `deliverables/crown-menu.xlsx`.

**Do not run the QR script until the Vercel URL from Task 15 is final.** A QR code encoding the wrong URL is worthless once printed.

- [ ] **Step 1: Install the QR library**

```bash
npm install -D qrcode @types/qrcode
```

- [ ] **Step 2: Write the QR generator**

`scripts/make-qr.ts`:

```ts
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run make:qr -- https://your-menu-url");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "deliverables");

// High error correction so the code still scans with a scuffed or
// partly-covered table card.
const options = { errorCorrectionLevel: "H" as const, margin: 2, width: 2000 };

async function main() {
  await mkdir(OUT, { recursive: true });

  await QRCode.toFile(path.join(OUT, "crown-menu-qr.png"), url, {
    ...options,
    type: "png",
    color: { dark: "#0C0A0BFF", light: "#FFFFFFFF" },
  });

  const svg = await QRCode.toString(url, { ...options, type: "svg" });
  await writeFile(path.join(OUT, "crown-menu-qr.svg"), svg, "utf8");

  console.log(`QR written for ${url}`);
  console.log("  deliverables/crown-menu-qr.png  (2000px, raster)");
  console.log("  deliverables/crown-menu-qr.svg  (vector, for the printer)");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Black on white, not saffron on black — a low-contrast or inverted QR is the most common reason a printed code fails to scan.

- [ ] **Step 3: Write the spreadsheet generator**

`scripts/make-client-xlsx.ts`:

```ts
import ExcelJS from "exceljs";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "deliverables/crown-menu.xlsx");

/** Write IQD as a plain number so staff can edit it, and dollars in the
 *  `200$` form the parser already understands, so a round-trip through the
 *  sheet does not turn $200 into 200 dinars. */
function moneyCell(m: { currency: string; value: number } | null): string | number {
  if (!m) return "";
  return m.currency === "USD" ? `${m.value}$` : m.value;
}

async function main() {
  const menu = JSON.parse(await readFile(path.join(ROOT, "src/data/menu.json"), "utf8"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Menu");

  ws.columns = [
    { header: "Category", key: "category", width: 18 },
    { header: "Name", key: "name", width: 34 },
    { header: "Description", key: "description", width: 28 },
    { header: "Price", key: "glass", width: 12 },
    { header: "Bottle", key: "bottle", width: 12 },
    { header: "Available", key: "available", width: 11 },
    { header: "Tags", key: "tags", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const i of menu.items) {
    ws.addRow({
      category: i.category,
      name: i.name,
      description: "",
      glass: moneyCell(i.glass),
      bottle: moneyCell(i.bottle),
      available: i.available ? "yes" : "no",
      tags: i.tags.join(", "),
    });
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${menu.items.length} rows to deliverables/crown-menu.xlsx`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

The `Price` header is kept rather than renamed to `Glass`, because `src/lib/sheet.ts` reads a column called `Price`. Renaming it here would silently break the live refresh.

- [ ] **Step 4: Generate the spreadsheet**

Run: `npm run make:xlsx`
Expected: `deliverables/crown-menu.xlsx` with ~89 rows. Open it and confirm the headers and that prices are plain integers.

- [ ] **Step 5: Commit**

```bash
git add scripts/make-qr.ts scripts/make-client-xlsx.ts deliverables/crown-menu.xlsx \
        package.json package-lock.json
git commit -m "Add QR and client spreadsheet generators"
```

---

### Task 15: Deploy

**Files:**
- Create: `README.md`
- Modify: none

- [ ] **Step 1: Confirm the build is clean**

Run: `npm test && npm run build`
Expected: green. Do not deploy otherwise.

- [ ] **Step 2: Deploy via Vercel's Git integration**

**The client connects the GitHub repo to Vercel themselves — do not run
`npx vercel`, and do not create a Vercel project.** Once connected, every push
to `main` deploys automatically.

Vercel's Next.js defaults are correct as-is: build command `next build`, output
`.next`, install `npm install`. Change none of them.

Two things must be done in the Vercel dashboard, because they cannot be in the
repo:

- Set **`NEXT_PUBLIC_SHEET_ID`** and **`SHEET_GID`** as environment variables
  (Production and Preview). The values are in `.env.local`, which is
  gitignored. Without them `/api/menu` returns `{"source":"baked"}` — the menu
  still works, it simply stops picking up live price edits.
- Note the production URL Vercel assigns (likely `crownclub.vercel.app`). Step 4
  needs it.

Do **not** wire `build:menu`, `build:images`, or `build:imagemap` into the
Vercel build. They are offline steps: `src/data/menu.json` and `public/images/`
are committed, so a clean checkout already has everything `next build` needs.
Running them on Vercel would add `sharp` and `exceljs` to the deploy for no
benefit.

- [ ] **Step 3: Verify the deployment**

```bash
curl -s https://<deployment>/en | grep -c "Johnnie Walker"
curl -s https://<deployment>/ar | grep -o 'dir="rtl"'
curl -s https://<deployment>/api/menu | head -c 200
```

Expected: a non-zero count, `dir="rtl"`, and `"source":"live"`.

Then open it on a real phone and check the photos load and the prices are right.

- [ ] **Step 4: Generate the QR against the final URL**

```bash
npm run make:qr -- https://<deployment>
```

Scan it with an actual phone camera before sending anything to a printer.

- [ ] **Step 5: Write the README**

`README.md` must cover: how to change a price (edit the Google Sheet, live within 60 seconds), how to add a drink (edit the sheet, then re-run `npm run build:menu` and redeploy so it is baked in too), how to add a photo (drop it in `assets/original-images/<Category>/`, run `npm run build:images && npm run build:imagemap && npm run build:menu`), and the four open questions from the spec.

- [ ] **Step 6: Commit and push**

```bash
git add README.md deliverables
git commit -m "Add deployment README and print-ready QR code"
git push origin main
```

The push is the deploy. Watch the Vercel dashboard until the build goes green,
then re-run Step 3 against the production URL.

---

## Handover checklist

Before calling this done, confirm with the client:

- [ ] Bacardi Carta Blanca and Carta Negra — keep or drop?
- [ ] Photos for Miller and Captain Morgan Black
- [ ] Sorani Kurdish copy reviewed by a native speaker
- [ ] `crown-menu.xlsx` uploaded to the **client's** Google Drive, shared "anyone with the link (Viewer)", and its ID set in Vercel
- [ ] QR scanned from a printed sample, not just a screen
- [ ] **The existing table decals must not be printed as they are.** The QR
      codes in `assets/logo/source-table-decal-sheet.pdf` all encode
      `https://www.instagram.com/babilu.iq`, which is not Crown Club. Reprint
      them with the QR from `deliverables/crown-menu-qr.svg`.
