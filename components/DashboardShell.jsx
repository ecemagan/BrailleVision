"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { Sidebar } from "@/components/Sidebar";
import { UploadPanel } from "@/components/UploadPanel";
import { useAuth } from "@/components/AuthProvider";

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
  const { supabase, user } = useAuth();
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
      .select("id, file_name, original_text, braille_text, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDocumentsError(error.message || "Could not load documents.");
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

  return (
    <main className="page-shell">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <Sidebar activeTab={activeTab} onLogout={handleLogout} userEmail={user?.email || "Authenticated user"} />

        <section className="space-y-6">
          {activeTab === "overview" ? (
            <>
              <div className="surface-card hero-wash rounded-[32px] p-6 md:p-8">
                <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Overview</p>
                <h1 className="font-display mt-3 text-4xl font-bold text-slate-950">Your Braille workspace</h1>
                <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
                  Upload new content, review saved results, and export Braille text for your own account.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <OverviewCard
                  label="Saved documents"
                  value={loadingDocuments ? "..." : String(documents.length)}
                  helper="Total conversions currently saved in Supabase."
                />
                <OverviewCard
                  label="Latest file"
                  value={latestDocument?.file_name || "No files yet"}
                  helper="Your most recent saved conversion."
                />
                <OverviewCard
                  label="Output mode"
                  value="Text + Nemeth"
                  helper="Plain text is converted to Grade 1 Braille and math-like lines use Nemeth symbols."
                />
              </div>

              <DocumentsPanel
                documents={documents.slice(0, 3)}
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
