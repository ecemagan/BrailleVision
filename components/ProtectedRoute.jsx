"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoadingCard } from "@/components/LoadingCard";
import { useI18n } from "@/components/I18nProvider";

export function ProtectedRoute({ children }) {
  const router = useRouter();
  const { user, loading, configError } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && !user && !configError) {
      router.replace("/");
    }
  }, [configError, loading, router, user]);

  if (loading) {
    return <LoadingCard title={t("auth.checkingSession")} description={t("auth.preparingAuthFlow")} />;
  }

  if (configError) {
    return <LoadingCard title={t("auth.supabaseSetupNeeded")} description={configError} />;
  }

  if (!user) {
    return <LoadingCard title={t("auth.redirecting")} description={t("auth.preparingAuthFlow")} />;
  }

  return children;
}
