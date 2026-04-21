"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

export function Sidebar({
  activeTab,
  onLogout,
  userEmail,
  profile,
  density = "comfortable",
}) {
  const { t } = useI18n();
  const isCompact = density === "compact";
  const displayName = profile?.display_name?.trim();
  const email = userEmail?.trim();
  const isNameLoading = !displayName;
  const isEmailLoading = !email;

  const navigationItems = [
    { key: "overview", label: t("nav.overview") },
    { key: "upload", label: t("nav.convert") },
    { key: "documents", label: t("nav.library") },
    { key: "settings", label: t("nav.settings") },
  ];

  return (
    <aside
      className={`surface-card ${isCompact ? "rounded-2xl p-4 md:p-5" : "rounded-2xl p-5 md:p-6"} md:sticky md:top-6 md:h-[calc(100vh-48px)]`}
    >
      <div className="border-b border-slate-200 pb-5">
        <div>
          <p className="section-kicker">{t("nav.brailleVision")}</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{t("nav.workspace")}</h2>
          <div className="mt-3">
            {isNameLoading ? (
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
            ) : (
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            )}
            {isEmailLoading ? (
              <div className="mt-1 h-3 w-32 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
            ) : (
              <p className="mt-1 text-sm text-slate-600">{email}</p>
            )}
          </div>
        </div>
      </div>

      <nav className="mt-6 space-y-2">
        {navigationItems.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <Link
              key={item.key}
              href={`/dashboard?tab=${item.key}`}
              className={`block rounded-[20px] px-4 py-3 transition ${
                isActive ? "button-primary text-white" : "panel-subtle text-slate-800 hover:border-violet-200"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="button-secondary mt-6 w-full rounded-[20px] px-4 py-3 text-left text-sm font-semibold transition"
      >
        {t("nav.logout")}
      </button>
    </aside>
  );
}
