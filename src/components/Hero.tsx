import { LanguageSwitch } from "./LanguageSwitch";
import { ContactSheet } from "./ContactSheet";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <header className="px-1 pb-5 pt-6 text-center">
      <div className="mb-5 flex items-center justify-between">
        <LanguageSwitch current={locale} />
        <ContactSheet dict={dict} />
      </div>
      <p className="text-saffron mb-3 text-[0.68rem] uppercase tracking-[0.2em]">{dict.eyebrow}</p>
      {/* A plain img, not next/image: the logo is vector, so there is nothing
          to optimise, and next/image refuses local SVGs unless
          `dangerouslyAllowSVG` is turned on. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/crown-logo.svg"
        alt="Crown Club"
        width={180}
        height={133}
        className="mx-auto mb-3 h-auto w-[180px] max-w-[70%] object-contain"
      />
      <p className="text-muted text-sm">{dict.tagline}</p>
      <p className="text-muted/70 mt-2 text-[0.68rem]">{dict.priceNote}</p>
    </header>
  );
}
