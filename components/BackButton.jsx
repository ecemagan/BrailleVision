"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <path
        d="M11.75 4.75 6.5 10l5.25 5.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackButton() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={t("common.back")}
      className="glass-card relative z-20 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(109,76,194,0.12)] backdrop-blur-md transition-transform duration-200 hover:-translate-x-1 hover:text-violet-700"
    >
      <ArrowLeftIcon />
      <span>{t("common.back")}</span>
    </button>
  );
}