import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run make:qr -- https://your-menu-url");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "deliverables");

// High error correction so the code still scans with a scuffed, smudged, or
// partly-covered table card.
const options = { errorCorrectionLevel: "H" as const, margin: 2, width: 2000 };

async function main() {
  await mkdir(OUT, { recursive: true });

  await QRCode.toFile(path.join(OUT, "crown-menu-qr.png"), url, {
    ...options,
    type: "png",
    // Black on white, not saffron on black. A low-contrast or inverted QR is
    // the most common reason a printed code fails to scan.
    color: { dark: "#0C0A0BFF", light: "#FFFFFFFF" },
  });

  const svg = await QRCode.toString(url, { ...options, type: "svg" });
  await writeFile(path.join(OUT, "crown-menu-qr.svg"), svg, "utf8");

  console.log(`QR written for ${url}`);
  console.log("  deliverables/crown-menu-qr.png  (2000px raster)");
  console.log("  deliverables/crown-menu-qr.svg  (vector, for the printer)");
}

main().catch((e) => { console.error(e); process.exit(1); });
