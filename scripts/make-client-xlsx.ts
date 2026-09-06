import ExcelJS from "exceljs";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "deliverables/crown-menu.xlsx");

/** Write IQD as a plain number so staff can edit it, and dollars in the
 *  `200$` form the parser understands, so a round-trip through the sheet does
 *  not turn $200 into 200 dinars. */
function moneyCell(m: { currency: string; value: number } | null): string | number {
  if (!m) return "";
  return m.currency === "USD" ? `${m.value}$` : m.value;
}

async function main() {
  const menu = JSON.parse(await readFile(path.join(ROOT, "src/data/menu.json"), "utf8"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Menu");

  ws.columns = [
    { header: "Category", key: "category", width: 18 },
    { header: "Name", key: "name", width: 34 },
    { header: "Description", key: "description", width: 26 },
    { header: "Price", key: "glass", width: 12 },
    { header: "Bottle", key: "bottle", width: 12 },
    { header: "Available", key: "available", width: 11 },
    { header: "Tags", key: "tags", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const i of menu.items) {
    ws.addRow({
      category: i.category,
      name: i.name,
      description: "",
      glass: moneyCell(i.glass),
      bottle: moneyCell(i.bottle),
      available: i.available ? "yes" : "no",
      tags: i.tags.join(", "),
    });
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${menu.items.length} rows to deliverables/crown-menu.xlsx`);
}

main().catch((e) => { console.error(e); process.exit(1); });
