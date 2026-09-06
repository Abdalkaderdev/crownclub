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

  it("prices everything in IQD except the known dollar item", () => {
    const usd = menu.items.filter(
      (i) => i.glass?.currency === "USD" || i.bottle?.currency === "USD",
    );
    expect(usd.map((i) => i.name.toLowerCase())).toEqual(["patron silver"]);
  });

  // Heineken and Corona are rich-text cells in the client's spreadsheet.
  // Stringifying an exceljs rich-text cell yields the literal "[object
  // Object]", which silently collapsed both drinks into one bogus item.
  // Nothing else caught it, so this guard stays.
  it("has no item name leaking a stringified object", () => {
    const bad = menu.items.filter((i) => /\[object/i.test(i.name) || /\[object/i.test(i.id));
    expect(bad.map((i) => i.name)).toEqual([]);
  });

  it("keeps both rich-text beers as separate items", () => {
    const beers = menu.items.filter((i) => i.category === "Beer").map((i) => i.name.toLowerCase());
    expect(beers).toContain("heineken");
    expect(beers).toContain("corona");
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

  it("keeps the Bacardis the client asked to retain", () => {
    const names = menu.items.map((i) => i.name.toLowerCase());
    expect(names.filter((n) => n.includes("bacardi"))).toHaveLength(2);
  });

  it("keeps Patron Silver's bottle in dollars rather than converting it", () => {
    const patron = menu.items.find((i) => i.name.toLowerCase().includes("patron silver"));
    expect(patron).toBeDefined();
    expect(patron!.bottle).toEqual({ currency: "USD", value: 200 });
    expect(patron!.glass).toEqual({ currency: "IQD", value: 15000 });
  });

  it("collapsed the spelling variants", () => {
    const names = menu.items
      .filter((i) => i.category === "Whisky")
      .map((b) => b.name.toLowerCase());
    expect(names.filter((n) => n.includes("bushmi") && n.includes("black"))).toHaveLength(1);
  });

  it("gives every item at least one price", () => {
    const priceless = menu.items.filter((i) => i.glass === null && i.bottle === null);
    expect(priceless.map((i) => i.name)).toEqual([]);
  });
});
