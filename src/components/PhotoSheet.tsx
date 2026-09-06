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
      <div className="text-center">
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
        <button type="button" onClick={onClose} className="text-muted mt-4 text-xs underline">
          {dict.close}
        </button>
      </div>
    </div>
  );
}
