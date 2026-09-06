# Crown Club QR Menu — Design

**Date:** 2026-09-06
**Status:** Approved design, pending implementation plan
**Replaces:** https://menu.crown-club.workers.dev/

## Problem

Crown Club (Erbil) has a QR-code drinks menu built by a previous developer as a
single 45 KB HTML file on that developer's Cloudflare Workers account. It has
four problems:

1. **Not owned by the client.** The deployment and the Google Sheet behind it
   both sit in the previous developer's accounts.
2. **Blank on load.** Every scan fetches the menu from Google Sheets before it
   can render anything. On bar wifi, customers stare at a skeleton screen.
3. **English only.** The venue is in Erbil; Arabic and Kurdish speakers are the
   majority of walk-ins.
4. **No bottle prices**, and leftover branding from the template it was copied
   from ("Amber & Oak" still appears in the OpenGraph tags).

## Goals

- A fast, three-language (English / Arabic / Kurdish) drinks menu reachable by
  QR code from the table.
- Renders instantly, including on a bad connection or with Google unreachable.
- Prices editable by bar staff without a developer.
- Fully owned by the client: their hosting, their spreadsheet, their domain
  later if they want one.
- Show both glass and bottle prices.

## Non-goals

- Ordering, payment, or table service. This is a menu, not a POS.
- SEO. The page is reached by scanning a QR code at a table.
- Accounts, reservations, loyalty.
- A food menu (may come later; the category system is built to accept one).

## Source data

Two inputs, reconciled:

| Source | Contents |
|---|---|
| `menu editable.xlsx` (client, newer) | 75 items, 14 categories, **glass + bottle** prices |
| Live Google Sheet `1DOTlYqT...ze7Kw` (public, read-only) | 86 items incl. **12 cocktails with prices**, `Available` flags. Glass prices only. |

### Price normalisation — verified, not assumed

The Excel writes prices four different ways: `5iqd`, `10 iqd`, `15000`,
`20000iqd`, `200$`. The rule is:

1. Strip `iqd`, whitespace, case.
2. Strip non-numeric characters.
3. **If the value is under 1000, multiply by 1000.** So `10iqd` becomes 10,000 IQD.
4. `$` values **stay in dollars.** They are never converted to IQD, at build
   time or at runtime.

Because a price can be in either currency, a price is modelled as
`{ currency: "IQD" | "USD", value: number }` rather than a bare integer. The
sub-1000 thousands rule applies to IQD only — `200$` is two hundred dollars,
not two hundred thousand.

Prices display as a bare grouped number for IQD (`15,000`) with a single
"all prices in IQD unless marked" note on the page, and with an explicit
symbol for dollars (`$200`) so the exception is unmissable on the card itself.

This was validated by normalising all 75 Excel rows and diffing them against
the 86 live-sheet rows: **zero glass-price disagreements** across every item
present in both. The rule is confirmed against real data.

### Reconciliation decisions

**The Excel wins on price** (it is newer and is the only source with bottle
prices). The live sheet fills gaps.

Only in Excel — treat as **new items to keep**:

- Miller (Beer, 10,000)
- Captain Morgan (Rum, 15,000)
- Captain Morgan Black (Rum, 15,000)

Only in sheet — **keep**:

- 12 cocktails: Blue Lagoon, Mojito Classic, Pina Colada, London Mule, Sex on
  the Beach, Long Island Ice Tea, Bullfrog, Margarita, Whiskey Sour @ 15,000;
  Negroni, Old Fashioned, **Crown Signature** @ 20,000.

Only in sheet — **needs client decision** (dropped from the newer Excel, so
possibly discontinued):

- Bacardi Carta Blanca (15,000), Bacardi Carta Negra (15,000)

Spelling variants, same item — merge via an alias map:

- `BUSHMILLS BLACK` = `Bushmils BLACK`
- `Gordons Gin` = `Gordons Gin - Regular`

Glass price missing in Excel, taken from sheet:

- Patron Gold 15,000 · Finlandia 10,000 · Piccini Prosecco 15,000

Bottle price missing entirely (6 items) — render as "Ask staff":

- Captain Morgan, Captain Morgan Black, Captain Morgan Gold, Malibu,
  Patron Gold, Finlandia

Priced in dollars, kept in dollars:

- **Patron Silver bottle, `200$`** — displays as `$200`.

### Images

88 photos plus the Crown logo were downloaded from the old deployment
(8 MB total) and are now held locally, removing the dependency on the previous
developer's hosting. Coverage after category-key mapping:

- **Complete** for every category except Beer.
- **Miller has no photo.** Falls back to the Beer category image.
- **Captain Morgan Black** shares the Captain Morgan photo until a real one is
  supplied.

## Architecture

Next.js 15 (App Router), TypeScript, Tailwind, deployed to Vercel.

Next.js is chosen over a plain Vite SPA for three concrete reasons, not by
default: `next/image` optimises 88 photos without a hand-rolled pipeline;
`app/[lang]` gives correct server-rendered `lang`/`dir` attributes per
language instead of a client-side flip; and a Route Handler can proxy and
edge-cache the Google Sheet, which removes the CORS risk and stops 200
simultaneous scans from hammering Google.

### Rendering and data flow

```
menu editable.xlsx ─┐
                    ├─► scripts/build-menu.ts ─► src/data/menu.json  (committed)
live Google Sheet  ─┘                                   │
                                                        ▼
                    scan ──► statically rendered HTML from menu.json
                                    (instant paint, no spinner)
                                                        │
                    hydrate ──► GET /api/menu  (edge-cached, revalidate 60s)
                                                        │
                                    sane? ──yes──► swap in live prices
                                          └──no───► keep baked data, silently
```

`generateStaticParams` prerenders `/en`, `/ar`, `/ckb` at build time, so the
first paint is static HTML from a CDN.

The "sane?" check is a guard, not a formality: the live payload is rejected
unless it parses, contains at least 50 items, and every price normalises to a
positive number. A corrupted or emptied spreadsheet must never blank the menu.

### Module boundaries

| Module | Responsibility | Depends on |
|---|---|---|
| `lib/price.ts` | Normalise any price string to IQD; format for display | nothing |
| `lib/menu-schema.ts` | Zod schema + `MenuItem` type | zod |
| `lib/merge.ts` | Reconcile Excel + sheet rows, apply alias map | price, schema |
| `lib/sheet.ts` | Fetch + parse gviz CSV, run sanity guard | price, merge |
| `app/api/menu/route.ts` | Edge-cached proxy over `lib/sheet` | sheet |
| `lib/menu-client.ts` | Baked data + background refresh + localStorage | api route |
| `i18n/` | `en.json` / `ar.json` / `ckb.json`, dictionary loader | nothing |
| `scripts/build-menu.ts` | Offline: xlsx + sheet into `menu.json` | merge |
| `scripts/optimize-images.ts` | Offline: sharp into WebP, 400px + 800px | nothing |

`lib/price.ts` and `lib/merge.ts` are pure functions with no I/O, which is what
makes the risky logic testable in isolation.

### Components

Server: `Hero`, `MenuSection`, `ItemCard` (static content, no JS shipped).
Client islands: `LanguageSwitch`, `SearchBar`, `CategoryChips` (sticky),
`PhotoSheet`, `ContactSheet`, `LiveRefresh`.

Search, category filtering, and the live swap are the only interactive
concerns, so they are the only things that ship JavaScript.

## Internationalisation

Three locales: `en`, `ar`, `ckb` (Sorani Kurdish).

- UI strings and **category names** are translated. **Product names are not** —
  brands stay in Latin script.
- `ar` and `ckb` render with `dir="rtl"` set on `<html>` server-side.
- Fonts: Bricolage Grotesque + Manrope (Latin); Noto Kufi Arabic (Arabic and
  Kurdish, both Arabic script).
- Language is chosen by URL path (`/ar`), remembered in `localStorage`, and
  defaults from `Accept-Language` on first visit.
- Kurdish copy is written by the developer and **must be reviewed by a native
  Sorani speaker before the QR codes are printed.**

## Visual design

Crown's existing identity is kept — this is a rebuild, not a rebrand. Saffron
`#D9A353` on near-black `#0C0A0B`, rebuilt to the polish level of the client's
`german-doner.vercel.app`. The stray "Amber & Oak" metadata from the old
template is removed.

### Logo

The client supplied a print file for table decals
(`assets/logo/source-table-decal-sheet.pdf`). The Crown Club mark in it is
**fully vector** — 177 paths, no embedded fonts, no bitmap — so it was
extracted cleanly to `assets/logo/`:

| File | Use |
|---|---|
| `crown-logo-cream.svg` | The site. Transparent, recoloured `#F2E9DC` for the dark ground. |
| `crown-logo-black.svg` | Print and light backgrounds. |
| `crown-logo-{cream,black}.png` | 3269 x 2419 raster fallbacks. |

This replaces the old site's `Crown-logo2.png`, a 296 KB raster with a black
rectangle baked into its background.

### Defect found in the supplied print file

Every one of the four table decals on that sheet carries a QR code encoding
`https://www.instagram.com/babilu.iq` — an unrelated Instagram account, not
Crown Club's and not the menu. **The sheet must not go to print as it stands.**
The decals need re-laying-out with the QR generated in this project.

## Error handling

| Case | Behaviour |
|---|---|
| Sheet unreachable / malformed / under 50 items | Serve baked prices, no visible error |
| Photo missing | Category fallback image |
| Item has no price for a size | Show "Ask staff", never a blank |
| `Available = no` | Dimmed card with a **Sold out** badge |
| Unknown `[lang]` in URL | 404 via `generateStaticParams` |
| JavaScript disabled | Full menu still readable; only search and language switching are lost |

## Testing

Test-first (Vitest) on the pure logic, because a price bug here costs real
money:

- `lib/price.ts` — every observed format (`5iqd`, `10 iqd`, `15000`,
  `20000iqd`, `200$`, empty, null), the sub-1000 multiplier boundary, and
  rejection of negatives and NaN.
- `lib/merge.ts` — Excel wins on price; sheet fills missing glass prices; the
  alias map collapses spelling variants; sheet-only cocktails survive.
- `lib/sheet.ts` — the sanity guard rejects empty, truncated, and malformed
  payloads.

Regression fixture: all 75 Excel rows and all 86 sheet rows are committed as
test fixtures, asserting the zero-disagreement result stays true.

Playwright smoke: page loads; all three languages switch; `dir=rtl` applies for
`ar` and `ckb`; search filters; menu still renders with the network offline.

## Deliverables

1. Menu deployed to Vercel on a free subdomain.
2. Print-ready QR code, PNG + SVG, 2000 px.
3. `crown-menu.xlsx` — clean sheet, all reconciled items, correct columns
   (`Category | Name | Glass | Bottle | Available | Tags`), for the client to
   upload to **their own** Google Drive.
4. A written conflict list for the client to confirm before launch.

## Open questions

1. Keep or drop Bacardi Carta Blanca and Carta Negra?
2. Photos for Miller and Captain Morgan Black.
3. Native review of the Sorani Kurdish copy.

None of these block the build. Each has a defined fallback: missing photos use
the category image, and Bacardi is included until the client says otherwise.

**Resolved:** dollar prices stay in dollars (client, 2026-09-06).
