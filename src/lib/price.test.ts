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
