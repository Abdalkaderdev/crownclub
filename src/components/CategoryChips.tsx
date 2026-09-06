"use client";

import { CATEGORIES, type Category } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function CategoryChips({
  present,
  active,
  onSelect,
  dict,
}: {
  present: Category[];
  active: Category | null;
  onSelect: (c: Category | null) => void;
  dict: Dictionary;
}) {
  const ordered = CATEGORIES.filter((c) => present.includes(c));

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs ${
          active === null
            ? "bg-saffron text-saffron-ink font-semibold"
            : "border-cream/15 text-muted border"
        }`}
      >
        {dict.all}
      </button>
      {ordered.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(active === c ? null : c)}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs ${
            active === c
              ? "bg-saffron text-saffron-ink font-semibold"
              : "border-cream/15 text-muted border"
          }`}
        >
          {dict.categories[c]}
        </button>
      ))}
    </div>
  );
}
