# Crown Club — QR Bar Menu

Three-language drinks menu (English / Arabic / Kurdish) reached by scanning a
QR code at the table. Live at **https://crownclub.vercel.app**.

Replaces `menu.crown-club.workers.dev`, which sat on the previous developer's
Cloudflare account and pulled from a spreadsheet nobody at Crown Club owned.

## Changing the menu

**Prices, availability, and existing drinks — no developer needed.**

Edit the Google Sheet. Changes appear on the menu within about a minute.

| Column | Meaning |
|---|---|
| `Category` | Must match one of the 15 known categories |
| `Name` | The drink name, shown exactly as typed |
| `Price` | Price **per glass / shot**, in IQD |
| `Bottle` | Price **per bottle**, in IQD |
| `Available` | `no` greys the item out as "Sold out". Anything else means available |
| `Tags` | Unused for now |

Two rules that matter:

- **Do not rename the header row.** The site matches on those exact names.
- **Prices in dollars need a leading apostrophe:** type `'200$`, not `200$`.
  Google Sheets treats the Bottle column as numeric and silently deletes a
  plain `200$` on import. The apostrophe forces it to be stored as text and
  never appears on the menu.

If the sheet is unreachable, malformed, or has fewer than 50 rows, the site
quietly falls back to the prices built into the last deploy. A customer never
sees an error or an empty menu.

**Adding or removing a drink** also needs a redeploy, so the item is baked in
rather than appearing only while the sheet is reachable:

```bash
npm run build:menu   # rebuild src/data/menu.json from the sources
git commit -am "Add <drink>" && git push
```

## Adding a photo

```bash
# 1. Drop the image in the matching folder
#    assets/original-images/<Whisky|Gin|Vodka|...>/Your Drink.jpg
npm run build:images     # convert to WebP at 800px
npm run build:imagemap   # match photos to menu items
npm run build:menu       # write the mapping into menu.json
```

`build:imagemap` prints anything it could not match, and fails outright if it
maps an item to a file that is not on disk. If it picks the wrong bottle, pin
the correct one by hand in the `OVERRIDES` table in
`scripts/build-image-map.ts` — that table exists because the inherited photo
filenames are full of typos (`Jack danills`, `Heinekin`, `Parton gold`) and no
automatic matcher separates every variant correctly.

## Deployment

Pushing to `main` deploys to production via Vercel's GitHub integration.

One environment variable is required in the Vercel dashboard:

| Variable | Value |
|---|---|
| `SHEET_ID` | `1qXDmxwFdlJel8UqA_w5DR-co4FZZo0sFxNkk6YwATjo` |
| `SHEET_GID` | `0` |

It is deliberately **not** prefixed `NEXT_PUBLIC_`. That prefix would inline
the spreadsheet id into the JavaScript every visitor downloads; only the
server-side route handler needs it.

Do not wire `build:menu`, `build:images`, or `build:imagemap` into the Vercel
build. They are offline steps — `src/data/menu.json` and `public/images/` are
committed, so a clean checkout already has everything `next build` needs.

## How it works

```
menu editable.xlsx ─┐
                    ├─► scripts/build-menu.ts ─► src/data/menu.json (committed)
old sheet snapshot ─┘                                    │
                                                         ▼
                     scan ──► static HTML from the CDN (instant, no spinner)
                                                         │
                     hydrate ──► GET /api/menu (edge-cached 60s)
                                                         │
                                     sane? ──yes──► swap in live prices
                                           └──no───► keep baked prices, silently
```

The menu is server-rendered, so it is fully readable with JavaScript disabled —
only search and the language switch need it.

A live value can **replace** a baked price but never **clear** one, and an item
missing from the live payload is left alone. A half-filled sheet cannot shrink
the menu or wipe its prices.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | 114 unit tests |
| `npm run build` | Production build |
| `npm run build:menu` | Regenerate `src/data/menu.json` |
| `npm run build:images` | Convert source photos to WebP |
| `npm run build:imagemap` | Match photos to menu items |
| `npm run make:qr -- <url>` | Print-ready QR, PNG + SVG |
| `npm run make:xlsx` | Regenerate the client spreadsheet |

## Deliverables

- `deliverables/crown-menu-qr.png` / `.svg` — 2000px, high error correction,
  black on white. Scan a printed sample before ordering a batch.
- `deliverables/crown-menu.xlsx` — the spreadsheet behind the Google Sheet.

## Known gaps

- **No photo** for Miller or the Crown Signature cocktail; both fall back to a
  lettered tile.
- **Captain Morgan Black** reuses the Captain Morgan shot.
- **Patron Silver's bottle price** (`$200`) cannot be edited live. Google's CSV
  export types the Bottle column as numeric and drops the one text cell, so the
  value comes from the baked data. Everything else in the sheet is live.
- **Kurdish copy** was written by a developer and still needs a native Sorani
  speaker to check it.
- Product names keep the casing they have in the spreadsheet, so some are
  upper-case and some are not. Fix them in the sheet if it bothers you.
