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
