import ExcelJS from "exceljs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { mergeMenu } from "../src/lib/merge";
import { normaliseCategory, menuPayloadSchema } from "../src/lib/menu-schema";
import type { SourceRow } from "../src/lib/menu-schema";

const ROOT = process.cwd();
const XLSX = path.join(ROOT, "assets/source-menu.xlsx");
const CSV = path.join(ROOT, "assets/old-sheet-snapshot.csv");
const IMAGE_MAP = path.join(ROOT, "assets/image-map.json");
const OUT = path.join(ROOT, "src/data/menu.json");

/**
 * Flatten an exceljs cell to text.
 *
 * `String(cell.value)` is NOT enough: cells the client pasted with mixed
 * fonts come back as `{ richText: [...] }` and stringify to the literal
 * "[object Object]". Heineken and Corona are both rich-text cells in the
 * source file, and they silently collapsed into one item named
 * "[object Object]" before this existed. Formula and hyperlink cells are
 * objects too.
 */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return "";
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if (typeof o.text === "string") return o.text;
    if ("result" in o) return cellText(o.result as ExcelJS.CellValue);
  }
  return "";
}

/** Prices keep their numeric type where they have one; everything else is
 *  flattened to text so the parser sees a string rather than an object. */
function cellPrice(v: ExcelJS.CellValue): unknown {
  if (typeof v === "number") return v;
  return cellText(v);
}

/** Column A holds either a category heading (nothing in B or C) or an item. */
async function readExcel(): Promise<SourceRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.worksheets[0];
  const rows: SourceRow[] = [];
  let category = "";

  ws.eachRow((row) => {
    const name = cellText(row.getCell(1).value).trim();
    if (!name) return;

    const glass = cellPrice(row.getCell(2).value);
    const bottle = cellPrice(row.getCell(3).value);
    const isHeading = !glass && !bottle && normaliseCategory(name) !== null;

    if (isHeading) {
      category = name;
      return;
    }
    if (!category) return;

    rows.push({ category, name, glass, bottle });
  });

  return rows;
}

/** Minimal RFC4180 reader — the snapshot is fully quoted. */
function parseCsv(text: string): string[][] {
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

export function rowsFromCsv(text: string): SourceRow[] {
  const [header, ...body] = parseCsv(text);
  const idx = (n: string) => header.findIndex((h) => h.trim().toLowerCase() === n);
  const iCat = idx("category");
  const iName = idx("name");
  const iPrice = idx("price");
  const iAvail = idx("available");

  return body.map((r) => ({
    category: r[iCat] ?? "",
    name: r[iName] ?? "",
    glass: r[iPrice] ?? "",
    available: iAvail >= 0 ? r[iAvail] : "",
  }));
}

async function main() {
  const excelRows = await readExcel();
  const sheetRows = rowsFromCsv(await readFile(CSV, "utf8"));
  const items = mergeMenu(excelRows, sheetRows);

  let imageMap: Record<string, string> = {};
  try {
    imageMap = JSON.parse(await readFile(IMAGE_MAP, "utf8"));
  } catch {
    console.warn("No image-map.json yet — items will have no photos.");
  }

  const withImages = items.map((i) => ({ ...i, image: imageMap[i.id] ?? null }));
  const payload = { generatedAt: new Date().toISOString(), items: withImages };

  menuPayloadSchema.parse(payload);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const noPhoto = withImages.filter((i) => !i.image);
  const noPrice = withImages.filter((i) => !i.glass && !i.bottle);
  console.log(`Wrote ${withImages.length} items to src/data/menu.json`);
  console.log(`  without a photo: ${noPhoto.length}`, noPhoto.map((i) => i.name));
  console.log(`  without any price: ${noPrice.length}`, noPrice.map((i) => i.name));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
