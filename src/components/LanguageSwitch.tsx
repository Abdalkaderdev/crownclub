"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

export function LanguageSwitch({ current }: { current: Locale }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  useEffect(() => {
    try {
      window.localStorage.setItem("crown.lang", current);
    } catch {
      // Private browsing. Not worth surfacing.
    }
  }, [current]);

  return (
    <nav className="border-cream/15 inline-flex gap-1 rounded-full border p-1">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}`}
          aria-current={l === current ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-xs ${
            l === current ? "bg-saffron text-saffron-ink font-semibold" : "text-muted"
          }`}
        >
          {LOCALE_LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
