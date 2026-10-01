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
  "Salads",
  "Steaks",
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
  salad: "Salads",
  salads: "Salads",
  steak: "Steaks",
  steaks: "Steaks",
};

export function normaliseCategory(raw: string): Category | null {
  const key = raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return CATEGORY_ALIASES[key] ?? null;
}

/** Food, not drink: these get a bare price with no Glass/Bottle label. */
export const FOOD_CATEGORIES: ReadonlySet<Category> = new Set(["Salads", "Steaks"]);

export const menuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Arabic / Sorani names, set only where a translation makes sense.
   *  Brand names (Johnnie Walker, Grey Goose) stay Latin in every locale. */
  nameAr: z.string().nullable().default(null),
  nameCkb: z.string().nullable().default(null),
  category: z.enum(CATEGORIES),
  glass: moneySchema.nullable(),
  bottle: moneySchema.nullable(),
  available: z.boolean(),
  image: z.string().nullable(),
  tags: z.array(z.string()),
});

export type MenuItem = z.infer<typeof menuItemSchema>;

/** The name to show. Falls back to the Latin name when no translation exists,
 *  which is the normal case: most of this menu is brand names. */
export function displayName(item: MenuItem, locale: string): string {
  if (locale === "ar") return item.nameAr || item.name;
  if (locale === "ckb") return item.nameCkb || item.name;
  return item.name;
}

export const menuPayloadSchema = z.object({
  generatedAt: z.string(),
  items: z.array(menuItemSchema),
});

export type MenuPayload = z.infer<typeof menuPayloadSchema>;

export interface SourceRow {
  category: string;
  name: string;
  nameAr?: string;
  nameCkb?: string;
  glass?: unknown;
  bottle?: unknown;
  available?: string;
}
