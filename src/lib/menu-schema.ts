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
