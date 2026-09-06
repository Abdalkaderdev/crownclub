import { describe, it, expect } from "vitest";
import { parsePrice, toMoney, formatMoney } from "./price";

describe("parsePrice", () => {
  it("reads a bare number below 1000 as thousands", () => {
    expect(parsePrice(10)).toEqual({ kind: "iqd", value: 10000 });
  });

  it("reads the 'Niqd' shorthand as thousands", () => {
    expect(parsePrice("10iqd")).toEqual({ kind: "iqd", value: 10000 });
    expect(parsePrice("10 iqd")).toEqual({ kind: "iqd", value: 10000 });
    expect(parsePrice("5iqd")).toEqual({ kind: "iqd", value: 5000 });
  });

  it("leaves values of 1000 and above alone", () => {
    expect(parsePrice(15000)).toEqual({ kind: "iqd", value: 15000 });
    expect(parsePrice("20000iqd")).toEqual({ kind: "iqd", value: 20000 });
    expect(parsePrice("25000 iqd")).toEqual({ kind: "iqd", value: 25000 });
    expect(parsePrice("150000")).toEqual({ kind: "iqd", value: 150000 });
  });

  it("treats 1000 itself as already-scaled (boundary)", () => {
    expect(parsePrice(1000)).toEqual({ kind: "iqd", value: 1000 });
  });

  it("treats 999 as needing the multiplier (boundary)", () => {
    expect(parsePrice(999)).toEqual({ kind: "iqd", value: 999000 });
  });

  it("keeps dollars as dollars and does not apply the thousands rule", () => {
    expect(parsePrice("200$")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("$200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("25$")).toEqual({ kind: "foreign", currency: "USD", value: 25 });
  });

  it("returns none for blank, null, and undefined", () => {
    expect(parsePrice("")).toEqual({ kind: "none" });
    expect(parsePrice("   ")).toEqual({ kind: "none" });
    expect(parsePrice(null)).toEqual({ kind: "none" });
    expect(parsePrice(undefined)).toEqual({ kind: "none" });
  });

  it("returns none for text with no digits", () => {
    expect(parsePrice("iqd")).toEqual({ kind: "none" });
    expect(parsePrice("ask staff")).toEqual({ kind: "none" });
  });

  it("rejects zero and negatives rather than returning a bad price", () => {
    expect(parsePrice(0)).toEqual({ kind: "none" });
    expect(parsePrice(-5)).toEqual({ kind: "none" });
    expect(parsePrice("-10iqd")).toEqual({ kind: "none" });
  });

  it("rejects NaN and Infinity", () => {
    expect(parsePrice(NaN)).toEqual({ kind: "none" });
    expect(parsePrice(Infinity)).toEqual({ kind: "none" });
  });

  it("returns whole dinars, never fractions", () => {
    expect(parsePrice(12.4)).toEqual({ kind: "iqd", value: 12400 });
    expect(parsePrice(15000.7)).toEqual({ kind: "iqd", value: 15001 });
  });
});

// These came out of an adversarial review round (probing the real module,
// not just re-reading the spec) that found three ways the negative-number
// guard could be bypassed, a way two prices in one cell could silently
// concatenate into a single plausible-looking wrong price, and a missed
// "USD" currency word. Each defect below is paired with the exact input
// that exposed it.
describe("parsePrice — adversarial review fixes (fix round 1)", () => {
  it("rejects accounting-style negatives in parentheses (no hyphen present)", () => {
    expect(parsePrice("(10000)")).toEqual({ kind: "none" });
  });

  it("rejects the Unicode minus sign U+2212 (Excel/Word autocorrect substitute for a hyphen)", () => {
    expect(parsePrice("−10iqd")).toEqual({ kind: "none" });
  });

  it("rejects a hyphen even when a $ sits between it and the digits", () => {
    expect(parsePrice("-$10")).toEqual({ kind: "none" });
  });

  it("rejects two numbers separated by a slash rather than concatenating them", () => {
    expect(parsePrice("15000/20000")).toEqual({ kind: "none" });
  });

  it("rejects two numbers separated by a space rather than concatenating them", () => {
    expect(parsePrice("15 20")).toEqual({ kind: "none" });
  });

  it("recognizes the word USD as a currency marker, in either order", () => {
    expect(parsePrice("200 USD")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("USD 200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
  });

  it("rejects a Date object rather than misreading it as a numeric timestamp", () => {
    expect(parsePrice(new Date("2026-01-01"))).toEqual({ kind: "none" });
  });

  it("rejects a boolean", () => {
    expect(parsePrice(true)).toEqual({ kind: "none" });
  });

  it("rejects an array", () => {
    expect(parsePrice([])).toEqual({ kind: "none" });
  });

  it("rejects a plain object", () => {
    expect(parsePrice({})).toEqual({ kind: "none" });
  });

  it("keeps comma-grouped thousands separators working (regression guard)", () => {
    expect(parsePrice("15,000")).toEqual({ kind: "iqd", value: 15000 });
    expect(parsePrice("$1,500")).toEqual({ kind: "foreign", currency: "USD", value: 1500 });
  });

  it("rejects an IQD figure above the 100,000,000 upper bound", () => {
    expect(parsePrice(100_000_001)).toEqual({ kind: "none" });
    expect(parsePrice("150000000iqd")).toEqual({ kind: "none" });
  });

  it("allows an IQD figure exactly at the 100,000,000 upper bound", () => {
    expect(parsePrice(100_000_000)).toEqual({ kind: "iqd", value: 100_000_000 });
  });

  it("recognizes USD with no space and no word boundary between the digits and the letters", () => {
    expect(parsePrice("200usd")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("200USD")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("usd200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
  });

  it("keeps every other USD/IQD notation working after dropping the word-boundary requirement", () => {
    expect(parsePrice("200 USD")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("USD 200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("$200")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("200$")).toEqual({ kind: "foreign", currency: "USD", value: 200 });
    expect(parsePrice("10iqd")).toEqual({ kind: "iqd", value: 10000 });
    expect(parsePrice("15000")).toEqual({ kind: "iqd", value: 15000 });
  });
});

describe("toMoney", () => {
  it("tags IQD", () => {
    expect(toMoney({ kind: "iqd", value: 15000 })).toEqual({ currency: "IQD", value: 15000 });
  });

  it("keeps dollars as dollars rather than dropping them", () => {
    expect(toMoney({ kind: "foreign", currency: "USD", value: 200 })).toEqual({
      currency: "USD",
      value: 200,
    });
  });

  it("maps none to null", () => {
    expect(toMoney({ kind: "none" })).toBeNull();
  });
});

describe("formatMoney", () => {
  it("groups IQD thousands with commas and no symbol", () => {
    expect(formatMoney({ currency: "IQD", value: 15000 })).toBe("15,000");
    expect(formatMoney({ currency: "IQD", value: 175000 })).toBe("175,000");
  });

  it("marks dollars with a symbol so the exception is obvious", () => {
    expect(formatMoney({ currency: "USD", value: 200 })).toBe("$200");
  });
});
