"use client";

import Image from "next/image";
import { formatMoney } from "@/lib/price";
import type { Money } from "@/lib/money";
import type { MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

function Price({ label, value, ask }: { label: string; value: Money | null; ask: string }) {
  return (
    <div className="text-end">
      <div className="text-muted text-[0.62rem] uppercase tracking-[0.16em]">{label}</div>
      <div
        dir="ltr"
        className={
          value === null
            ? "text-muted text-xs italic"
            : "text-saffron font-semibold tabular-nums"
        }
      >
        {value === null ? ask : formatMoney(value)}
      </div>
    </div>
  );
}

export function ItemCard({
  item,
  dict,
  onPhoto,
}: {
  item: MenuItem;
  dict: Dictionary;
  onPhoto: (item: MenuItem) => void;
}) {
  return (
    <li
      className={`border-cream/10 flex items-center gap-3 border-b py-3 ${
        item.available ? "" : "opacity-45"
      }`}
    >
      <button
        type="button"
        onClick={() => item.image && onPhoto(item)}
        disabled={!item.image}
        aria-label={item.name}
        className="bg-panel relative size-14 shrink-0 overflow-hidden rounded-xl transition-transform duration-150 enabled:active:scale-[0.96] disabled:cursor-default"
      >
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <span className="text-saffron/50 grid size-full place-items-center text-lg">
            {item.name.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.name}</p>
        {/* A badge, not just dimming: opacity alone conveys nothing to a
            screen reader or to anyone who cannot compare it against a
            neighbouring row. */}
        {!item.available && (
          <span className="border-cream/25 text-muted mt-1 inline-block rounded border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.14em]">
            {dict.soldOut}
          </span>
        )}
      </div>

      <div className="flex shrink-0 gap-4">
        {item.glass !== null && <Price label={dict.glass} value={item.glass} ask={dict.askStaff} />}
        {(item.bottle !== null || item.glass === null) && (
          <Price label={dict.bottle} value={item.bottle} ask={dict.askStaff} />
        )}
      </div>
    </li>
  );
}
