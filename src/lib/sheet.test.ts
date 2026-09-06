import { describe, it, expect, vi, afterEach } from "vitest";
import { parseGvizCsv, isSanePayload, fetchLiveMenu } from "./sheet";
import type { MenuItem } from "./menu-schema";

const item = (over: Partial<MenuItem> = {}): MenuItem => ({
  id: "whisky__x",
  name: "X",
  category: "Whisky",
  glass: { currency: "IQD", value: 10000 },
  bottle: null,
  available: true,
  image: null,
  tags: [],
  ...over,
});

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => item({ id: `whisky__x${i}`, name: `X${i}` }));

const NL = String.fromCharCode(10);

afterEach(() => vi.restoreAllMocks());

describe("parseGvizCsv", () => {
  it("reads quoted rows into source rows", () => {
    const csv =
      '"Category","Name","Description","Price","Bottle","Available","Tags"' + NL +
      '"Beer","Corona","","10000","","yes",""' + NL;
    expect(parseGvizCsv(csv)).toEqual([
      { category: "Beer", name: "Corona", glass: "10000", bottle: "", available: "yes" },
    ]);
  });

  it("reads the Bottle column when the sheet has one", () => {
    const csv =
      '"Category","Name","Price","Bottle","Available"' + NL +
      '"Whisky","Jack Daniels","10000","160000","yes"' + NL;
    expect(parseGvizCsv(csv)[0]).toEqual({
      category: "Whisky",
      name: "Jack Daniels",
      glass: "10000",
      bottle: "160000",
      available: "yes",
    });
  });

  it("tolerates a sheet with no Bottle column", () => {
    const csv = '"Category","Name","Price"' + NL + '"Beer","Corona","10000"' + NL;
    expect(parseGvizCsv(csv)[0].bottle).toBe("");
  });

  it("keeps a dollar bottle price from the sheet in dollars", () => {
    const csv =
      '"Category","Name","Price","Bottle"' + NL +
      '"Tequila","Patron Silver","15000","200$"' + NL;
    expect(parseGvizCsv(csv)[0].bottle).toBe("200$");
  });

  it("survives commas inside quoted fields", () => {
    const csv = '"Category","Name","Price"' + NL + '"Soft Drinks","Pepsi, 7up","5000"' + NL;
    expect(parseGvizCsv(csv)[0].name).toBe("Pepsi, 7up");
  });

  it("returns an empty array for an empty document", () => {
    expect(parseGvizCsv("")).toEqual([]);
  });

  it("returns an empty array when the header is unrecognisable", () => {
    expect(parseGvizCsv('"a","b"' + NL + '"1","2"' + NL)).toEqual([]);
  });
});

describe("isSanePayload", () => {
  it("accepts a full menu", () => {
    expect(isSanePayload(many(60))).toBe(true);
  });

  it("rejects a suspiciously small menu", () => {
    expect(isSanePayload(many(49))).toBe(false);
  });

  it("rejects an empty menu", () => {
    expect(isSanePayload([])).toBe(false);
  });

  it("rejects a menu containing a non-positive price", () => {
    const zero = item({ id: "whisky__bad", glass: { currency: "IQD", value: 0 } });
    const neg = item({ id: "whisky__neg", glass: { currency: "IQD", value: -1 } });
    expect(isSanePayload([...many(60), zero])).toBe(false);
    expect(isSanePayload([...many(60), neg])).toBe(false);
  });

  it("accepts items with null prices, which mean 'ask staff'", () => {
    expect(isSanePayload([...many(60), item({ id: "whisky__ask", glass: null, bottle: null })])).toBe(true);
  });
});

describe("fetchLiveMenu", () => {
  it("returns null when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null when the sheet is emptied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '"Category","Name","Price"' + NL,
    }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns null when Google serves an HTML sign-in page instead of CSV", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => "<!DOCTYPE html><html>Sign in</html>",
    }));
    expect(await fetchLiveMenu("abc")).toBeNull();
  });

  it("returns items when the sheet is healthy", async () => {
    const header = '"Category","Name","Price","Available"' + NL;
    const rows = Array.from(
      { length: 60 },
      (_, i) => '"Whisky","Item ' + i + '","10000","yes"',
    ).join(NL);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => header + rows + NL,
    }));
    const out = await fetchLiveMenu("abc");
    expect(out).not.toBeNull();
    expect(out!.length).toBe(60);
  });
});
