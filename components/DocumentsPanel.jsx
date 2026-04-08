"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

const filterOptions = [
  { key: "active", label: "Active" },
  { key: "favorites", label: "Favorites" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

function formatDocumentDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadBrailleText(fileName, brailleText) {
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

function getSourceLabel(sourceType) {
  const labels = {
    manual: "Manual / TXT",
    pdf: "PDF",
    image: "Image OCR",
    camera: "Camera OCR",
    "word-addin": "Word Add-in",
  };

  return labels[sourceType] || "Manual / TXT";
}

function getModeLabel(conversionMode) {
  const labels = {
    text: "Text",
    nemeth: "Nemeth",
    ocr: "OCR",
  };

  return labels[conversionMode] || "Text";
}

function getEmptyStateCopy(filterKey) {
  if (filterKey === "favorites") {
    return {
      title: "No favorites yet",
      description: "Star important conversions to keep them pinned here for quick access.",
    };
  }

  if (filterKey === "archived") {
    return {
      title: "Archive is empty",
      description: "Archived conversions will appear here after you move them out of the active library.",
    };
  }

  if (filterKey === "all") {
    return {
      title: "No saved documents yet",
      description: "Use the upload tab or the Word add-in to create and save your first Braille conversion.",
    };
  }

  return {
    title: "No active documents",
    description: "Your active library is empty. Upload new content or restore items from the archive.",
  };
}

function DocumentBadges({ document }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
        {getSourceLabel(document.source_type)}
      </span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {getModeLabel(document.conversion_mode)}
      </span>
      {document.is_favorite ? (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Favorite</span>
      ) : null}
      {document.is_archived ? (
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Archived</span>
      ) : null}
    </div>
  );
}

export function DocumentsPanel({ documents, loading, errorMessage, supabase, onDocumentsChanged, variant = "full" }) {
  const isCompact = variant === "compact";
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("active");
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [renameTargetId, setRenameTargetId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyActionKey, setBusyActionKey] = useState("");
  const deferredSearch = useDeferredValue(searchValue);

  const visibleDocuments = documents
    .filter((document) => {
      if (isCompact) {
        return true;
      }

      if (activeFilter === "favorites") {
        return document.is_favorite && !document.is_archived;
      }

      if (activeFilter === "archived") {
        return document.is_archived;
      }

      if (activeFilter === "all") {
        return true;
      }

      return !document.is_archived;
    })
    .filter((document) => {
      if (!deferredSearch.trim()) {
        return true;
      }

      const query = deferredSearch.trim().toLowerCase();

      return [
        document.file_name,
        document.original_text,
        document.braille_text,
        document.source_type,
        document.conversion_mode,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query));
    });

  useEffect(() => {
    if (visibleDocuments.length === 0) {
      setSelectedDocumentId(null);
      setSelectedIds([]);
      return;
    }

    if (!visibleDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(visibleDocuments[0].id);
    }

    setSelectedIds((currentIds) => currentIds.filter((id) => visibleDocuments.some((document) => document.id === id)));
  }, [visibleDocuments, selectedDocumentId]);

  useEffect(() => {
    if (!deleteTarget) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [deleteTarget]);

  const selectedDocument =
    visibleDocuments.find((document) => document.id === selectedDocumentId) ?? visibleDocuments[0] ?? null;
  const selectedDocuments = documents.filter((document) => selectedIds.includes(document.id));
  const favoriteCount = documents.filter((document) => document.is_favorite && !document.is_archived).length;
  const archivedCount = documents.filter((document) => document.is_archived).length;
  const activeCount = documents.filter((document) => !document.is_archived).length;

  function resetMessages() {
    setActionError("");
    setActionMessage("");
  }

  function toggleSelection(documentId) {
    setSelectedIds((currentIds) =>
      currentIds.includes(documentId) ? currentIds.filter((id) => id !== documentId) : [...currentIds, documentId],
    );
  }

  function selectAllVisible() {
    if (selectedIds.length === visibleDocuments.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(visibleDocuments.map((document) => document.id));
  }

  async function runDocumentMutation(actionKey, work, successMessage) {
    if (!supabase) {
      setActionError("Supabase is not connected yet. Refresh the page and try again.");
      return;
    }

    setBusyActionKey(actionKey);
    resetMessages();

    try {
      await work();
      await onDocumentsChanged?.();
      setActionMessage(successMessage);
    } catch (error) {
      setActionError(getFriendlyDocumentMessage(error, "The document update could not be completed."));
    } finally {
      setBusyActionKey("");
    }
  }

  async function handleCopyBraille(document) {
    try {
      await navigator.clipboard.writeText(document.braille_text);
      setActionError("");
      setActionMessage(`Braille copied from ${document.file_name}.`);
    } catch (error) {
      setActionError(getFriendlyDocumentMessage(error, "Clipboard access is blocked in this browser tab."));
      setActionMessage("");
    }
  }

  async function handleToggleFavorite(document) {
    await runDocumentMutation(
      `favorite:${document.id}`,
      async () => {
        const { error } = await supabase
          .from("documents")
          .update({ is_favorite: !document.is_favorite })
          .eq("id", document.id);

        if (error) {
          throw error;
        }
      },
      document.is_favorite ? "Document removed from favorites." : "Document added to favorites.",
    );
  }

  async function handleToggleArchive(document) {
    await runDocumentMutation(
      `archive:${document.id}`,
      async () => {
        const nextArchivedState = !document.is_archived;
        const { error } = await supabase
          .from("documents")
          .update({
            is_archived: nextArchivedState,
            archived_at: nextArchivedState ? new Date().toISOString() : null,
          })
          .eq("id", document.id);

        if (error) {
          throw error;
        }
      },
      document.is_archived ? "Document restored to the active library." : "Document moved to the archive.",
    );
  }

  async function handleRename(document) {
    if (!renameValue.trim()) {
      setActionError("Enter a file name before saving the rename.");
      return;
    }

    await runDocumentMutation(
      `rename:${document.id}`,
      async () => {
        const { error } = await supabase
          .from("documents")
          .update({ file_name: renameValue.trim() })
          .eq("id", document.id);

        if (error) {
          throw error;
        }
      },
      "Document name updated.",
    );

    setRenameTargetId("");
    setRenameValue("");
  }

  async function handleBulkArchive() {
    if (selectedIds.length === 0) {
      return;
    }

    const shouldArchive = selectedDocuments.some((document) => !document.is_archived);

    await runDocumentMutation(
      "bulk-archive",
      async () => {
        const { error } = await supabase
          .from("documents")
          .update({
            is_archived: shouldArchive,
            archived_at: shouldArchive ? new Date().toISOString() : null,
          })
          .in("id", selectedIds);

        if (error) {
          throw error;
        }
      },
      shouldArchive ? "Selected documents moved to the archive." : "Selected documents restored from the archive.",
    );

    setSelectedIds([]);
  }

  async function handleBulkFavorite() {
    if (selectedIds.length === 0) {
      return;
    }

    const shouldFavorite = selectedDocuments.some((document) => !document.is_favorite);

    await runDocumentMutation(
      "bulk-favorite",
      async () => {
        const { error } = await supabase
          .from("documents")
          .update({ is_favorite: shouldFavorite })
          .in("id", selectedIds);

        if (error) {
          throw error;
        }
      },
      shouldFavorite ? "Selected documents added to favorites." : "Selected documents removed from favorites.",
    );
  }

  async function handleDeleteDocuments() {
    const idsToDelete = deleteTarget?.type === "bulk" ? selectedIds : deleteTarget ? [deleteTarget.id] : [];

    if (idsToDelete.length === 0) {
      return;
    }

    await runDocumentMutation(
      "delete",
      async () => {
        const { error } = await supabase.from("documents").delete().in("id", idsToDelete);

        if (error) {
          throw error;
        }
      },
      idsToDelete.length === 1 ? "Saved conversion deleted." : `${idsToDelete.length} saved conversions deleted.`,
    );

    setDeleteTarget(null);
    setSelectedIds([]);
  }

  const emptyCopy = getEmptyStateCopy(activeFilter);

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
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          {isCompact
            ? "Your latest active conversions from the documents table."
            : "Rename, favorite, archive, restore, and bulk-manage saved conversions without leaving the dashboard."}
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
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-slate-200" />
                <div className="h-4 w-44 rounded bg-slate-200" />
              </div>
              <div className="mt-4 h-3 w-32 rounded bg-slate-100" />
              <div className="mt-4 grid gap-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && documents.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-display text-2xl font-bold text-slate-950">No saved documents yet</p>
          <p className="mt-2 text-slate-600">
            Use the upload tab or the Word add-in to create, save, and manage your first Braille conversion.
          </p>
        </div>
      ) : null}

      {!loading && documents.length > 0 ? (
        <div className="mt-8 space-y-6">
          {!isCompact ? (
            <>
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
                      placeholder="Search by file name, source text, Braille output, source type, or mode"
                      className="field-input rounded-2xl px-4 py-3 text-slate-950 outline-none transition"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Active</p>
                      <p className="mt-2 font-display text-2xl font-bold text-slate-950">{activeCount}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Favorites</p>
                      <p className="mt-2 font-display text-2xl font-bold text-slate-950">{favoriteCount}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/60 bg-white/75 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Archived</p>
                      <p className="mt-2 font-display text-2xl font-bold text-slate-950">{archivedCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActiveFilter(option.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeFilter === option.key ? "button-primary text-white" : "button-secondary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedIds.length > 0 ? (
                <div className="surface-card rounded-[24px] border border-violet-200 bg-violet-50/65 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-semibold text-violet-800">
                      {selectedIds.length} document{selectedIds.length > 1 ? "s" : ""} selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleBulkFavorite}
                        disabled={Boolean(busyActionKey)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                      >
                        Toggle favorite
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkArchive}
                        disabled={Boolean(busyActionKey)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                      >
                        Archive / Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "bulk" })}
                        disabled={Boolean(busyActionKey)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition disabled:opacity-60"
                      >
                        Bulk delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {!isCompact && visibleDocuments.length > 0 ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={selectAllVisible}
                className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
              >
                {selectedIds.length === visibleDocuments.length ? "Clear selection" : "Select visible"}
              </button>
              <p className="text-sm text-slate-600">{visibleDocuments.length} documents match this view.</p>
            </div>
          ) : null}

          {visibleDocuments.length > 0 ? (
            <div className={isCompact ? "grid gap-4" : "grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]"}>
              <div className="grid gap-4">
                {visibleDocuments.map((document) => {
                  const isSelected = document.id === selectedDocument?.id;
                  const isRenaming = renameTargetId === document.id;

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
                          <div className="flex flex-1 gap-3">
                            {!isCompact ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(document.id)}
                                onChange={() => toggleSelection(document.id)}
                                className="mt-2 h-4 w-4 rounded border-slate-300 text-violet-600"
                              />
                            ) : null}

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {isRenaming ? (
                                  <>
                                    <input
                                      value={renameValue}
                                      onChange={(event) => setRenameValue(event.target.value)}
                                      className="field-input rounded-2xl px-4 py-2 text-base font-semibold outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRename(document)}
                                      disabled={busyActionKey === `rename:${document.id}`}
                                      className="button-primary rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRenameTargetId("");
                                        setRenameValue("");
                                      }}
                                      className="button-secondary rounded-full px-3 py-2 text-xs font-semibold transition"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <h3 className="font-display truncate text-2xl font-bold text-slate-950">{document.file_name}</h3>
                                    {!isCompact ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedDocumentId(document.id)}
                                        className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                                      >
                                        {isSelected ? "Focused" : "Open"}
                                      </button>
                                    ) : null}
                                  </>
                                )}
                              </div>

                              <p className="mt-1 text-sm text-slate-500">{formatDocumentDate(document.created_at)}</p>
                              <DocumentBadges document={document} />
                              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                                {truncateText(document.original_text)}
                              </p>
                            </div>
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
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(document)}
                              disabled={busyActionKey === `favorite:${document.id}`}
                              className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                            >
                              {document.is_favorite ? "Unfavorite" : "Favorite"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(document)}
                              disabled={busyActionKey === `archive:${document.id}`}
                              className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                            >
                              {document.is_archived ? "Restore" : "Archive"}
                            </button>
                            {!isRenaming ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameTargetId(document.id);
                                  setRenameValue(document.file_name);
                                }}
                                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
                              >
                                Rename
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: "single", ...document })}
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
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Updated</p>
                            <p className="mt-2 text-sm font-semibold text-slate-950">
                              {formatDocumentDate(document.updated_at || document.created_at)}
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
                  <DocumentBadges document={selectedDocument} />

                  <div className="mt-5 rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(216,180,254,0.42),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,255,0.92))] p-5 shadow-[0_24px_60px_rgba(124,58,237,0.14)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Original text</p>
                    <p className="mt-3 text-base leading-7 text-slate-700">{truncateText(selectedDocument.original_text, 360)}</p>

                    <div className="mt-5 rounded-[20px] border border-violet-100 bg-white/90 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Braille output</p>
                      <p className="mt-3 break-all text-xl leading-8 text-slate-950">{selectedDocument.braille_text}</p>
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          ) : (
            !isCompact && (
              <div className="rounded-[24px] border border-dashed border-violet-200 bg-white/90 p-8 text-center">
                <p className="font-display text-2xl font-bold text-slate-950">{emptyCopy.title}</p>
                <p className="mt-2 text-slate-600">{emptyCopy.description}</p>
              </div>
            )
          )}
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/35 px-4 py-6 backdrop-blur-sm md:py-12">
          <div className="surface-card mt-0 w-full max-w-md rounded-[28px] p-6">
            <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Delete Conversion</p>
            <h3 className="font-display mt-3 text-3xl font-bold text-slate-950">
              {deleteTarget.type === "bulk"
                ? `${selectedIds.length} selected conversions`
                : deleteTarget.file_name}
            </h3>
            <p className="mt-3 text-base leading-7 text-slate-600">
              This permanently removes the saved source text and Braille output from your workspace history. Download a copy
              first if you want to keep it locally.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busyActionKey)}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocuments}
                disabled={busyActionKey === "delete"}
                className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyActionKey === "delete" ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
