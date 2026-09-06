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
      [excel({ name: "JACK DANIELS" }), excel({ name: "JACK DANIELS HONEY" })],
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
