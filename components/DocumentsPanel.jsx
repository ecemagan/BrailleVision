"use client";

import { useDeferredValue, useEffect, useState } from "react";

function formatDocumentDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadBrailleText(fileName, brailleText) {
  // The browser can generate the text file locally, so no API route is needed.
  const blob = new Blob([brailleText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.replace(/\.[^/.]+$/, "")}-braille.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function truncateText(value, maxLength = 180) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

export function DocumentsPanel({ documents, loading, errorMessage, supabase, onDocumentsChanged, variant = "full" }) {
  const isCompact = variant === "compact";
  const [searchValue, setSearchValue] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const deferredSearch = useDeferredValue(searchValue);

  const filteredDocuments = documents.filter((document) => {
    if (isCompact || !deferredSearch.trim()) {
      return true;
    }

    const query = deferredSearch.trim().toLowerCase();
    return [document.file_name, document.original_text, document.braille_text].some((field) =>
      field.toLowerCase().includes(query),
    );
  });

  useEffect(() => {
    if (filteredDocuments.length === 0) {
      setSelectedDocumentId(null);
      return;
    }

    if (!filteredDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(filteredDocuments[0].id);
    }
  }, [filteredDocuments, selectedDocumentId]);

  useEffect(() => {
    if (!deleteTarget) {
      document.body.style.overflow = "";
      return undefined;
    }

    // Lock background scrolling so the confirmation modal stays in view.
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [deleteTarget]);

  const selectedDocument =
    filteredDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? null;

  async function handleDeleteDocument() {
    if (!supabase || !deleteTarget) {
      setActionError("Connect Supabase before deleting a saved conversion.");
      return;
    }

    setDeletingId(deleteTarget.id);
    setActionError("");
    setActionMessage("");

    const { error } = await supabase.from("documents").delete().eq("id", deleteTarget.id);

    if (error) {
      setActionError(error.message || "Could not delete the selected document.");
      setDeletingId("");
      return;
    }

    // Refresh the list after deletion so the dashboard summary stays in sync.
    if (onDocumentsChanged) {
      await onDocumentsChanged();
    }

    setDeleteTarget(null);
    setDeletingId("");
    setActionMessage("Saved conversion deleted.");
  }

  async function handleCopyBraille(document) {
    try {
      await navigator.clipboard.writeText(document.braille_text);
      setActionError("");
      setActionMessage(`Braille copied from ${document.file_name}.`);
    } catch {
      setActionError("Clipboard access is blocked in this browser.");
      setActionMessage("");
    }
  }

  return (
    <section className="surface-card rounded-[28px] p-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">
            {isCompact ? "Recent Documents" : "My Documents"}
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold text-slate-950">
            {isCompact ? "Latest saved conversions" : "Conversion library"}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-600">
          {isCompact
            ? "Your latest saved conversions from the documents table."
            : "Search, preview, export, copy, and remove saved conversions with a polished workspace flow."}
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {actionError ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-700">
          {actionMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-8 grid gap-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && documents.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-display text-2xl font-bold text-slate-950">No saved documents yet</p>
          <p className="mt-2 text-slate-600">Use the upload tab to create and save your first Braille conversion.</p>
        </div>
      ) : null}

      {!loading && filteredDocuments.length > 0 ? (
        <div className="mt-8 space-y-6">
          {!isCompact ? (
            <div className="surface-soft rounded-[24px] p-4 md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="document-search">
                    Search saved conversions
                  </label>
                  <input
                    id="document-search"
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search by file name, source text, or Braille output"
                    className="field-input rounded-2xl px-4 py-3 text-slate-950 outline-none transition"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Results</p>
                    <p className="mt-2 font-display text-2xl font-bold text-slate-950">{filteredDocuments.length}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Latest sync</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {formatDocumentDate(filteredDocuments[0].created_at)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Workspace</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Copy, export, delete</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className={isCompact ? "grid gap-4" : "grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]"}>
            <div className="grid gap-4">
              {filteredDocuments.map((document) => {
                const isSelected = document.id === selectedDocument?.id;

                return (
                  <article
                    key={document.id}
                    className={`rounded-[24px] border p-5 transition ${
                      isSelected && !isCompact
                        ? "border-violet-300 bg-white shadow-[0_24px_60px_rgba(124,58,237,0.12)]"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-2xl font-bold text-slate-950">{document.file_name}</h3>
                            {!isCompact ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDocumentId(document.id)}
                                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                              >
                                {isSelected ? "Focused" : "Open"}
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatDocumentDate(document.created_at)}</p>
                          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                            {truncateText(document.original_text)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <button
                            type="button"
                            onClick={() => downloadBrailleText(document.file_name, document.braille_text)}
                            className="button-primary rounded-full px-4 py-3 text-sm font-semibold transition"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyBraille(document)}
                            className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
                          >
                            Copy Braille
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(document)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[auto_auto_1fr]">
                        <div className="rounded-2xl bg-violet-50/80 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Characters</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">{document.original_text.length}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Lines</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {document.original_text.split(/\n+/).filter(Boolean).length || 1}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-violet-50/70 p-4">
                          <p className="accent-label text-xs font-semibold uppercase tracking-[0.22em]">Braille preview</p>
                          <p className="mt-3 break-all text-lg text-slate-950">{truncateText(document.braille_text, 110)}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!isCompact && selectedDocument ? (
              <aside className="surface-soft rounded-[28px] p-5 lg:sticky lg:top-6 lg:self-start">
                <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Focused Preview</p>
                <h3 className="font-display mt-3 text-3xl font-bold text-slate-950">{selectedDocument.file_name}</h3>
                <p className="mt-2 text-sm text-slate-500">{formatDocumentDate(selectedDocument.created_at)}</p>

                <div className="mt-5 rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(216,180,254,0.42),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,255,0.92))] p-5 shadow-[0_24px_60px_rgba(124,58,237,0.14)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Original text</p>
                  <p className="mt-3 text-base leading-7 text-slate-700">{truncateText(selectedDocument.original_text, 360)}</p>

                  <div className="mt-5 rounded-[20px] border border-violet-100 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Braille output</p>
                    <p className="mt-3 break-all text-xl leading-8 text-slate-950">{selectedDocument.braille_text}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadBrailleText(selectedDocument.file_name, selectedDocument.braille_text)}
                    className="button-primary rounded-full px-4 py-3 text-sm font-semibold transition"
                  >
                    Download .txt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyBraille(selectedDocument)}
                    className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedDocument)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !isCompact && documents.length > 0 && filteredDocuments.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-violet-200 bg-white/90 p-8 text-center">
          <p className="font-display text-2xl font-bold text-slate-950">No matches for this search</p>
          <p className="mt-2 text-slate-600">Try another file name, a word from the source text, or part of the Braille output.</p>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/35 px-4 py-6 backdrop-blur-sm md:py-12">
          <div className="surface-card mt-0 w-full max-w-md rounded-[28px] p-6">
            <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Delete Conversion</p>
            <h3 className="font-display mt-3 text-3xl font-bold text-slate-950">{deleteTarget.file_name}</h3>
            <p className="mt-3 text-base leading-7 text-slate-600">
              This permanently removes the saved source text and Braille output from your library. Download it first if you
              want to keep a local copy.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deletingId === deleteTarget.id}
                className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
