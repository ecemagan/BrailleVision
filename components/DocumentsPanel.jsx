"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exportDocuments } from "@/lib/exportDocuments";
import { buildSearchableDocumentText } from "@/lib/documents";
import { useI18n } from "@/components/I18nProvider";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

function formatDocumentDate(value, locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
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

function getEmptyStateCopy(filterKey, t) {
  if (filterKey === "favorites") {
    return {
      title: t("documents.noFavorites"),
      description: "",
    };
  }

  if (filterKey === "archived") {
    return {
      title: t("documents.archiveEmpty"),
      description: "",
    };
  }

  if (filterKey === "all") {
    return {
      title: t("documents.noSavedDocuments"),
      description: "",
    };
  }

  return {
    title: t("documents.noActiveDocuments"),
    description: "",
  };
}

function getDocumentType(document) {
  if (document.source_type === "pdf") {
    return "pdf";
  }

  if (document.source_type === "image" || document.source_type === "camera") {
    return "image";
  }

  return "text";
}

function getDocumentTypeLabel(type, t) {
  if (type === "pdf") {
    return t("documents.typePdf");
  }

  if (type === "image") {
    return t("documents.typeImage");
  }

  return t("documents.typeText");
}

function getDateFilterMatch(document, dateFilter) {
  if (dateFilter === "all") {
    return true;
  }

  const createdAt = new Date(document.created_at).getTime();
  const now = Date.now();

  if (dateFilter === "today") {
    return createdAt >= now - 24 * 60 * 60 * 1000;
  }

  if (dateFilter === "7d") {
    return createdAt >= now - 7 * 24 * 60 * 60 * 1000;
  }

  if (dateFilter === "30d") {
    return createdAt >= now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

function DocumentBadges({ document, t }) {
  const documentType = getDocumentType(document);
  const isMath = document.conversion_mode === "nemeth";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
        {getDocumentTypeLabel(documentType, t)}
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isMath ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {isMath ? t("documents.modeMath") : t("documents.modeText")}
      </span>
      {document.is_favorite ? (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{t("documents.favorite")}</span>
      ) : null}
      {document.is_archived ? (
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{t("documents.archived")}</span>
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
  const { t, locale } = useI18n();
  const searchInputRef = useRef(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("active");
  const [dateFilter, setDateFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDocumentId, setPreviewDocumentId] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyActionKey, setBusyActionKey] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("txt");
  const flaggedIndices = [2, 7, 12];
  const deferredSearch = useDeferredValue(searchValue);
  const filterOptions = [
    { key: "active", label: t("documents.active") },
    { key: "favorites", label: t("documents.favorites") },
    { key: "archived", label: t("documents.archived") },
    { key: "all", label: t("documents.all") },
  ];
  const dateFilterOptions = [
    { key: "all", label: t("documents.dateAll") },
    { key: "today", label: t("documents.dateToday") },
    { key: "7d", label: t("documents.date7Days") },
    { key: "30d", label: t("documents.date30Days") },
  ];
  const typeFilterOptions = [
    { key: "all", label: t("documents.typeAll") },
    { key: "pdf", label: t("documents.typePdf") },
    { key: "image", label: t("documents.typeImage") },
    { key: "text", label: t("documents.typeText") },
  ];
  const exportFormatOptions = [
    { value: "brf", label: ".brf" },
    { value: "txt", label: ".txt" },
    { value: "docx", label: ".docx" },
    { value: "pdf", label: ".pdf" },
  ];

  const previewDocument = useMemo(
    () => (previewDocumentId ? documents.find((document) => document.id === previewDocumentId) ?? null : null),
    [documents, previewDocumentId],
  );
  const originalWords = useMemo(
    () => (previewDocument?.original_text ? previewDocument.original_text.split(" ") : []),
    [previewDocument],
  );
  const brailleWords = useMemo(
    () => (previewDocument?.braille_text ? previewDocument.braille_text.split(" ") : []),
    [previewDocument],
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

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
        setDeleteTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, previewDocument]);

  useEffect(() => {
    if (!previewDocument) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewDocument]);

  const availableTags = useMemo(() => {
    const uniqueTags = new Set();
    documents.forEach((document) => {
      (document.tags || []).forEach((tag) => uniqueTags.add(tag));
    });
    return Array.from(uniqueTags).sort((left, right) => left.localeCompare(right));
  }, [documents]);

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
        .filter((document) => (typeFilter === "all" ? true : getDocumentType(document) === typeFilter))
        .filter((document) => getDateFilterMatch(document, dateFilter))
        .filter((document) => (tagFilter === "all" ? true : (document.tags || []).includes(tagFilter)))
        .filter((document) => {
          if (!deferredSearch.trim()) {
            return true;
          }

          return buildSearchableDocumentText(document).includes(deferredSearch.trim().toLowerCase());
        }),
    [activeFilter, dateFilter, deferredSearch, documents, isCompact, tagFilter, typeFilter],
  );

  useEffect(() => {
    setSelectedIds((currentIds) => {
      const nextIds = currentIds.filter((id) => visibleDocuments.some((document) => document.id === id));
      return arraysEqual(currentIds, nextIds) ? currentIds : nextIds;
    });
  }, [visibleDocuments]);

  const selectedDocuments = documents.filter((document) => selectedIds.includes(document.id));
  const emptyCopy = getEmptyStateCopy(activeFilter, t);

  function openPreview(documentId) {
    setPreviewDocumentId(documentId);
  }

  function closePreview() {
    setPreviewDocumentId(null);
    setHoveredIndex(null);
  }

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
      const message = t("documents.supabaseMissing");
      setActionError(message);
      onNotify?.({ type: "error", title: t("documents.connectionMissing"), message });
      return;
    }

    setBusyActionKey(actionKey);
    resetMessages();

    try {
      await work();
      await onDocumentsChanged?.();
      setActionMessage(successMessage);
      onNotify?.({ type: "success", title: t("documents.libraryUpdated"), message: successMessage });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("documents.updateFailed"));
      setActionError(friendlyMessage);
      onNotify?.({ type: "error", title: t("documents.updateFailedTitle"), message: friendlyMessage });
    } finally {
      setBusyActionKey("");
    }
  }

  async function handleCopyBraille(documentToCopy) {
    try {
      await navigator.clipboard.writeText(documentToCopy.braille_text);
      setActionError("");
      setActionMessage(t("documents.brailleCopiedFrom", { name: documentToCopy.file_name }));
      onNotify?.({
        type: "success",
        title: t("documents.brailleCopiedTitle"),
        message: t("documents.brailleCopiedMessage", { name: documentToCopy.file_name }),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("documents.clipboardBlocked"));
      setActionError(friendlyMessage);
      setActionMessage("");
      onNotify?.({
        type: "error",
        title: t("documents.clipboardBlockedTitle"),
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
      documentToUpdate.is_favorite ? t("documents.removedFromFavorites") : t("documents.addedToFavorites"),
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
      documentToUpdate.is_archived ? t("documents.restoredToActive") : t("documents.movedToArchive"),
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
      shouldArchive ? t("documents.selectedMovedToArchive") : t("documents.selectedRestoredFromArchive"),
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
      shouldFavorite ? t("documents.selectedAddedToFavorites") : t("documents.selectedRemovedFromFavorites"),
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
      idsToDelete.length === 1 ? t("documents.savedConversionDeleted") : t("documents.savedConversionsDeleted", { count: idsToDelete.length }),
    );

    setDeleteTarget(null);
    setSelectedIds([]);
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
          ? t("documents.exportCompleteMessageSingle", { name: itemsToExport[0].file_name, format: format.toUpperCase() })
          : t("documents.exportCompleteMessageMultiple", { count: itemsToExport.length, format: format.toUpperCase() });
      setActionMessage(message);
      onNotify?.({
        type: "success",
        title: t("documents.exportComplete"),
        message,
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("documents.exportFailed"));
      setActionError(friendlyMessage);
      onNotify?.({ type: "error", title: t("documents.exportFailedTitle"), message: friendlyMessage });
    } finally {
      setBusyActionKey("");
    }
  }

  return (
    <section className={`surface-card ${isDense ? "rounded-2xl p-5 md:p-6" : "rounded-2xl p-6 md:p-8"}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 md:text-[2.8rem]">
            {isCompact ? t("documents.recentDocuments") : t("documents.library")}
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
            <div key={item} className="glass-card animate-pulse rounded-2xl p-5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && documents.length === 0 ? (
        <div className="glass-card mt-10 flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <div className="relative mb-6 h-24 w-40">
            <div className="absolute inset-x-0 bottom-0 h-2 rounded-full bg-violet-200/70" />
            <div className="absolute left-3 top-8 h-14 w-7 rounded-md border border-violet-200 bg-violet-50" />
            <div className="absolute left-12 top-4 h-16 w-7 rounded-md border border-violet-200 bg-white" />
            <div className="absolute left-[5.25rem] top-10 h-12 w-7 rounded-md border border-violet-200 bg-violet-50/70" />
            <div className="absolute left-[7.5rem] top-2 h-20 w-7 rounded-md border border-violet-200 bg-white" />
          </div>
          <p className="max-w-xl text-lg font-semibold text-slate-900">{t("documents.emptyLibraryDescription")}</p>
          <div className="mt-7">
            <button
              type="button"
              onClick={onCreateFirstDocument}
              className="button-primary rounded-full px-7 py-3.5 text-base font-semibold transition"
            >
              {t("documents.startConversion")}
            </button>
          </div>
        </div>
      ) : null}

      {!loading && documents.length > 0 ? (
        <div className="mt-8 space-y-6">
          {!isCompact ? (
            <>
              <div className="surface-muted rounded-2xl p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="document-search">
                      {t("documents.searchLibrary")}
                    </label>
                    <input
                      ref={searchInputRef}
                      id="document-search"
                      type="search"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder={t("documents.searchPlaceholder")}
                      className="field-input mt-2 w-full rounded-2xl px-4 py-3 text-slate-950 outline-none transition"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        viewMode === "grid" ? "button-primary text-white" : "button-secondary"
                      }`}
                    >
                      ⠿ {t("documents.grid")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        viewMode === "list" ? "button-primary text-white" : "button-secondary"
                      }`}
                    >
                      ☰ {t("documents.list")}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="date-filter">
                      {t("documents.date")}
                    </label>
                    <select
                      id="date-filter"
                      value={dateFilter}
                      onChange={(event) => setDateFilter(event.target.value)}
                      className="field-input mt-2 w-full rounded-2xl px-4 py-2.5 outline-none transition"
                    >
                      {dateFilterOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="tag-filter">
                      {t("documents.tag")}
                    </label>
                    <select
                      id="tag-filter"
                      value={tagFilter}
                      onChange={(event) => setTagFilter(event.target.value)}
                      className="field-input mt-2 w-full rounded-2xl px-4 py-2.5 outline-none transition"
                    >
                      <option value="all">{t("documents.tagAll")}</option>
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag}>#{tag}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="type-filter">
                      {t("documents.type")}
                    </label>
                    <select
                      id="type-filter"
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="field-input mt-2 w-full rounded-2xl px-4 py-2.5 outline-none transition"
                    >
                      {typeFilterOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
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
                <div className="surface-muted rounded-2xl p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <p className="text-sm font-semibold text-violet-800">
                      {t("documents.selected", { count: selectedIds.length })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleBulkFavorite}
                        disabled={Boolean(busyActionKey)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                      >
                        {t("documents.toggleFavorite")}
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkArchive}
                        disabled={Boolean(busyActionKey)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                      >
                        {t("documents.archiveRestore")}
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
                        {t("documents.export")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "bulk" })}
                        disabled={Boolean(busyActionKey)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition disabled:opacity-60"
                      >
                        {t("documents.delete")}
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
                    {selectedIds.length === visibleDocuments.length ? t("documents.clearSelection") : t("documents.selectVisible")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {visibleDocuments.length > 0 ? (
            <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
              {visibleDocuments.map((documentToRender) => (
                <article
                  key={documentToRender.id}
                  className="glass-card rounded-2xl p-5 transition"
                >
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => openPreview(documentToRender.id)}
                      className="rounded-2xl border border-slate-700/70 bg-slate-900 p-4 text-left shadow-[inset_0_0_20px_rgba(15,23,42,0.7)] transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("documents.braillePreview")}</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                          {t("documents.inspectFullText")}
                        </span>
                      </div>
                      <p className="mt-3 break-all text-lg leading-8 text-amber-100 [text-shadow:0_0_8px_rgba(250,204,21,0.35)]">
                        {truncateText(documentToRender.braille_text, 120)}
                      </p>
                    </button>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-bold text-slate-950">{documentToRender.file_name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{formatDocumentDate(documentToRender.created_at, locale)}</p>
                        </div>
                        {!isCompact ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(documentToRender.id)}
                            onChange={() => toggleSelection(documentToRender.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
                          />
                        ) : null}
                      </div>

                      <DocumentBadges document={documentToRender} t={t} />
                    </div>

                    <div className={`flex flex-wrap gap-2 ${viewMode === "list" ? "md:justify-end" : ""}`}>
                      <button
                        type="button"
                        onClick={() => handleCopyBraille(documentToRender)}
                        className="button-secondary rounded-full px-3.5 py-2 text-xs font-semibold transition"
                      >
                        {t("documents.copy")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(documentToRender)}
                        disabled={busyActionKey === `favorite:${documentToRender.id}`}
                        className="button-secondary rounded-full px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60"
                      >
                        {documentToRender.is_favorite ? t("documents.unfavorite") : t("documents.favorite")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(documentToRender)}
                        disabled={busyActionKey === `archive:${documentToRender.id}`}
                        className="button-secondary rounded-full px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60"
                      >
                        {documentToRender.is_archived ? t("documents.restore") : t("documents.archive")}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget({ type: "single", ...documentToRender });
                        }}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition"
                      >
                        {t("documents.delete")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !isCompact && (
              <div className="glass-card rounded-2xl border border-dashed border-violet-200 p-8 text-center">
                <p className="text-2xl font-bold text-slate-950">{emptyCopy.title}</p>
              </div>
            )
          )}
        </div>
      ) : null}

      {isClient && previewDocument
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={closePreview}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-[var(--surface-strong)] rounded-2xl shadow-2xl p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-200 px-5 py-5 md:px-7">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">{t("documents.documentReview")}</p>
                      <h3 className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                        {previewDocument.file_name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">{formatDocumentDate(previewDocument.created_at, locale)}</p>
                      <DocumentBadges document={previewDocument} t={t} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyBraille(previewDocument)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                      >
                        {t("documents.copy")}
                      </button>
                      {exportFormatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleExportDocuments([previewDocument], option.value)}
                          className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                        >
                          {t("documents.export")} {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={closePreview}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                      >
                        {t("common.close")}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
                  <article className="flex min-h-0 flex-col border-b border-slate-200 px-5 py-5 lg:border-b-0 lg:border-r lg:px-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("documents.originalText")}</p>
                    <div className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap pr-1 text-base leading-7 text-slate-700">
                      {originalWords.map((word, index) => (
                        (() => {
                          const isFlagged = flaggedIndices.includes(index);
                          const isHovered = hoveredIndex === index;
                          let wordClassName = "transition-colors duration-200 cursor-default";

                          if (isFlagged && isHovered) {
                            wordClassName = "bg-red-500 text-white shadow-md scale-105 ring-2 ring-red-300 z-10 relative transition-colors duration-200 cursor-default";
                          } else if (isFlagged) {
                            wordClassName = "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 transition-colors duration-200 cursor-default";
                          } else if (isHovered) {
                            wordClassName = "bg-[var(--accent)] text-[var(--primary)] transition-colors duration-200 cursor-default";
                          }

                          return (
                        <span
                          key={`original-${index}`}
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className={wordClassName}
                        >
                          {word}{" "}
                        </span>
                          );
                        })()
                      ))}
                    </div>
                  </article>

                  <article className="flex min-h-0 flex-col px-5 py-5 lg:px-7">
                    <p className="accent-label text-xs font-semibold uppercase tracking-[0.2em]">{t("documents.brailleOutput")}</p>
                    <div className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap break-all pr-1 text-2xl leading-10 text-slate-950">
                      {brailleWords.map((word, index) => (
                        (() => {
                          const isFlagged = flaggedIndices.includes(index);
                          const isHovered = hoveredIndex === index;
                          let wordClassName = "transition-colors duration-200 cursor-default";

                          if (isFlagged && isHovered) {
                            wordClassName = "bg-red-500 text-white shadow-md scale-105 ring-2 ring-red-300 z-10 relative transition-colors duration-200 cursor-default";
                          } else if (isFlagged) {
                            wordClassName = "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 transition-colors duration-200 cursor-default";
                          } else if (isHovered) {
                            wordClassName = "bg-[var(--accent)] text-[var(--primary)] transition-colors duration-200 cursor-default";
                          }

                          return (
                        <span
                          key={`braille-${index}`}
                          className={wordClassName}
                        >
                          {word}{" "}
                        </span>
                          );
                        })()
                      ))}
                    </div>
                  </article>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isClient && deleteTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="surface-card w-full max-w-md rounded-2xl p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">{t("documents.deleteConversion")}</p>
                <h3 className="mt-3 text-3xl font-bold text-slate-950">
                  {deleteTarget.type === "bulk" ? t("documents.selectedConversions", { count: selectedIds.length }) : deleteTarget.file_name}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {t("documents.deleteDescription")}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={Boolean(busyActionKey)}
                    className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("documents.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDocuments}
                    disabled={busyActionKey === "delete"}
                    className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyActionKey === "delete" ? t("documents.deleting") : t("documents.deletePermanently")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
