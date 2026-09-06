/** Lowercase, ASCII-hyphenated identifier. Used for item ids, image
 *  filenames, and image-map keys — all three must agree, so they all
 *  call this. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
