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
