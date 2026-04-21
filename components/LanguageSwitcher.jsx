"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="glass-card inline-flex min-w-[108px] rounded-full border border-[var(--primary)] bg-white/80 p-1 text-xs font-semibold backdrop-blur-md shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_18%,transparent)]">
      <button
        type="button"
        onClick={() => setLocale("tr")}
        className={`w-12 rounded-full px-3 py-1.5 text-center transition ${
          locale === "tr" ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600 hover:text-[var(--primary)]"
        }`}
      >
        TR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`w-12 rounded-full px-3 py-1.5 text-center transition ${
          locale === "en" ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600 hover:text-[var(--primary)]"
        }`}
      >
        EN
      </button>
    </div>
  );
}
