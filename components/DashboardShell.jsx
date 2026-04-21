"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ProfileSettingsPanel } from "@/components/ProfileSettingsPanel";
import { Sidebar } from "@/components/Sidebar";
import { UploadPanel } from "@/components/UploadPanel";
import { useAuth } from "@/components/AuthProvider";
import { getQuotaStatus } from "@/lib/brailleAssistant";
import { getSourceLabel } from "@/lib/documents";
import { normalizeProfilePreferences, updateProfileRecord } from "@/lib/profiles";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";
import { useI18n } from "@/components/I18nProvider";
import { BackButton } from "@/components/BackButton";

function StatChip({ icon, label, value, helper }) {
  return (
    <article className="surface-card rounded-2xl p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-base text-violet-700">
          {icon}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function QuotaCircle({ value, max }) {
  const safeMax = Math.max(max, 1);
  const progress = Math.min(Math.max(value / safeMax, 0), 1);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 88 88" className="h-24 w-24 -rotate-90">
        <circle cx="44" cy="44" r={radius} className="fill-none stroke-violet-100" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className="fill-none stroke-violet-600 transition-all duration-300"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-900">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}

function formatOverviewDate(value, locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getWelcomeName(profile, userEmail) {
  const fromProfile = profile?.display_name?.trim();

  if (fromProfile) {
    return fromProfile;
  }

  return "";
}

function EmptyLibraryState({ onStart, t }) {
  return (
    <div className="glass-card mt-6 rounded-2xl p-6 text-center md:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-2xl text-violet-700">
        ⠿
      </div>
      <h3 className="mt-4 text-2xl font-bold text-slate-950">{t("dashboard.emptyTitle")}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
        {t("dashboard.emptyDescription")}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="button-primary mt-6 rounded-full px-6 py-3 text-sm font-semibold"
      >
        {t("dashboard.emptyCta")}
      </button>
    </div>
  );
}

function RecentActivityPanel({ documents, latestDocument, onOpenDocuments, onStartConversion, t, locale }) {
  if (!documents.length) {
    return <EmptyLibraryState onStart={onStartConversion} t={t} />;
  }

  return (
    <div className="mt-6 space-y-4">
      <article className="glass-card rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("dashboard.latestWork")}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">{latestDocument?.file_name}</h3>
        <p className="mt-2 text-sm text-slate-500">{formatOverviewDate(latestDocument.created_at, locale)}</p>
        <p className="mt-4 break-all text-lg leading-8 text-slate-900">
          {`${latestDocument.braille_text.slice(0, 180)}${latestDocument.braille_text.length > 180 ? "..." : ""}`}
        </p>
      </article>

      <div className="space-y-3">
        {documents.slice(0, 4).map((document) => (
          <article key={document.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{document.file_name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatOverviewDate(document.created_at, locale)}</p>
              </div>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                {document.source_type}
              </span>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenDocuments}
        className="button-secondary rounded-full px-5 py-3 text-sm font-semibold"
      >
        {t("dashboard.openFullLibrary")}
      </button>
    </div>
  );
}

function SystemInfoPanel({ quotaStatus, preferences, t }) {
  return (
    <aside className="surface-card rounded-2xl p-5 md:p-6 xl:self-end">
      <p className="section-kicker">{t("dashboard.systemInfo")}</p>
      <div className="mt-4 flex items-center gap-4">
        <QuotaCircle value={quotaStatus.count} max={quotaStatus.softLimit} />
        <div>
          <p className="text-sm font-semibold text-slate-900">{t("dashboard.quotaUsage")}</p>
          <p className="mt-1 text-sm text-slate-600">
            {t("dashboard.slots", { count: quotaStatus.count, limit: quotaStatus.softLimit })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {quotaStatus.isExceeded
              ? t("dashboard.limitExceeded")
              : quotaStatus.isWarning
                ? t("dashboard.approachingLimit")
                : t("dashboard.healthy")}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="panel-subtle rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("dashboard.defaultView")}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{preferences.documentView}</p>
        </div>
        <div className="panel-subtle rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("dashboard.displayMode")}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {preferences.themeMode}, {preferences.dashboardDensity}
          </p>
        </div>
      </div>
    </aside>
  );
}

function getMostUsedSourceType(documents, t) {
  const entries = new Map();

  documents.forEach((document) => {
    entries.set(document.source_type, (entries.get(document.source_type) || 0) + 1);
  });

  const [topSource] = [...entries.entries()].sort((left, right) => right[1] - left[1])[0] || [];
  return topSource ? getSourceLabel(topSource) : t("dashboard.noDataYet");
}

function getTabMeta(activeTab, latestDocument, documents, favoriteDocuments, mostUsedSource, t) {
  if (activeTab === "overview") {
    return {
      eyebrow: t("nav.overview"),
      title: t("dashboard.dashboard"),
      stat: String(documents.length),
      helper: t("dashboard.savedConversions"),
    };
  }

  if (activeTab === "upload") {
    return {
      eyebrow: t("dashboard.tabConversionEyebrow"),
      title: t("dashboard.tabConvertTitle"),
      stat: latestDocument?.file_name || t("dashboard.noRecentFile"),
      helper: t("dashboard.latestSavedConversion"),
    };
  }

  if (activeTab === "documents") {
    return {
      eyebrow: t("dashboard.tabLibraryEyebrow"),
      title: t("dashboard.tabLibraryTitle"),
      stat: String(documents.length),
      helper: t("dashboard.savedConversions"),
    };
  }

  return {
    eyebrow: t("dashboard.tabSettingsEyebrow"),
    title: t("dashboard.tabSettingsTitle"),
    stat: t("dashboard.favoritesCount", { count: favoriteDocuments.length }),
    helper: t("dashboard.topSource", { source: mostUsedSource }),
  };
}

export function DashboardShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, user, profile, refreshProfile, loading: loadingAuth } = useAuth();
  const { t, locale } = useI18n();
  const quotaWarningRef = useRef(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [quickSaveSignal, setQuickSaveSignal] = useState(0);
  const preferences = normalizeProfilePreferences(profile?.preferences);
  const density = preferences.dashboardDensity;
  const tabParam = searchParams.get("tab");
  const activeTab = ["overview", "upload", "documents", "settings"].includes(tabParam)
    ? tabParam
    : preferences.documentView;

  function dismissNotification(notificationId) {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId),
    );
  }

  function pushNotification({ type = "success", title, message }) {
    if (preferences.notificationsEnabled === false && type !== "warning") {
      return;
    }

    const notificationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotifications((currentNotifications) => [
      { id: notificationId, type, title, message },
      ...currentNotifications,
    ].slice(0, 6));

    window.setTimeout(() => dismissNotification(notificationId), 6000);
  }

  async function loadDocuments() {
    if (!supabase || !user) {
      return;
    }

    setLoadingDocuments(true);
    setDocumentsError("");

    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, file_name, original_text, braille_text, created_at, updated_at, source_type, conversion_mode, tags, is_favorite, is_archived, archived_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("dashboard.savedConversionsLoadFailed"));
      setDocumentsError(friendlyMessage);
      setDocuments([]);
      setLoadingDocuments(false);
      pushNotification({
        type: "error",
        title: t("dashboard.documentsUnavailable"),
        message: friendlyMessage,
      });
      return;
    }

    setDocuments(data ?? []);
    setLoadingDocuments(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [supabase, user]);

  useEffect(() => {
    function handleKeydown(event) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select") || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.replace("/dashboard?tab=documents");
        setSearchFocusSignal((currentValue) => currentValue + 1);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && activeTab === "upload") {
        event.preventDefault();
        setQuickSaveSignal((currentValue) => currentValue + 1);
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && !isTyping && event.key.toLowerCase() === "u") {
        event.preventDefault();
        router.replace("/dashboard?tab=upload");
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeTab, router]);

  const latestDocument = documents[0];
  const activeDocuments = documents.filter((document) => !document.is_archived);
  const favoriteDocuments = documents.filter((document) => document.is_favorite && !document.is_archived);
  const lastSevenDaysCount = documents.filter(
    (document) => new Date(document.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ).length;
  const mostUsedSource = useMemo(() => getMostUsedSourceType(documents, t), [documents, t]);
  const quotaStatus = getQuotaStatus(documents.length);
  const tabMeta = getTabMeta(activeTab, latestDocument, documents, favoriteDocuments, mostUsedSource, t);
  const welcomeName = getWelcomeName(profile, user?.email);
  const welcomeTemplate = t("dashboard.welcomeBack", { name: "__NAME__" });
  const [welcomePrefix, welcomeSuffix = ""] = welcomeTemplate.split("__NAME__");
  const isWelcomeLoading = loadingAuth || !user || !welcomeName;
  const breadcrumbLabel = useMemo(() => {
    const localeTag = locale === "tr" ? "tr-TR" : "en-US";

    if (pathname?.startsWith("/dashboard")) {
      const labels = {
        overview: t("nav.overview"),
        upload: t("nav.convert"),
        documents: t("nav.library"),
        settings: t("nav.settings"),
      };

      return (labels[activeTab] || labels.overview).toLocaleUpperCase(localeTag);
    }

    return t("nav.overview").toLocaleUpperCase(localeTag);
  }, [activeTab, locale, pathname, t]);

  useEffect(() => {
    if (!quotaStatus.isWarning || quotaWarningRef.current) {
      return;
    }

    quotaWarningRef.current = true;
    pushNotification({
      type: "warning",
      title: quotaStatus.isExceeded ? t("dashboard.workspaceQuotaReached") : t("dashboard.workspaceQuotaWarning"),
      message: t("dashboard.workspaceQuotaMessage", { count: quotaStatus.count, limit: quotaStatus.softLimit }),
    });
  }, [quotaStatus.count, quotaStatus.isExceeded, quotaStatus.isWarning, quotaStatus.softLimit, t]);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
  }

  async function handleOnboardingComplete(nextValue = true) {
    if (!supabase || !user) {
      return;
    }

    try {
      await updateProfileRecord({
        supabase,
        userId: user.id,
        preferences: {
          ...preferences,
          onboardingCompleted: nextValue,
        },
      });
      await refreshProfile();
      pushNotification({
        type: "success",
        title: nextValue ? t("dashboard.onboardingCompleted") : t("dashboard.onboardingReset"),
        message: nextValue
          ? t("dashboard.firstUseGuideDismissed")
          : t("dashboard.onboardingGuideShownAgain"),
      });
    } catch (error) {
      pushNotification({
        type: "error",
        title: t("dashboard.onboardingUpdateFailed"),
        message: getFriendlyDocumentMessage(error, t("dashboard.onboardingPreferenceUpdateFailed")),
      });
    }
  }

  return (
    <main className="page-shell">
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />

      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[300px_1fr]">
        <Sidebar
          activeTab={activeTab}
          onLogout={handleLogout}
          userEmail={user?.email || t("dashboard.authenticatedUser")}
          profile={profile}
          density={density}
        />

        <section className="relative space-y-6 pt-20 md:pt-24 xl:pt-28">
          <div className="absolute left-0 top-4 flex items-center space-x-4 md:top-6">
            <BackButton />
            <p className="section-kicker">{breadcrumbLabel}</p>
          </div>

          {activeTab === "overview" ? (
            <>
              <div className={`surface-card hero-wash ${density === "compact" ? "rounded-2xl p-5 pr-16 md:p-6 md:pr-20" : "rounded-2xl p-6 pr-16 md:p-8 md:pr-24"}`}>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h1 className="mt-2 flex max-w-4xl items-center whitespace-nowrap text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                      <span className="shrink-0">{welcomePrefix}</span>
                      {isWelcomeLoading ? (
                        <span className="inline-block h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse align-middle mx-1"></span>
                      ) : (
                        <span>{welcomeName}</span>
                      )}
                      <span className="shrink-0">{welcomeSuffix}</span>
                    </h1>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      {t("dashboard.continue")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.replace("/dashboard?tab=upload")}
                    className="button-primary rounded-full px-7 py-3.5 text-base font-semibold"
                  >
                    {t("dashboard.startConversion")}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatChip
                  icon="📁"
                  label={t("dashboard.saved")}
                  value={loadingDocuments ? "..." : String(documents.length)}
                  helper={t("dashboard.totalConversions")}
                />
                <StatChip
                  icon="🧾"
                  label={t("dashboard.active")}
                  value={loadingDocuments ? "..." : String(activeDocuments.length)}
                  helper={t("dashboard.activeConversions")}
                />
                <StatChip
                  icon="⭐"
                  label={t("dashboard.favorites")}
                  value={loadingDocuments ? "..." : String(favoriteDocuments.length)}
                  helper={t("dashboard.favoriteEntries")}
                />
                <StatChip
                  icon="📈"
                  label={t("dashboard.last7Days")}
                  value={loadingDocuments ? "..." : String(lastSevenDaysCount)}
                  helper={t("dashboard.mostUsedSource", { source: mostUsedSource })}
                  />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="surface-card rounded-2xl p-6 md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">{t("dashboard.recentActivity")}</p>
                      <h2 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">{t("dashboard.yourLibrary")}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.replace("/dashboard?tab=documents")}
                      className="button-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
                    >
                      {t("dashboard.viewAll")}
                    </button>
                  </div>

                  {loadingDocuments ? (
                    <div className="mt-6 grid gap-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="glass-card animate-pulse rounded-2xl p-4">
                          <div className="h-4 w-40 rounded bg-slate-200" />
                          <div className="mt-3 h-3 w-24 rounded bg-slate-100" />
                          <div className="mt-4 h-3 w-full rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <RecentActivityPanel
                      documents={activeDocuments}
                      latestDocument={latestDocument}
                      onOpenDocuments={() => router.replace("/dashboard?tab=documents")}
                      onStartConversion={() => router.replace("/dashboard?tab=upload")}
                      t={t}
                      locale={locale}
                    />
                  )}
                </section>

                <SystemInfoPanel quotaStatus={quotaStatus} preferences={preferences} t={t} />
              </div>
            </>
          ) : null}

          {activeTab !== "overview" ? (
            <div className="surface-card rounded-2xl p-6 md:p-8">
              <p className="section-kicker">{tabMeta.eyebrow}</p>
              <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <h1 className="panel-heading">{tabMeta.title}</h1>
                </div>
                <div className="panel-subtle rounded-2xl px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{tabMeta.helper}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{tabMeta.stat}</p>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "upload" ? (
            <UploadPanel
              userId={user.id}
              supabase={supabase}
              onSaved={async () => {
                await loadDocuments();
                await handleOnboardingComplete(true);
              }}
              onNotify={pushNotification}
              density={density}
              quickSaveSignal={quickSaveSignal}
              isActive={activeTab === "upload"}
            />
          ) : null}

          {activeTab === "documents" ? (
            <DocumentsPanel
              documents={documents}
              loading={loadingDocuments}
              errorMessage={documentsError}
              supabase={supabase}
              onDocumentsChanged={loadDocuments}
              onNotify={pushNotification}
              onCreateFirstDocument={() => router.replace("/dashboard?tab=upload")}
              density={density}
              focusSearchSignal={searchFocusSignal}
            />
          ) : null}

          {activeTab === "settings" ? (
            <ProfileSettingsPanel
              profile={profile}
              supabase={supabase}
              userId={user.id}
              onSaved={refreshProfile}
              onNotify={pushNotification}
              density={density}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
