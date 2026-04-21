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
      className={`surface-card flex w-full min-w-0 shrink-0 flex-col ${isCompact ? "rounded-2xl p-4 md:p-5" : "rounded-2xl p-5 md:p-6"} md:sticky md:top-6 md:w-full md:max-w-none md:h-auto lg:max-w-sm lg:h-[calc(100vh-48px)]`}
    >
      <div className="border-b border-slate-200 pb-5">
        <div>
          <p className="section-kicker truncate whitespace-nowrap">{t("nav.brailleVision")}</p>
          <h2 className="mt-3 truncate whitespace-nowrap text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t("nav.workspace")}</h2>
          <div className="mt-3">
            {isNameLoading ? (
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
            ) : (
              <p className="truncate whitespace-nowrap text-sm font-semibold text-slate-900">{displayName}</p>
            )}
            {isEmailLoading ? (
              <div className="mt-1 h-3 w-32 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
            ) : (
              <p className="mt-1 truncate whitespace-nowrap text-sm text-slate-600">{email}</p>
            )}
          </div>
        </div>
      </div>

      <nav className="mt-6 grid min-w-0 flex-1 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:flex lg:flex-col">
        {navigationItems.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <Link
              key={item.key}
              href={`/dashboard?tab=${item.key}`}
              className={`block min-w-0 rounded-[20px] px-4 py-3 transition ${
                isActive ? "button-primary text-white" : "panel-subtle text-slate-800 hover:border-violet-200"
              }`}
            >
              <p className="truncate whitespace-nowrap text-sm font-semibold">{item.label}</p>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="button-secondary mt-4 w-full shrink-0 truncate whitespace-nowrap rounded-[20px] px-4 py-3 text-left text-sm font-semibold transition"
      >
        {t("nav.logout")}
      </button>
    </aside>
  );
}
