"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { exportDocuments } from "@/lib/exportDocuments";
import { buildSearchableDocumentText, getModeLabel, getSourceLabel } from "@/lib/documents";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

const filterOptions = [
  { key: "active", label: "Active" },
  { key: "favorites", label: "Favorites" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

const exportFormatOptions = [
  { value: "txt", label: ".txt" },
  { value: "docx", label: ".docx" },
  { value: "pdf", label: ".pdf" },
];

function formatDocumentDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function truncateText(value, maxLength = 180) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function getEmptyStateCopy(filterKey) {
  if (filterKey === "favorites") {
    return {
      title: "No favorites yet",
      description: "",
    };
  }

  if (filterKey === "archived") {
    return {
      title: "Archive is empty",
      description: "",
    };
  }

  if (filterKey === "all") {
    return {
      title: "No saved documents yet",
      description: "",
    };
  }

  return {
    title: "No active documents",
    description: "",
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
      {(document.tags || []).slice(0, 3).map((tag) => (
        <span key={tag} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
          #{tag}
        </span>
      ))}
    </div>
  );
}

export function DocumentsPanel({
  documents,
  loading,
  errorMessage,
  supabase,
  onDocumentsChanged,
  onNotify,
  onCreateFirstDocument,
  variant = "full",
  density = "comfortable",
  focusSearchSignal = 0,
}) {
  const isCompact = variant === "compact";
  const isDense = density === "compact";
  const searchInputRef = useRef(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("active");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyActionKey, setBusyActionKey] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("txt");
  const deferredSearch = useDeferredValue(searchValue);

  useEffect(() => {
    if (!isCompact && focusSearchSignal > 0) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [focusSearchSignal, isCompact]);

  useEffect(() => {
    if (!previewDocument && !deleteTarget) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPreviewDocument(null);
        setDeleteTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, previewDocument]);

  const visibleDocuments = useMemo(
    () =>
      documents
        .filter((document) => {
          if (isCompact) {
            return !document.is_archived;
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
        .filter((document) => (sourceFilter === "all" ? true : document.source_type === sourceFilter))
        .filter((document) => {
          if (!deferredSearch.trim()) {
            return true;
          }

          return buildSearchableDocumentText(document).includes(deferredSearch.trim().toLowerCase());
        }),
    [activeFilter, deferredSearch, documents, isCompact, sourceFilter],
  );

  useEffect(() => {
    setSelectedIds((currentIds) => {
      const nextIds = currentIds.filter((id) => visibleDocuments.some((document) => document.id === id));
      return arraysEqual(currentIds, nextIds) ? currentIds : nextIds;
    });
  }, [visibleDocuments]);

  const selectedDocuments = documents.filter((document) => selectedIds.includes(document.id));
  const emptyCopy = getEmptyStateCopy(activeFilter);

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
      const message = "Supabase is not connected yet. Refresh the page and try again.";
      setActionError(message);
      onNotify?.({ type: "error", title: "Connection missing", message });
      return;
    }

    setBusyActionKey(actionKey);
    resetMessages();

    try {
      await work();
      await onDocumentsChanged?.();
      setActionMessage(successMessage);
      onNotify?.({ type: "success", title: "Library updated", message: successMessage });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "The document update could not be completed.");
      setActionError(friendlyMessage);
      onNotify?.({ type: "error", title: "Document update failed", message: friendlyMessage });
    } finally {
      setBusyActionKey("");
    }
  }

  async function handleCopyBraille(documentToCopy) {
    try {
      await navigator.clipboard.writeText(documentToCopy.braille_text);
      setActionError("");
      setActionMessage(`Braille copied from ${documentToCopy.file_name}.`);
      onNotify?.({
        type: "success",
        title: "Braille copied",
        message: `${documentToCopy.file_name} was copied to the clipboard.`,
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "Clipboard access is blocked in this browser tab.");
      setActionError(friendlyMessage);
      setActionMessage("");
      onNotify?.({
        type: "error",
        title: "Clipboard blocked",
        message: friendlyMessage,
      });
    }
  }

  async function handleToggleFavorite(documentToUpdate) {
    await runDocumentMutation(
      `favorite:${documentToUpdate.id}`,
      async () => {
        const { error } = await supabase
          .from("documents")
          .update({ is_favorite: !documentToUpdate.is_favorite })
          .eq("id", documentToUpdate.id);

        if (error) {
          throw error;
        }
      },
      documentToUpdate.is_favorite ? "Document removed from favorites." : "Document added to favorites.",
    );
  }

  async function handleToggleArchive(documentToUpdate) {
    await runDocumentMutation(
      `archive:${documentToUpdate.id}`,
      async () => {
        const nextArchivedState = !documentToUpdate.is_archived;
        const { error } = await supabase
          .from("documents")
          .update({
            is_archived: nextArchivedState,
            archived_at: nextArchivedState ? new Date().toISOString() : null,
          })
          .eq("id", documentToUpdate.id);

        if (error) {
          throw error;
        }
      },
      documentToUpdate.is_archived ? "Document restored to the active library." : "Document moved to the archive.",
    );
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
    setPreviewDocument(null);
  }

  async function handleExportDocuments(itemsToExport, format = selectedExportFormat) {
    if (!itemsToExport.length) {
      return;
    }

    setBusyActionKey("export");
    resetMessages();

    try {
      await exportDocuments(itemsToExport, format);
      const message =
        itemsToExport.length === 1
          ? `${itemsToExport[0].file_name} exported as ${format.toUpperCase()}.`
          : `${itemsToExport.length} documents exported as ${format.toUpperCase()}.`;
      setActionMessage(message);
      onNotify?.({
        type: "success",
        title: "Export complete",
        message,
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "The export could not be completed.");
      setActionError(friendlyMessage);
      onNotify?.({
        type: "error",
        title: "Export failed",
        message: friendlyMessage,
      });
    } finally {
      setBusyActionKey("");
    }
  }

  return (
    <section className={`surface-card ${isDense ? "rounded-[24px] p-5 md:p-6" : "rounded-[28px] p-6 md:p-8"}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 md:text-[2.8rem]">
            {isCompact ? "Recent documents" : "Library"}
          </h2>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}

      {actionError ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</p>
      ) : null}

      {actionMessage ? <p className="info-chip mt-4 rounded-2xl px-4 py-3 text-sm font-semibold">{actionMessage}</p> : null}

      {loading ? (
        <div className="mt-8 grid gap-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && documents.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-white p-8">
          <p className="text-2xl font-bold text-slate-950">Create your first Braille library entry</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCreateFirstDocument}
              className="button-primary rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Open conversion workspace
            </button>
          </div>
        </div>
      ) : null}

      {!loading && documents.length > 0 ? (
        <div className="mt-8 space-y-6">
          {!isCompact ? (
            <>
              <div className="surface-muted rounded-[24px] p-4 md:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <label className="text-sm font-semibold text-slate-700" htmlFor="document-search">
                      Search library
                    </label>
                    <input
                      ref={searchInputRef}
                      id="document-search"
                      type="search"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search by title, source text, Braille output, or tags"
                      className="field-input mt-2 w-full rounded-2xl px-4 py-3 text-slate-950 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700" htmlFor="source-filter">
                      Source
                    </label>
                    <select
                      id="source-filter"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      className="field-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition"
                    >
                      <option value="all">All sources</option>
                      <option value="manual">Manual / TXT</option>
                      <option value="pdf">PDF</option>
                      <option value="image">Image OCR</option>
                      <option value="camera">Camera OCR</option>
                      <option value="word-addin">Word Add-in</option>
                    </select>
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
                <div className="surface-muted rounded-[24px] p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
                      <select
                        value={selectedExportFormat}
                        onChange={(event) => setSelectedExportFormat(event.target.value)}
                        className="field-input rounded-full px-4 py-2 outline-none transition"
                      >
                        {exportFormatOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleExportDocuments(selectedDocuments)}
                        disabled={Boolean(busyActionKey)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "bulk" })}
                        disabled={Boolean(busyActionKey)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {visibleDocuments.length > 0 ? (
                <div className="flex items-center justify-start gap-3">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                  >
                    {selectedIds.length === visibleDocuments.length ? "Clear selection" : "Select visible"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {visibleDocuments.length > 0 ? (
            <div className="grid gap-4">
              {visibleDocuments.map((documentToRender) => (
                <article
                  key={documentToRender.id}
                  className="rounded-[24px] border border-slate-200 bg-white/92 p-5 transition hover:border-violet-200"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex flex-1 gap-3">
                        {!isCompact ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(documentToRender.id)}
                            onChange={() => toggleSelection(documentToRender.id)}
                            className="mt-2 h-4 w-4 rounded border-slate-300 text-violet-600"
                          />
                        ) : null}

                        <div className="min-w-0">
                          <h3 className="truncate text-2xl font-bold text-slate-950">{documentToRender.file_name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{formatDocumentDate(documentToRender.created_at)}</p>
                          <DocumentBadges document={documentToRender} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopyBraille(documentToRender)}
                          className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(documentToRender)}
                          disabled={busyActionKey === `favorite:${documentToRender.id}`}
                          className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                        >
                          {documentToRender.is_favorite ? "Unfavorite" : "Favorite"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(documentToRender)}
                          disabled={busyActionKey === `archive:${documentToRender.id}`}
                          className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                        >
                          {documentToRender.is_archived ? "Restore" : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "single", ...documentToRender })}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewDocument(documentToRender)}
                      className="surface-muted rounded-[22px] p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="accent-label text-xs font-semibold uppercase tracking-[0.22em]">Braille preview</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Click to inspect full text
                        </span>
                      </div>
                      <p className="mt-3 break-all text-lg leading-8 text-slate-950">
                        {truncateText(documentToRender.braille_text, 190)}
                      </p>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !isCompact && (
              <div className="rounded-[24px] border border-dashed border-violet-200 bg-white/90 p-8 text-center">
                <p className="text-2xl font-bold text-slate-950">{emptyCopy.title}</p>
              </div>
            )
          )}
        </div>
      ) : null}

      {previewDocument ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/32 px-4 py-4 backdrop-blur-sm md:px-6 md:py-8"
          onClick={() => setPreviewDocument(null)}
        >
          <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              className="surface-card flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[30px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-200 px-5 py-5 md:px-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Document Review</p>
                    <h3 className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                      {previewDocument.file_name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">{formatDocumentDate(previewDocument.created_at)}</p>
                    <DocumentBadges document={previewDocument} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyBraille(previewDocument)}
                      className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                    >
                      Copy Braille
                    </button>
                    {exportFormatOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleExportDocuments([previewDocument], option.value)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                      >
                        Export {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPreviewDocument(null)}
                      className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
                <article className="flex min-h-0 flex-col border-b border-slate-200 px-5 py-5 lg:border-b-0 lg:border-r lg:px-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Original text</p>
                  <div className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap pr-1 text-base leading-7 text-slate-700">
                    {previewDocument.original_text}
                  </div>
                </article>

                <article className="flex min-h-0 flex-col px-5 py-5 lg:px-7">
                  <p className="accent-label text-xs font-semibold uppercase tracking-[0.2em]">Braille output</p>
                  <div className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap break-all pr-1 text-2xl leading-10 text-slate-950">
                    {previewDocument.braille_text}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/32 px-4 py-4 backdrop-blur-sm md:px-6 md:py-8"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="mx-auto flex min-h-full max-w-md items-center justify-center">
            <div
              className="surface-card w-full rounded-[28px] p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Delete Conversion</p>
              <h3 className="mt-3 text-3xl font-bold text-slate-950">
                {deleteTarget.type === "bulk" ? `${selectedIds.length} selected conversions` : deleteTarget.file_name}
              </h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                This permanently removes the saved source text, tags, and Braille output from your workspace history.
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
        </div>
      ) : null}
    </section>
  );
}
