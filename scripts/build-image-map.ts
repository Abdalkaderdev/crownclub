import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { FOLDER_TO_CATEGORY } from "./image-folders";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets/original-images");
const OUT = path.join(ROOT, "assets/image-map.json");

const bigrams = (s: string): Set<string> => {
  const t = slugify(s).replace(/-/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

/** Dice coefficient over character bigrams: 0 = nothing in common, 1 = identical.
 *
 *  Token equality is useless here — the photo filenames the previous developer
 *  left behind are riddled with typos ("Jack danills", "Heinekin", "Bushmils",
 *  "Parton gold", "Double balck", "caberent"). Worse, plain token overlap ties
 *  "JACK DANIELS" against both "Jack danills" and "Jack Apple" on the shared
 *  word "jack" alone, and picks whichever it saw first — which put the Jack
 *  Apple bottle next to Jack Daniels. Character bigrams survive the typos and
 *  separate those two cleanly. */
function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/**
 * Hand-checked corrections, applied after the fuzzy pass.
 *
 * The photo filenames are the previous developer's and are full of typos and
 * abbreviations, so no similarity metric separates every variant correctly:
 * "patron gold" scores higher against "Patron" than against the misspelled
 * "Parton gold" that actually depicts it, and every "JACK DANIELS *" variant
 * collapses onto one bottle. Rather than tune a heuristic until it happens to
 * fit 89 rows, the ambiguous ones are pinned here where they can be read and
 * corrected. Value `null` means "no photo is right for this item".
 */
const OVERRIDES: Record<string, string | null> = {
  "arak__beylerbeyi-raki-gobek": "/images/arak/gobek.webp",
  "arak__tekirdag-raki-blue": "/images/arak/tek-blue.webp",
  "arak__tekirdag-raki-gold": "/images/arak/tekirdag.webp",

  "cognac__hennessy-cognac-v-s": "/images/cognac/hennessy.webp",
  "cognac__hennessy-cognac-v-s-o-p": "/images/cognac/vsop.webp",

  "gin__roku-japanese-crafted-gin": "/images/gin/roku.webp",

  "tequila__olmeca-tequila-silver": "/images/tequila/olmeco.webp",
  "tequila__olmeca-tequila-reposado": "/images/tequila/olmeco.webp",
  "tequila__patron-silver": "/images/tequila/patron.webp",
  "tequila__patron-gold": "/images/tequila/parton-gold.webp",

  "vodka__titos-handmade-vodka": "/images/vodka/titos.webp",

  "whisky__jack-daniels": "/images/whisky/jack-danills.webp",
  "whisky__jack-daniels-apple": "/images/whisky/jack-apple.webp",
  "whisky__jack-daniels-fire": "/images/whisky/jack-fire.webp",
  "whisky__jack-daniels-honey": "/images/whisky/jack-hiney.webp",
  "whisky__glenfiddich-single-malt-12yo": "/images/whisky/glenfiddich-12y.webp",
  "whisky__glenfiddich-single-malt-15yo": "/images/whisky/glen-15y.webp",
  "whisky__johnnie-walker-gold-label": "/images/whisky/gold.webp",
  "whisky__johnnie-walker-red-label": "/images/whisky/rd-label.webp",

  "red-wine__jacobs-greek-merlot": "/images/red-wine/jacobs.webp",
  "red-wine__jacobs-greek-shiraz": "/images/red-wine/jacobs-greek-shiraz.webp",

  // Sourced from Wikimedia Commons; see public/credits.txt. Pinned rather
  // than fuzzy-matched because the filenames were chosen to match exactly.
  "beer__miller": "/images/beer/miller.webp",
  "cocktails__blue-hawaii": "/images/cocktails/blue-hawaii.webp",
  "cocktails__bramble": "/images/cocktails/bramble.webp",
  "cocktails__mai-tai": "/images/cocktails/mai-tai.webp",
  "cocktails__manhattan": "/images/cocktails/manhattan.webp",
  "cocktails__paloma": "/images/cocktails/paloma.webp",
  "salads__caesar-salad": "/images/salads/caesar-salad.webp",
  "salads__greek-salad": "/images/salads/greek-salad.webp",
  "salads__jajik": "/images/salads/jajik.webp",
  "salads__oriental-salad": "/images/salads/oriental-salad.webp",
  "steaks__beef-steak": "/images/steaks/beef-steak.webp",
  "steaks__chicken-steak": "/images/steaks/chicken-steak.webp",

  // The bar's own cocktail — no stock photo is right. Needs one from them.
  "cocktails__crown-signature": null,
};

/** Below this, "no photo" beats a wrong photo. */
const MIN_SIMILARITY = 0.45;

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
    if (item.id in OVERRIDES) {
      const pinned = OVERRIDES[item.id];
      if (pinned) map[item.id] = pinned;
      else unmatched.push(`${item.category} / ${item.name}  (no photo exists)`);
      continue;
    }

    const category = item.id.split("__")[0];
    const scored = photos
      .filter((p) => p.category === category)
      .map((p) => ({ ...p, s: similarity(item.name, p.stem) }))
      .sort((a, b) => b.s - a.s);

    const best = scored[0];
    if (best && best.s >= MIN_SIMILARITY) {
      map[item.id] = best.webp;
      const runnerUp = scored[1];
      if (runnerUp && best.s - runnerUp.s < 0.08) {
        console.log(
          `  CLOSE CALL  ${item.name}  ->  ${best.stem} (${best.s.toFixed(2)}) ` +
            `over ${runnerUp.stem} (${runnerUp.s.toFixed(2)})`,
        );
      }
    } else {
      unmatched.push(
        `${item.category} / ${item.name}` +
          (best ? `  (best was ${best.stem} at ${best.s.toFixed(2)})` : ""),
      );
    }
  }

  // Every mapped file must exist, or the menu renders broken images. The
  // OVERRIDES table is hand-written, so a typo here is entirely likely.
  const missing = Object.entries(map).filter(
    ([, webp]) => !existsSync(path.join(ROOT, "public", webp.replace(/^\//, ""))),
  );
  if (missing.length) {
    console.error("Mapped photos that are not on disk:");
    for (const [id, webp] of missing) console.error(`  ${id} -> ${webp}`);
    process.exit(1);
  }

  await writeFile(OUT, JSON.stringify(map, null, 2) + "\n", "utf8");
  console.log(`Mapped ${Object.keys(map).length}/${menu.items.length} items.`);
  if (unmatched.length) {
    console.log("Unmatched (category fallback):");
    for (const u of unmatched) console.log("  " + u);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
