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
      for (const c of CATEGORIES) expect(cats[c]).toBeTruthy();
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

  it("does not translate the two RTL locales into identical copy", () => {
    expect(getDictionary("ar").search).not.toBe(getDictionary("ckb").search);
  });
});
