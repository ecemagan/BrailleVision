"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { LoadingCard } from "@/components/LoadingCard";
import { useI18n } from "@/components/I18nProvider";
import { useAuth } from "@/components/AuthProvider";
import { DEFAULT_PROFILE_PREFERENCES } from "@/lib/profiles";
import { getFriendlyAuthMessage } from "@/lib/userMessages";

export function AuthForm({ mode }) {
  const router = useRouter();
  const { supabase, user, loading, configError } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dashboardDensity, setDashboardDensity] = useState(DEFAULT_PROFILE_PREFERENCES.dashboardDensity);
  const [submitting, setSubmitting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [showLoadingFallback, setShowLoadingFallback] = useState(false);

  function isEmailConfirmationError(error) {
    return (error?.message || error?.detail || "").toLowerCase().includes("email not confirmed");
  }

  async function handleResendConfirmation() {
    setResendingConfirmation(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!supabase) {
        throw new Error(configError || t("auth.supabaseNotConfigured"));
      }

      if (!email.trim()) {
        throw new Error(t("auth.enterEmailFirst"));
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      if (error) {
        throw error;
      }

      setMessage(t("auth.confirmationResent"));
    } catch (error) {
      setErrorMessage(getFriendlyAuthMessage(error, t("auth.couldNotResend")));
    } finally {
      setResendingConfirmation(false);
    }
  }

  useEffect(() => {
    if (mode === "login" && !loading && user) {
      router.replace("/dashboard?tab=overview");
    }
  }, [loading, mode, router, user]);

  useEffect(() => {
    if (!loading) {
      setShowLoadingFallback(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLoadingFallback(true);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!supabase) {
        throw new Error(configError || t("auth.supabaseNotConfigured"));
      }

      // Supabase handles both email sign-up and password login directly from the browser.
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim() || undefined,
              preferences: {
                ...DEFAULT_PROFILE_PREFERENCES,
                dashboardDensity,
              },
            },
          },
        });

        if (error) {
          throw error;
        }

        setNeedsConfirmation(false);

        if (data?.session) {
          await supabase.auth.signOut();
          setMessage(t("auth.accountCreated"));
          router.replace("/");
        } else {
          setNeedsConfirmation(true);
          setMessage(t("auth.confirmEmail"));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (isEmailConfirmationError(error)) {
            setNeedsConfirmation(true);
          }

          throw error;
        }

        setNeedsConfirmation(false);
        router.replace("/dashboard?tab=overview");
      }
    } catch (error) {
      if (isEmailConfirmationError(error)) {
        setNeedsConfirmation(true);
      }

      setErrorMessage(getFriendlyAuthMessage(error, t("auth.authenticationFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !showLoadingFallback) {
    return <LoadingCard title={t("auth.checkingSession")} description={t("auth.preparingAuthFlow")} />;
  }

  const content =
    mode === "login"
      ? { title: t("auth.loginTitle"), subtitle: t("auth.loginSubtitle"), buttonLabel: t("auth.logIn"), footerText: t("auth.needAccount"), footerLink: "/register", footerLinkLabel: t("auth.createOne") }
      : { title: t("auth.registerTitle"), subtitle: t("auth.registerSubtitle"), buttonLabel: t("auth.createAccount"), footerText: t("auth.alreadyHaveAccount"), footerLink: "/login", footerLinkLabel: t("auth.logIn") };

  return (
    <main className="page-shell flex items-center justify-center">
      <section className="relative grid w-full max-w-5xl gap-6 pt-20 md:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
        <header className="absolute left-0 top-0 z-20">
          <BackButton />
        </header>

        <section className="surface-card hero-wash hidden rounded-2xl p-10 lg:block">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Braille Vision</p>
          <h1 className="font-display mt-4 text-5xl font-bold tracking-tight text-slate-950">
            {t("landing.headline")}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            {t("landing.subheadline")}
          </p>
        </section>

        <section className="surface-card rounded-2xl p-8 md:p-10">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">
            {mode === "login" ? t("auth.loginTitle") : t("auth.getStarted")}
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold text-slate-950">{content.title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">{content.subtitle}</p>

          {loading && showLoadingFallback ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {t("auth.sessionDelay")}
            </p>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">{t("settings.displayName")}</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                  placeholder={t("auth.displayNamePlaceholder")}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{t("auth.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                placeholder={t("auth.emailPlaceholder")}
                required
              />
            </label>

            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">{t("auth.workspaceDensity")}</span>
                <select
                  value={dashboardDensity}
                  onChange={(event) => setDashboardDensity(event.target.value)}
                  className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                >
                  <option value="comfortable">{t("settings.densityComfortable")}</option>
                  <option value="compact">{t("settings.densityCompact")}</option>
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{t("auth.password")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                placeholder={t("auth.passwordPlaceholder")}
                minLength={6}
                required
              />
            </label>

            {configError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {configError}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </p>
            ) : null}

            {needsConfirmation ? (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendingConfirmation}
                className="button-secondary w-full rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {resendingConfirmation ? t("common.resending") : t("auth.resendConfirmation")}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="button-primary w-full rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? t("common.pleaseWait") : content.buttonLabel}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            {content.footerText}{" "}
            <Link className="accent-label font-semibold hover:text-violet-700" href={content.footerLink}>
              {content.footerLinkLabel}
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
