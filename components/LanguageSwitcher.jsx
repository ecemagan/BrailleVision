"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="glass-card inline-flex w-fit max-w-full rounded-full border border-[var(--primary)] bg-white/80 p-1 text-xs font-semibold backdrop-blur-md shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_18%,transparent)]">
      <button
        type="button"
        onClick={() => setLocale("tr")}
        className={`w-10 rounded-full px-2 py-1.5 text-center transition sm:w-12 ${
          locale === "tr" ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600 hover:text-[var(--primary)]"
        }`}
      >
        TR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`w-10 rounded-full px-2 py-1.5 text-center transition sm:w-12 ${
          locale === "en" ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600 hover:text-[var(--primary)]"
        }`}
      >
        EN
      </button>
    </div>
  );
}
