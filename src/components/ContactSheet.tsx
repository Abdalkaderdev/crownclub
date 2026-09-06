"use client";

import { useState } from "react";
import { CONTACT } from "@/lib/contact";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ContactSheet({ dict }: { dict: Dictionary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-cream/15 text-muted rounded-full border px-4 py-1.5 text-xs"
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
            className="bg-panel w-full rounded-t-2xl p-5"
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
                    className="border-cream/10 flex items-center justify-between rounded-xl border px-4 py-3"
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
              className="text-muted mt-4 w-full py-2 text-center text-xs underline"
            >
              {dict.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
