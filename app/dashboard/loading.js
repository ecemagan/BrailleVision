"use client";

import { useI18n } from "@/components/I18nProvider";

export default function DashboardLoading() {
  const { t } = useI18n();

  return (
    <main className="page-shell">
      <section className="surface-card mx-auto max-w-3xl rounded-[28px] p-8">
        <p className="font-display text-2xl font-bold text-slate-950">{t("loading.dashboard")}</p>
        <p className="mt-2 text-slate-600">{t("loading.preparingWorkspace")}</p>
      </section>
    </main>
  );
}
