"use client";

import Image from "next/image";
import { useEffect } from "react";
import { formatMoney } from "@/lib/price";
import type { MenuItem } from "@/lib/menu-schema";
import type { Dictionary } from "@/i18n/get-dictionary";

export function PhotoSheet({
  item,
  dict,
  onClose,
}: {
  item: MenuItem | null;
  dict: Dictionary;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item?.image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={dict.close}
        className="text-cream/70 absolute end-4 top-4 grid size-11 place-items-center rounded-full"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" className="size-6" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
      <div className="text-center" onClick={(e) => e.stopPropagation()}>
        <Image
          src={item.image}
          alt={item.name}
          width={420}
          height={560}
          className="mx-auto h-auto w-full max-w-[320px] rounded-2xl object-contain"
        />
        <p className="mt-3 font-semibold">{item.name}</p>
        <p className="text-saffron mt-1 text-sm tabular-nums" dir="ltr">
          {[
            item.glass && `${dict.glass} ${formatMoney(item.glass)}`,
            item.bottle && `${dict.bottle} ${formatMoney(item.bottle)}`,
          ]
            .filter(Boolean)
            .join("   ·   ")}
        </p>
        <button type="button" onClick={onClose} className="text-muted mt-4 min-h-[44px] px-4 text-sm underline">
          {dict.close}
        </button>
      </div>
    </div>
  );
}
