"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getProfileRecord, normalizeProfilePreferences, upsertProfileRecord } from "@/lib/profiles";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isInvalidRefreshTokenError } from "@/lib/userMessages";

const INITIAL_SESSION_TIMEOUT_MS = 3000;

const AuthContext = createContext({
  supabase: null,
  user: null,
  session: null,
  profile: null,
  loading: true,
  configError: "",
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [supabase, setSupabase] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    let ignore = false;
    let subscription;

    async function syncProfile(client, nextSession) {
      try {
        if (!nextSession?.user) {
          if (!ignore) {
            setProfile(null);
          }
          return;
        }

        const nextUser = nextSession.user;
        const profileRecord =
          (await getProfileRecord(client, nextUser.id).catch(() => null)) ??
          null;

        if (!profileRecord) {
          await upsertProfileRecord({
            supabase: client,
            userId: nextUser.id,
            email: nextUser.email,
            displayName: nextUser.user_metadata?.display_name,
            preferences: nextUser.user_metadata?.preferences,
          });
        }

        const freshProfile =
          (await getProfileRecord(client, nextUser.id).catch(() => null)) ??
          null;

        if (!ignore) {
          setProfile(freshProfile);
        }
      } catch (error) {
        console.warn("Profile sync skipped:", error);
        if (!ignore) {
          setProfile(null);
        }
      }
    }

    async function connectToSupabase() {
      try {
        // Create one browser client and hydrate the current auth session.
        const client = getSupabaseBrowserClient();
        if (ignore) {
          return;
        }

        setSupabase(client);

        const listener = client.auth.onAuthStateChange(async (_event, nextSession) => {
          if (ignore) {
            return;
          }

          setSession(nextSession);
          setLoading(false);
          void syncProfile(client, nextSession);
        });

        subscription = listener.data.subscription;

        const initialSessionResult = await Promise.race([
          client.auth.getSession(),
          new Promise((resolve) => {
            window.setTimeout(() => resolve({ data: { session: null }, timedOut: true }), INITIAL_SESSION_TIMEOUT_MS);
          }),
        ]);

        if (!initialSessionResult?.timedOut && isInvalidRefreshTokenError(initialSessionResult?.error)) {
          console.warn("Clearing an invalid stored Supabase session.");
          await client.auth.signOut({ scope: "local" });
        }

        const initialSession = initialSessionResult?.data?.session ?? null;

        if (!ignore) {
          setSession(initialSession);
          setLoading(false);
        }

        if (initialSessionResult?.timedOut) {
          console.warn("Initial session check timed out. The auth UI will stay usable while Supabase continues in the background.");
        }

        void syncProfile(client, initialSession);
      } catch (error) {
        if (!ignore) {
          setConfigError(error.message);
          setLoading(false);
        }
      }
    }

    connectToSupabase();

    return () => {
      ignore = true;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const preferences = normalizeProfilePreferences(profile?.preferences);
    document.documentElement.dataset.theme = preferences.themeMode;
    document.documentElement.dataset.accent = preferences.themeAccent;
    document.documentElement.dataset.density = preferences.dashboardDensity;

    try {
      window.localStorage.setItem("braillevision-theme", preferences.themeMode);
      window.localStorage.setItem("braillevision-accent", preferences.themeAccent);
      window.localStorage.setItem("braillevision-density", preferences.dashboardDensity);
    } catch {
      // no-op
    }
  }, [profile]);

  const value = {
    supabase,
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configError,
    refreshProfile: async () => {
      if (!supabase || !session?.user) {
        return;
      }

      try {
        const nextProfile = await getProfileRecord(supabase, session.user.id);
        setProfile(nextProfile);
      } catch {
        console.warn("Profile refresh skipped.");
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
