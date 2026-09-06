"use client";

import { ItemCard } from "./ItemCard";
import type { Category, MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function MenuSection({
  category,
  items,
  dict,
  onPhoto,
}: {
  category: Category;
  items: MenuItem[];
  dict: Dictionary;
  onPhoto: (item: MenuItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section id={category} className="mb-8 scroll-mt-32">
      <h2 className="text-saffron mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
        {dict.categories[category]}
      </h2>
      <ul className="list-none p-0">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} dict={dict} onPhoto={onPhoto} />
        ))}
      </ul>
    </section>
  );
}
