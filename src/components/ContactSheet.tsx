"use client";

import { useEffect, useState } from "react";
import { CONTACT } from "@/lib/contact";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ContactSheet({ dict }: { dict: Dictionary }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-cream/20 text-cream/80 inline-flex min-h-[38px] items-center rounded-full border px-4 text-sm transition-colors duration-150"
      >
        {dict.contact}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dict.contact}
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-panel w-full rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">{dict.contact}</h2>
            <p className="text-muted mb-4 text-sm">{dict.contactSub}</p>
            <ul className="list-none space-y-2 p-0">
              {CONTACT.links.map((l) => (
                <li key={l.key}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-cream/10 hover:border-saffron/40 flex min-h-[52px] items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-150"
                  >
                    <span className="font-semibold">{l.label}</span>
                    <span className="text-muted text-sm" dir="ltr">
                      {l.handle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted mt-4 min-h-[44px] w-full text-center text-sm underline"
            >
              {dict.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
