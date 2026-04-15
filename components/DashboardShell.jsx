"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

function StatCard({ label, value, helper }) {
  return (
    <article className="panel-subtle rounded-[22px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </article>
  );
}

function getMostUsedSourceType(documents) {
  const entries = new Map();

  documents.forEach((document) => {
    entries.set(document.source_type, (entries.get(document.source_type) || 0) + 1);
  });

  const [topSource] = [...entries.entries()].sort((left, right) => right[1] - left[1])[0] || [];
  return topSource ? getSourceLabel(topSource) : "No data yet";
}

function getTabMeta(activeTab, latestDocument, documents, favoriteDocuments, mostUsedSource) {
  if (activeTab === "upload") {
    return {
      eyebrow: "Conversion",
      title: "Convert",
      stat: latestDocument?.file_name || "No recent file",
      helper: "Latest saved conversion",
    };
  }

  if (activeTab === "documents") {
    return {
      eyebrow: "Library",
      title: "Library",
      stat: String(documents.length),
      helper: "saved conversions",
    };
  }

  return {
    eyebrow: "Settings",
    title: "Settings",
    stat: `${favoriteDocuments.length} favorites`,
    helper: `Top source: ${mostUsedSource}`,
  };
}

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, user, profile, refreshProfile } = useAuth();
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
      const friendlyMessage = getFriendlyDocumentMessage(error, "Your saved conversions could not be loaded right now.");
      setDocumentsError(friendlyMessage);
      setDocuments([]);
      setLoadingDocuments(false);
      pushNotification({
        type: "error",
        title: "Documents unavailable",
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
  const mostUsedSource = useMemo(() => getMostUsedSourceType(documents), [documents]);
  const quotaStatus = getQuotaStatus(documents.length);
  const tabMeta = getTabMeta(activeTab, latestDocument, documents, favoriteDocuments, mostUsedSource);

  useEffect(() => {
    if (!quotaStatus.isWarning || quotaWarningRef.current) {
      return;
    }

    quotaWarningRef.current = true;
    pushNotification({
      type: "warning",
      title: quotaStatus.isExceeded ? "Workspace quota reached" : "Workspace quota warning",
      message: `You are using ${quotaStatus.count}/${quotaStatus.softLimit} saved document slots in the dashboard library.`,
    });
  }, [quotaStatus.count, quotaStatus.isExceeded, quotaStatus.isWarning, quotaStatus.softLimit]);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
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
        title: nextValue ? "Onboarding completed" : "Onboarding reset",
        message: nextValue
          ? "The first-use guide has been dismissed."
          : "The onboarding guide will be shown again when the library is empty.",
      });
    } catch (error) {
      pushNotification({
        type: "error",
        title: "Onboarding update failed",
        message: getFriendlyDocumentMessage(error, "The onboarding preference could not be updated."),
      });
    }
  }

  const showOnboarding = !preferences.onboardingCompleted && documents.length === 0;

  return (
    <main className="page-shell">
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />

      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[300px_1fr]">
        <Sidebar
          activeTab={activeTab}
          onLogout={handleLogout}
          userEmail={user?.email || "Authenticated user"}
          profile={profile}
          density={density}
        />

        <section className="space-y-6">
          {activeTab === "overview" ? (
            <>
              <div className={`surface-card hero-wash ${density === "compact" ? "rounded-[24px] p-5 md:p-6" : "rounded-[32px] p-6 md:p-8"}`}>
                <p className="section-kicker">Overview</p>
                <h1 className="mt-3 max-w-4xl text-5xl font-bold leading-[0.98] tracking-tight text-slate-950 md:text-[4.15rem]">
                  Braille translation workspace
                </h1>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.replace("/dashboard?tab=upload")}
                    className="button-primary rounded-full px-6 py-3 text-sm font-semibold transition"
                  >
                    Start conversion
                  </button>
                  <button
                    type="button"
                    onClick={() => router.replace("/dashboard?tab=documents")}
                    className="button-secondary rounded-full px-6 py-3 text-sm font-semibold transition"
                  >
                    Open library
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Saved"
                  value={loadingDocuments ? "..." : String(documents.length)}
                  helper="Total conversions in your library."
                />
                <StatCard
                  label="Active"
                  value={loadingDocuments ? "..." : String(activeDocuments.length)}
                  helper="Conversions currently kept in the main library."
                />
                <StatCard
                  label="Favorites"
                  value={loadingDocuments ? "..." : String(favoriteDocuments.length)}
                  helper="Entries marked for fast return."
                />
                <StatCard
                  label="7 days"
                  value={loadingDocuments ? "..." : String(lastSevenDaysCount)}
                  helper={`Most used source: ${mostUsedSource}.`}
                  />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                <article className="surface-card rounded-[28px] p-6 md:p-8">
                  <p className="section-kicker">Latest work</p>
                  <h2 className="panel-heading mt-3">{latestDocument?.file_name || "No conversion yet"}</h2>

                  {latestDocument ? (
                    <div className="panel-subtle mt-6 rounded-[24px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Braille preview</p>
                      <p className="mt-3 break-all text-xl leading-9 text-slate-950">
                        {`${latestDocument.braille_text.slice(0, 180)}${latestDocument.braille_text.length > 180 ? "..." : ""}`}
                      </p>
                    </div>
                  ) : null}
                </article>

                <article className="surface-card rounded-[28px] p-6">
                  <p className="section-kicker">Workspace status</p>
                  <div className="mt-5 space-y-4">
                    <div className="panel-subtle rounded-[20px] p-4">
                      <p className="text-sm font-semibold text-slate-900">Quota</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {quotaStatus.count}/{quotaStatus.softLimit} saved conversions in use.
                      </p>
                    </div>
                    <div className="panel-subtle rounded-[20px] p-4">
                      <p className="text-sm font-semibold text-slate-900">Default landing view</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{preferences.documentView}</p>
                    </div>
                    <div className="panel-subtle rounded-[20px] p-4">
                      <p className="text-sm font-semibold text-slate-900">Display mode</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {preferences.themeMode}, {preferences.dashboardDensity} density
                      </p>
                    </div>
                  </div>
                </article>
              </div>

              {showOnboarding ? (
                <div className="surface-card rounded-[28px] border border-dashed border-violet-200 p-6 md:p-8">
                  <p className="section-kicker">First use</p>
                  <h2 className="panel-heading mt-3">Start conversion</h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <article className="panel-subtle rounded-[22px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Input</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Bring in source text</p>
                    </article>
                    <article className="panel-subtle rounded-[22px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Review</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Inspect the Braille result</p>
                    </article>
                    <article className="panel-subtle rounded-[22px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Export</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Copy or download</p>
                    </article>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => router.replace("/dashboard?tab=upload")}
                      className="button-primary rounded-full px-5 py-3 text-sm font-semibold transition"
                    >
                      Open conversion
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOnboardingComplete(true)}
                      className="button-secondary rounded-full px-5 py-3 text-sm font-semibold transition"
                    >
                      Dismiss guide
                    </button>
                  </div>
                </div>
              ) : null}

              <DocumentsPanel
                documents={activeDocuments.slice(0, 3)}
                loading={loadingDocuments}
                errorMessage={documentsError}
                supabase={supabase}
                onDocumentsChanged={loadDocuments}
                onNotify={pushNotification}
                density={density}
                variant="compact"
              />
            </>
          ) : null}

          {activeTab !== "overview" ? (
            <div className="surface-card rounded-[30px] p-6 md:p-8">
              <p className="section-kicker">{tabMeta.eyebrow}</p>
              <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <h1 className="panel-heading">{tabMeta.title}</h1>
                </div>
                <div className="panel-subtle rounded-[22px] px-5 py-4">
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
