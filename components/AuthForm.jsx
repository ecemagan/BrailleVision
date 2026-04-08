"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/LoadingCard";
import { useAuth } from "@/components/AuthProvider";

const authContent = {
  login: {
    title: "Log in to your dashboard",
    subtitle: "Access saved conversions, upload new documents, and manage your Braille output.",
    buttonLabel: "Log in",
    footerText: "Need an account?",
    footerLink: "/register",
    footerLinkLabel: "Create one",
  },
  register: {
    title: "Create your Braille Vision account",
    subtitle: "Sign up with email and password so each conversion stays linked to your own workspace.",
    buttonLabel: "Create account",
    footerText: "Already have an account?",
    footerLink: "/login",
    footerLinkLabel: "Log in",
  },
};

export function AuthForm({ mode }) {
  const router = useRouter();
  const { supabase, user, loading, configError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!supabase) {
        throw new Error(configError || "Supabase is not configured yet.");
      }

      // Supabase handles both email sign-up and password login directly from the browser.
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setMessage("Account created. If email confirmation is enabled, check your inbox before logging in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        router.replace("/dashboard");
      }
    } catch (error) {
      setErrorMessage(error.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingCard title="Checking session..." description="Preparing the authentication flow." />;
  }

  const content = authContent[mode];

  return (
    <main className="page-shell flex items-center justify-center">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card hero-wash hidden rounded-[32px] p-10 lg:block">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Braille Vision</p>
          <h1 className="font-display mt-4 text-5xl font-bold tracking-tight text-slate-950">
            Convert documents into Braille with a clear, secure workflow.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Supabase handles authentication and storage while the dashboard keeps uploads, results, and
            personal document history in one place.
          </p>
        </section>

        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">
            {mode === "login" ? "Welcome back" : "Get started"}
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold text-slate-950">{content.title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">{content.subtitle}</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                placeholder="Minimum 6 characters"
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

            <button
              type="submit"
              disabled={submitting}
              className="button-primary w-full rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Please wait..." : content.buttonLabel}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            {content.footerText}{" "}
            <Link className="accent-label font-semibold hover:text-violet-700" href={content.footerLink}>
              {content.footerLinkLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
