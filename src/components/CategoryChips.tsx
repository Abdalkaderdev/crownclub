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
    <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-2"
      role="group"
      aria-label={dict.all}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={active === null}
        className={`inline-flex min-h-[44px] shrink-0 snap-start items-center whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-150 active:scale-[0.97] ${
          active === null
            ? "bg-saffron text-saffron-ink font-semibold"
            : "border-cream/20 text-cream/80 border"
        }`}
      >
        {dict.all}
      </button>
      {ordered.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(active === c ? null : c)}
          aria-pressed={active === c}
          className={`inline-flex min-h-[44px] shrink-0 snap-start items-center whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-150 active:scale-[0.97] ${
            active === c
              ? "bg-saffron text-saffron-ink font-semibold"
              : "border-cream/20 text-cream/80 border"
          }`}
        >
          {dict.categories[c]}
        </button>
      ))}
    </div>
  );
}
