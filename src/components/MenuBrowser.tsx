"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuSection } from "./MenuSection";
import { SearchBar } from "./SearchBar";
import { CategoryChips } from "./CategoryChips";
import { PhotoSheet } from "./PhotoSheet";
import { CATEGORIES, type Category, type MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Fold live sheet values into the baked menu.
 *
 * A live value REPLACES a baked one; it never CLEARS one. `?? item.x` is
 * doing that work: a blank, deleted, or unparseable cell arrives as null and
 * leaves the baked price standing. An item absent from the live payload is
 * left entirely alone, so a partially-filled sheet cannot shrink the menu.
 *
 * Availability is the deliberate exception — it is a boolean the sheet owns
 * outright, and "no" has to be able to win.
 *
 * Currency travels inside the Money value, so a dollar price replaced by a
 * dinar one is a visible change rather than a silent tenfold error.
 */
export function applyLive(baked: MenuItem[], live: MenuItem[]): MenuItem[] {
  const byId = new Map(live.map((i) => [i.id, i]));
  return baked.map((item) => {
    const update = byId.get(item.id);
    if (!update) return item;
    return {
      ...item,
      glass: update.glass ?? item.glass,
      bottle: update.bottle ?? item.bottle,
      available: update.available,
    };
  });
}

export function MenuBrowser({
  initialItems,
  dict,
}: {
  initialItems: MenuItem[];
  dict: Dictionary;
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Category | null>(null);
  const [photo, setPhoto] = useState<MenuItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/menu");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || data.source !== "live" || !Array.isArray(data.items)) return;
        setItems((current) => applyLive(current, data.items));
      } catch {
        // Offline or blocked. The baked menu is already on screen.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (active === null || i.category === active) &&
        (q === "" || i.name.toLowerCase().includes(q)),
    );
  }, [items, query, active]);

  const present = useMemo(
    () => CATEGORIES.filter((c) => items.some((i) => i.category === c)),
    [items],
  );

  return (
    <main>
      <div className="bg-ink/95 border-cream/10 sticky top-0 z-20 -mx-4 border-b px-4 py-2 backdrop-blur-md">
        <SearchBar value={query} onChange={setQuery} placeholder={dict.search} />
        <CategoryChips present={present} active={active} onSelect={setActive} dict={dict} />
      </div>

      {visible.length === 0 ? (
        <p className="text-muted py-12 text-center text-sm">{dict.noResults}</p>
      ) : (
        CATEGORIES.map((c) => (
          <MenuSection
            key={c}
            category={c}
            items={visible.filter((i) => i.category === c)}
            dict={dict}
            onPhoto={setPhoto}
          />
        ))
      )}

      <PhotoSheet item={photo} dict={dict} onClose={() => setPhoto(null)} />
    </main>
  );
}
