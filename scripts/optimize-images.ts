import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { slugify } from "../src/lib/slug";
import { FOLDER_TO_CATEGORY } from "./image-folders";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets/original-images");
const OUT = path.join(ROOT, "public/images");

async function main() {
  let count = 0;
  for (const folder of await readdir(SRC, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const category = FOLDER_TO_CATEGORY[folder.name];
    if (!category) {
      console.warn(`Unmapped photo folder: ${folder.name}`);
      continue;
    }

    const destDir = path.join(OUT, category);
    await mkdir(destDir, { recursive: true });

    for (const file of await readdir(path.join(SRC, folder.name))) {
      const stem = slugify(path.parse(file).name);
      await sharp(path.join(SRC, folder.name, file))
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(destDir, `${stem}.webp`));
      count++;
    }
  }
  console.log(`Converted ${count} images into public/images/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
