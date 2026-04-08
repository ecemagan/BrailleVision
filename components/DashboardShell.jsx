"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { Sidebar } from "@/components/Sidebar";
import { UploadPanel } from "@/components/UploadPanel";
import { useAuth } from "@/components/AuthProvider";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

function OverviewCard({ label, value, helper }) {
  return (
    <article className="surface-card rounded-[24px] p-5">
      <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">{label}</p>
      <h3 className="font-display mt-3 text-3xl font-bold text-slate-950">{value}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </article>
  );
}

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, user, profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const tabParam = searchParams.get("tab");
  const activeTab = ["overview", "upload", "documents"].includes(tabParam) ? tabParam : "overview";

  async function loadDocuments() {
    if (!supabase || !user) {
      return;
    }

    setLoadingDocuments(true);
    setDocumentsError("");

    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, file_name, original_text, braille_text, created_at, updated_at, source_type, conversion_mode, is_favorite, is_archived, archived_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDocumentsError(getFriendlyDocumentMessage(error, "Your saved conversions could not be loaded right now."));
      setDocuments([]);
      setLoadingDocuments(false);
      return;
    }

    setDocuments(data ?? []);
    setLoadingDocuments(false);
  }

  useEffect(() => {
    // Load the current user's saved documents whenever auth becomes available.
    loadDocuments();
  }, [supabase, user]);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  const latestDocument = documents[0];
  const activeDocuments = documents.filter((document) => !document.is_archived);
  const favoriteDocuments = documents.filter((document) => document.is_favorite && !document.is_archived);
  const archivedDocuments = documents.filter((document) => document.is_archived);

  return (
    <main className="page-shell">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <Sidebar
          activeTab={activeTab}
          onLogout={handleLogout}
          userEmail={user?.email || "Authenticated user"}
          profile={profile}
        />

        <section className="space-y-6">
          {activeTab === "overview" ? (
            <>
              <div className="surface-card hero-wash rounded-[32px] p-6 md:p-8">
                <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Overview</p>
                <h1 className="font-display mt-3 text-4xl font-bold text-slate-950">
                  {profile?.display_name ? `${profile.display_name}'s Braille workspace` : "Your Braille workspace"}
                </h1>
                <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
                  Upload new content, review saved results, manage favorites and archives, and export Braille text from one
                  organized workspace.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <OverviewCard
                  label="Active documents"
                  value={loadingDocuments ? "..." : String(activeDocuments.length)}
                  helper="Current conversions that are still in the active library."
                />
                <OverviewCard
                  label="Latest file"
                  value={latestDocument?.file_name || "No files yet"}
                  helper="Your most recent saved conversion."
                />
                <OverviewCard
                  label="Output mode"
                  value="Text + Nemeth + OCR"
                  helper="Plain text, math-like lines, and readable image text can all be converted into Braille."
                />
                <OverviewCard
                  label="Favorites / Archived"
                  value={loadingDocuments ? "..." : `${favoriteDocuments.length} / ${archivedDocuments.length}`}
                  helper="Quick view of pinned favorites and archived records."
                />
              </div>

              <div className="surface-card rounded-[28px] p-6 md:p-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Workspace Profile</p>
                    <h2 className="font-display mt-2 text-3xl font-bold text-slate-950">
                      {profile?.display_name || "Braille Vision member"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                      Role: {profile?.role || "member"}
                    </span>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                      Density: {profile?.preferences?.dashboardDensity || "comfortable"}
                    </span>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                      Default view: {profile?.preferences?.documentView || "library"}
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  Profiles are now stored in Supabase so each workspace can keep a display name, role, and presentation
                  preferences alongside the saved conversion history.
                </p>
              </div>

              <DocumentsPanel
                documents={activeDocuments.slice(0, 3)}
                loading={loadingDocuments}
                errorMessage={documentsError}
                supabase={supabase}
                onDocumentsChanged={loadDocuments}
                variant="compact"
              />
            </>
          ) : null}

          {activeTab === "upload" ? (
            <UploadPanel
              userId={user.id}
              supabase={supabase}
              onSaved={async () => {
                await loadDocuments();
                router.replace("/dashboard?tab=documents");
              }}
            />
          ) : null}

          {activeTab === "documents" ? (
            <DocumentsPanel
              documents={documents}
              loading={loadingDocuments}
              errorMessage={documentsError}
              supabase={supabase}
              onDocumentsChanged={loadDocuments}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
