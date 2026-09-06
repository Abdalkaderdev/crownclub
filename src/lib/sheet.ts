import { mergeMenu } from "./merge";
import type { MenuItem, SourceRow } from "./menu-schema";

const MIN_ITEMS = 50;

function splitCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((f) => f.trim()));
}

export function parseGvizCsv(text: string): SourceRow[] {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iCat = header.indexOf("category");
  const iName = header.indexOf("name");
  const iPrice = header.indexOf("price");
  const iBottle = header.indexOf("bottle");
  const iAvail = header.indexOf("available");
  if (iCat < 0 || iName < 0) return [];

  return rows.slice(1).map((r) => ({
    category: r[iCat] ?? "",
    name: r[iName] ?? "",
    glass: iPrice >= 0 ? (r[iPrice] ?? "") : "",
    // The client's sheet has a Bottle column; the previous developer's did
    // not. Absent column -> empty -> parses to null, which the merge treats
    // as "no update", so both shapes work.
    bottle: iBottle >= 0 ? (r[iBottle] ?? "") : "",
    available: iAvail >= 0 ? (r[iAvail] ?? "") : "",
  }));
}

/**
 * The last line of defence before live data replaces the baked menu.
 * A sheet that has been emptied, truncated, or had its sharing revoked
 * must never blank the customer's menu.
 */
export function isSanePayload(items: MenuItem[]): boolean {
  if (items.length < MIN_ITEMS) return false;
  return items.every(
    (i) =>
      i.name.trim() !== "" &&
      (i.glass === null || i.glass.value > 0) &&
      (i.bottle === null || i.bottle.value > 0),
  );
}

export async function fetchLiveMenu(sheetId: string, gid = "0"): Promise<MenuItem[] | null> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` + `?tqx=out:csv&gid=${gid}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const text = await res.text();
    // A revoked or moved sheet serves an HTML sign-in page with a 200.
    if (text.trimStart().startsWith("<")) return null;

    const items = mergeMenu([], parseGvizCsv(text));
    return isSanePayload(items) ? items : null;
  } catch {
    return null;
  }
}
