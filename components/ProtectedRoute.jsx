"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoadingCard } from "@/components/LoadingCard";

export function ProtectedRoute({ children }) {
  const router = useRouter();
  const { user, loading, configError } = useAuth();

  useEffect(() => {
    if (!loading && !user && !configError) {
      router.replace("/login");
    }
  }, [configError, loading, router, user]);

  if (loading) {
    return <LoadingCard title="Loading your dashboard..." description="Checking your session." />;
  }

  if (configError) {
    return <LoadingCard title="Supabase setup needed" description={configError} />;
  }

  if (!user) {
    return <LoadingCard title="Redirecting..." description="Sending you to the login page." />;
  }

  return children;
}
