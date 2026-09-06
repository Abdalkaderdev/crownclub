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

  // Real cells from the client's spreadsheet use a non-breaking space
  // (code point 160) as the separator after the leading list number, not
  // an ASCII space. `.normalize("NFKD")` is what decomposes that character
  // into a plain space before the rest of the pipeline runs — without it,
  // these numbered rows (roughly half the menu) would not slugify
  // correctly. Built with String.fromCharCode(0xa0) rather than a pasted
  // non-breaking space, so the character stays unambiguous in the source
  // and can't silently turn into an ordinary space on a future edit or
  // copy-paste.
  it("handles a non-breaking space after the leading list numbering", () => {
    const nbsp = String.fromCharCode(0xa0);
    const hennessyVS = `1.${nbsp.repeat(5)}Hennessy Cognac V.S `;
    const hennessyVSOP = `2.${nbsp.repeat(5)}Hennessy Cognac V.S.O.P `;

    expect(slugify(hennessyVS)).toBe("hennessy-cognac-v-s");
    expect(slugify(hennessyVSOP)).toBe("hennessy-cognac-v-s-o-p");
    expect(slugify(hennessyVS)).not.toBe(slugify(hennessyVSOP));
  });
});
