"use client";

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border-cream/15 bg-panel focus-within:border-saffron/60 flex min-h-[44px] items-center gap-2 rounded-xl border px-3 transition-colors duration-150">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-muted size-4 shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        // text-base is load-bearing: iOS zooms the page in when a focused input
        // is under 16px, which throws the whole menu off-screen.
        className="text-cream placeholder:text-muted w-full bg-transparent py-2.5 text-base outline-none"
      />
    </div>
  );
}
