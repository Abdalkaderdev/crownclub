import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MenuBrowser, applyLive } from "./MenuBrowser";
import { getDictionary } from "@/i18n/get-dictionary";
import type { MenuItem } from "@/lib/menu-schema";

const dict = getDictionary("en");
const iqd = (value: number) => ({ currency: "IQD" as const, value });

const items: MenuItem[] = [
  { id: "beer__corona", name: "Corona", category: "Beer",
    glass: iqd(10000), bottle: null, available: true, image: null, tags: [] },
  // Deliberately distinct from Corona's 10,000: getByText throws on duplicates.
  { id: "whisky__jack-daniels", name: "Jack Daniels", category: "Whisky",
    glass: iqd(13000), bottle: iqd(160000), available: true, image: null, tags: [] },
  { id: "tequila__patron-silver", name: "Patron Silver", category: "Tequila",
    glass: iqd(15000), bottle: { currency: "USD", value: 200 },
    available: true, image: null, tags: [] },
];

const baked = () =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ source: "baked", items: [] }),
  }));

const live = (payload: unknown[]) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ source: "live", items: payload }),
  }));

afterEach(() => vi.restoreAllMocks());

describe("applyLive", () => {
  it("never clears a baked bottle price when the live row omits it", () => {
    const out = applyLive(items, [
      { ...items[1], glass: iqd(11000), bottle: null },
    ]);
    expect(out[1].bottle).toEqual(iqd(160000));
    expect(out[1].glass).toEqual(iqd(11000));
  });

  it("applies a live bottle price when the sheet supplies one", () => {
    const out = applyLive(items, [{ ...items[1], bottle: iqd(180000) }]);
    expect(out[1].bottle).toEqual(iqd(180000));
  });

  it("leaves items absent from the live payload untouched", () => {
    const out = applyLive(items, [{ ...items[0], glass: iqd(12000) }]);
    expect(out).toHaveLength(3);
    expect(out[1].glass).toEqual(iqd(13000));
  });

  it("lets the sheet mark an item sold out", () => {
    const out = applyLive(items, [{ ...items[0], available: false }]);
    expect(out[0].available).toBe(false);
  });

  it("never converts a dollar price", () => {
    const out = applyLive(items, [{ ...items[2], glass: iqd(16000), bottle: null }]);
    expect(out[2].bottle).toEqual({ currency: "USD", value: 200 });
  });
});

describe("MenuBrowser", () => {
  it("shows every item initially", () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.getByText("Jack Daniels")).toBeInTheDocument();
  });

  it("filters as you type, case-insensitively", async () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.type(screen.getByRole("searchbox"), "coro");
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.queryByText("Jack Daniels")).not.toBeInTheDocument();
  });

  it("shows a message when nothing matches", async () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText(dict.noResults)).toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await userEvent.click(screen.getByRole("button", { name: "Beer" }));
    expect(screen.getByText("Corona")).toBeInTheDocument();
    expect(screen.queryByText("Jack Daniels")).not.toBeInTheDocument();
  });

  it("shows a dollar bottle price with its symbol", () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    expect(screen.getByText("$200")).toBeInTheDocument();
  });

  it("keeps baked prices when the API reports 'baked'", async () => {
    baked();
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("10,000")).toBeInTheDocument());
    expect(screen.getByText("13,000")).toBeInTheDocument();
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("keeps baked prices when the API request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("Corona")).toBeInTheDocument());
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("applies a live glass price", async () => {
    live([{ ...items[0], glass: iqd(12000) }]);
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("12,000")).toBeInTheDocument());
  });

  it("NEVER lets a live refresh erase a bottle price", async () => {
    live([{ ...items[1], glass: iqd(11000), bottle: null }]);
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("11,000")).toBeInTheDocument());
    expect(screen.getByText("160,000")).toBeInTheDocument();
  });

  it("does not drop baked items that are absent from the live payload", async () => {
    live([{ ...items[0], glass: iqd(12000) }]);
    render(<MenuBrowser initialItems={items} dict={dict} />);
    await waitFor(() => expect(screen.getByText("12,000")).toBeInTheDocument());
    expect(screen.getByText("Jack Daniels")).toBeInTheDocument();
  });
});
