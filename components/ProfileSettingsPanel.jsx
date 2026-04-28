"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  PROFILE_DEFAULT_VIEW_OPTIONS,
  PROFILE_DENSITY_OPTIONS,
  PROFILE_THEME_ACCENT_OPTIONS,
  PROFILE_THEME_MODE_OPTIONS,
  normalizeProfilePreferences,
  updateProfileRecord,
} from "@/lib/profiles";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

// Density Preview Icon - minimal schematic
function DensityPreview({ type }) {
  if (type === "comfortable") {
    return (
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-300" />
        <div className="h-3 w-full rounded bg-gray-300" />
        <div className="h-3 w-2/3 rounded bg-gray-300" />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded bg-gray-300" />
      <div className="h-2 w-full rounded bg-gray-300" />
      <div className="h-2 w-2/3 rounded bg-gray-300" />
    </div>
  );
}

export function ProfileSettingsPanel({ profile, supabase, userId, onSaved, density = "comfortable", onNotify }) {
  const isCompact = density === "compact";
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState("profile");
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [preferences, setPreferences] = useState(normalizeProfilePreferences(profile?.preferences));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedDisplayName = displayName.trim();
  const avatarInitial = trimmedDisplayName ? trimmedDisplayName.charAt(0).toUpperCase() : "";
  const isAvatarLoading = !profile;

  useEffect(() => {
    setDisplayName(profile?.display_name || "");
    setPreferences(normalizeProfilePreferences(profile?.preferences));
  }, [profile]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await updateProfileRecord({
        supabase,
        userId,
        displayName,
        preferences,
      });

      setMessage(t("settings.workspacePreferencesUpdated"));
      onSaved?.();
      onNotify?.({
        type: "success",
        title: t("settings.preferencesSaved"),
        message: t("settings.preferencesSavedMessage"),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("settings.preferencesFailedMessage"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("settings.preferencesFailed"),
        message: friendlyMessage,
      });
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: "profile", label: t("settings.profileTab") },
    { id: "appearance", label: t("settings.appearanceTab") },
    { id: "notifications", label: t("settings.notificationsTab") },
  ];

  const heroTitle =
    activeTab === "appearance"
      ? t("settings.appearanceTab")
      : activeTab === "notifications"
        ? t("settings.notificationsTab")
        : t("settings.profileTitle");
  const heroDescription =
    activeTab === "appearance"
      ? t("settings.appearanceDescription")
      : activeTab === "notifications"
        ? t("settings.notificationsDescription")
        : t("settings.profileDescription");

  return (
    <section className="space-y-6">
      <section className={`surface-card ${isCompact ? "rounded-[28px] p-5 md:p-6" : "rounded-[28px] p-6 md:p-7"}`}>
        <form onSubmit={handleSave} className="grid gap-0 lg:grid-cols-12 lg:gap-6">
          {/* Left Sidebar - Tab Navigation */}
          <div className="lg:col-span-3">
            <nav className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-4 dark:border-slate-700 sm:grid-cols-3 lg:flex lg:flex-col lg:border-b-0 lg:border-r lg:border-gray-200 lg:pb-0 lg:pr-6 dark:lg:border-slate-700">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? "border-l-2 border-l-[var(--primary)] bg-[var(--accent)] text-gray-900 dark:bg-slate-800 dark:text-white"
                      : "border-l-2 border-l-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-9">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("settings.profileTitle")}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("settings.profileDescription")}</p>
              </div>

              {/* Avatar Section */}
              <div className="mb-8 flex justify-center">
                {isAvatarLoading ? (
                  <div className="h-24 w-24 rounded-full bg-[var(--accent)] animate-pulse" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-3xl font-bold text-white">
                    {avatarInitial}
                  </div>
                )}
              </div>

              {/* Display Name Input */}
              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300">{t("settings.displayName")}</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="field-input w-full rounded-2xl px-4 py-3 outline-none transition dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:placeholder-gray-500"
                    placeholder={t("settings.displayNamePlaceholder")}
                  />
                </label>
              </div>

              {/* Default View */}
              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300">{t("settings.defaultView")}</span>
                  <select
                    value={preferences.documentView}
                    onChange={(event) => setPreferences((current) => ({ ...current, documentView: event.target.value }))}
                    className="field-input w-full rounded-2xl px-4 py-3 outline-none transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                  >
                    {PROFILE_DEFAULT_VIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("settings.appearanceTab")}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("settings.appearanceDescription")}</p>
              </div>

              {/* Density Selection with Preview */}
              <div>
                <span className="mb-4 block text-sm font-semibold text-gray-900 dark:text-gray-300">{t("settings.cardDensity")}</span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {PROFILE_DENSITY_OPTIONS.map((option) => {
                    const isActive = preferences.dashboardDensity === option.value;

                    return (
                    <label
                      key={option.value}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? "bg-white text-black border-[var(--primary)]"
                          : "bg-gray-100 text-gray-500 border-transparent dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      <div className="mb-3 h-16">
                        <DensityPreview type={option.value} />
                      </div>
                      <input
                        type="radio"
                        name="density"
                        value={option.value}
                        checked={preferences.dashboardDensity === option.value}
                        onChange={(event) => setPreferences((current) => ({ ...current, dashboardDensity: event.target.value }))}
                        className="hidden"
                      />
                      <span className={isActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'}>{option.label}</span>
                    </label>
                    );
                  })}
                </div>
              </div>

              {/* Theme Mode with Icons */}
              <div>
                <span className="mb-4 block text-sm font-semibold text-gray-900 dark:text-gray-300">{t("settings.themeMode")}</span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {PROFILE_THEME_MODE_OPTIONS.map((option) => {
                    const isActive = preferences.themeMode === option.value;

                    return (
                      <label
                        key={option.value}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isActive
                            ? "bg-white text-black border-[var(--primary)]"
                            : "bg-gray-100 text-gray-500 border-transparent dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        <div className="mb-3 flex justify-center text-3xl">
                          {option.value === "light" ? "☀️" : "🌙"}
                        </div>
                        <input
                          type="radio"
                          name="theme"
                          value={option.value}
                          checked={isActive}
                          onChange={(event) => setPreferences((current) => ({ ...current, themeMode: event.target.value }))}
                          className="hidden"
                        />
                        <span className={isActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'}>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Theme Accent */}
              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300">{t("settings.themeAccent")}</span>
                  <select
                    value={preferences.themeAccent}
                    onChange={(event) => setPreferences((current) => ({ ...current, themeAccent: event.target.value }))}
                    className="field-input w-full rounded-2xl px-4 py-3 outline-none transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                  >
                    {PROFILE_THEME_ACCENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("settings.notificationsTab")}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("settings.notificationsDescription")}</p>
              </div>

              {/* Notifications Toggle */}
              <label className="surface-soft flex items-start gap-4 rounded-2xl border border-gray-200 p-5 transition hover:border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600">
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={(event) => setPreferences((current) => ({ ...current, notificationsEnabled: event.target.checked }))}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-violet-600"
                />
                <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{t("settings.enableNotifications")}</span>
                    <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{t("settings.notificationsDescription")}</span>
                </span>
              </label>
            </div>
          )}

          {/* Error/Success Messages */}
          {errorMessage ? (
            <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300">
              {errorMessage}
            </p>
          ) : null}

          {message ? (
            <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              {message}
            </p>
          ) : null}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="button-primary mt-8 rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? t("common.saving") : t("settings.saveWorkspaceSettings")}
          </button>
          </div>
        </form>
      </section>
    </section>
  );
}
