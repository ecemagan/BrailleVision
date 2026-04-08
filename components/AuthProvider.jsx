"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const AuthContext = createContext({
  supabase: null,
  user: null,
  session: null,
  loading: true,
  configError: "",
});

export function AuthProvider({ children }) {
  const [supabase, setSupabase] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    let ignore = false;
    let subscription;

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
          setLoading(false);
        }

        const listener = client.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          setLoading(false);
        });

        subscription = listener.data.subscription;
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

  const value = {
    supabase,
    session,
    user: session?.user ?? null,
    loading,
    configError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
