"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getProfileRecord, upsertProfileRecord } from "@/lib/profiles";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

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
    }

    async function connectToSupabase() {
      try {
        // Create one browser client and hydrate the current auth session.
        const client = getSupabaseBrowserClient();
        if (ignore) {
          return;
        }

        setSupabase(client);

        const {
          data: { session: initialSession },
        } = await client.auth.getSession();

        if (!ignore) {
          setSession(initialSession);
        }

        await syncProfile(client, initialSession);

        if (!ignore) {
          setLoading(false);
        }

        const listener = client.auth.onAuthStateChange(async (_event, nextSession) => {
          setSession(nextSession);
          await syncProfile(client, nextSession);
          setLoading(false);
        });

        subscription = listener.data.subscription;
      } catch (error) {
        const isSchemaError = (error.message || "").toLowerCase().includes("profiles");

        if (!ignore) {
          setConfigError(
            isSchemaError
              ? "Supabase schema is incomplete. Re-run supabase/documents.sql in the SQL editor, then refresh the page."
              : error.message,
          );
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
        setConfigError("Profile data could not be refreshed. Re-run supabase/documents.sql and try again.");
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
