"use client";

import { useI18n } from "@/components/I18nProvider";

export default function GlobalError({ error, reset }) {
  const { t } = useI18n();

  return (
    <main className="page-shell flex items-center justify-center">
      <div className="surface-card w-full max-w-xl rounded-[28px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">{t("error.application")}</p>
        <h2 className="font-display mt-3 text-3xl font-bold text-slate-950">{t("error.somethingWrong")}</h2>
        <p className="mt-4 text-slate-600">{error?.message || t("error.unexpected")}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="button-primary mt-6 rounded-full px-5 py-3 font-semibold transition"
        >
          {t("error.tryAgain")}
        </button>
      </div>
    </main>
  );
}
