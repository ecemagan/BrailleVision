"use client";

import { useEffect, useState } from "react";
import {
  PROFILE_DEFAULT_VIEW_OPTIONS,
  PROFILE_DENSITY_OPTIONS,
  PROFILE_THEME_ACCENT_OPTIONS,
  PROFILE_THEME_MODE_OPTIONS,
  normalizeProfilePreferences,
  updateProfileRecord,
} from "@/lib/profiles";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

function SettingsBlock({ eyebrow, title, description, children }) {
  return (
    <article className="panel-subtle rounded-[24px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">{title}</h3>
      <div className="mt-5 grid gap-4">{children}</div>
    </article>
  );
}

export function ProfileSettingsPanel({ profile, supabase, userId, onSaved, density = "comfortable", onNotify }) {
  const isCompact = density === "compact";
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [preferences, setPreferences] = useState(normalizeProfilePreferences(profile?.preferences));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

      setMessage("Workspace preferences updated.");
      onSaved?.();
      onNotify?.({
        type: "success",
        title: "Preferences saved",
        message: "Display settings and default workspace behavior were updated.",
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "The profile settings could not be saved.");
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: "Preferences failed",
        message: friendlyMessage,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`surface-card ${isCompact ? "rounded-[24px] p-5 md:p-6" : "rounded-[28px] p-6 md:p-8"}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="panel-heading">Settings</h2>
        </div>
      </div>

      <form className="mt-8 grid gap-5 xl:grid-cols-2" onSubmit={handleSave}>
        <SettingsBlock
          eyebrow="Identity"
          title="Workspace label"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
              placeholder="How should the workspace greet you?"
            />
          </label>
        </SettingsBlock>

        <SettingsBlock
          eyebrow="Entry point"
          title="Default destination"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Default view</span>
            <select
              value={preferences.documentView}
              onChange={(event) => setPreferences((current) => ({ ...current, documentView: event.target.value }))}
              className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
            >
              {PROFILE_DEFAULT_VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </SettingsBlock>

        <SettingsBlock
          eyebrow="Appearance"
          title="Reading environment"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Card density</span>
            <select
              value={preferences.dashboardDensity}
              onChange={(event) => setPreferences((current) => ({ ...current, dashboardDensity: event.target.value }))}
              className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
            >
              {PROFILE_DENSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Theme mode</span>
            <select
              value={preferences.themeMode}
              onChange={(event) => setPreferences((current) => ({ ...current, themeMode: event.target.value }))}
              className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
            >
              {PROFILE_THEME_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Theme accent</span>
            <select
              value={preferences.themeAccent}
              onChange={(event) => setPreferences((current) => ({ ...current, themeAccent: event.target.value }))}
              className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
            >
              {PROFILE_THEME_ACCENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </SettingsBlock>

        <SettingsBlock
          eyebrow="Feedback"
          title="Notification behavior"
        >
          <label className="surface-soft flex items-start gap-3 rounded-[20px] px-4 py-4">
            <input
              type="checkbox"
              checked={preferences.notificationsEnabled}
              onChange={(event) => setPreferences((current) => ({ ...current, notificationsEnabled: event.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Enable in-app notifications</span>
            </span>
          </label>
        </SettingsBlock>

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 xl:col-span-2">
            {errorMessage}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="button-primary rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 xl:col-span-2 xl:w-fit"
        >
          {saving ? "Saving workspace..." : "Save workspace settings"}
        </button>
      </form>
    </section>
  );
}
