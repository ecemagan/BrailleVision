"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlignedBrailleComparison } from "@/components/AlignedBrailleComparison";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/components/I18nProvider";
import { buildReviewPagesFromDocument, stripStoredPageMarkers } from "@/lib/documentReview";
import { exportDocuments } from "@/lib/exportDocuments";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

const reviewDocumentCache = new Map();

function formatReviewDate(value, locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sanitizeFileToken(value) {
  return String(value || "braille-vision")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadTextFile(content, fileName) {
  const blob = new Blob([String(content || "")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function makeReviewCacheKey(documentId) {
  return `braillevision-review:${documentId}`;
}

function normalizeReviewBlock(block, index, pageNumber = 1, parentId = "") {
  const originalText =
    block?.originalText ??
    block?.originalContent ??
    block?.normalizedContent ??
    block?.content ??
    block?.text ??
    "";
  const brailleText =
    block?.brailleText ??
    block?.brailleContent ??
    block?.braille ??
    "";
  const fallbackId = parentId
    ? `${parentId}-child-${index}`
    : `page-${pageNumber}-block-${index}`;
  const children = Array.isArray(block?.children)
    ? block.children.map((child, childIndex) => normalizeReviewBlock(child, childIndex, pageNumber, block?.id || fallbackId))
    : [];

  return {
    ...block,
    id: block?.id || fallbackId,
    originalText,
    originalContent: block?.originalContent ?? originalText,
    normalizedContent: block?.normalizedContent ?? originalText,
    brailleText,
    brailleContent: block?.brailleContent ?? brailleText,
    children,
  };
}

function normalizeReviewBlocks(rawBlocks, pageNumber = 1) {
  return (Array.isArray(rawBlocks) ? rawBlocks : [])
    .map((block, index) => normalizeReviewBlock(block, index, pageNumber))
    .filter((block) =>
      block.originalText ||
      block.brailleText ||
      block.originalContent ||
      block.brailleContent ||
      block.content ||
      block.text ||
      block.children?.length,
    );
}

function prepareReviewDocument(documentRecord) {
  const reviewPages = buildReviewPagesFromDocument(documentRecord).map((page) => {
    const originalBlocks = segmentPlainTextPage(page.originalText, page.pageNumber);
    const blocks = normalizeReviewBlocks(
      alignBrailleTextToOriginalBlocks(originalBlocks, page.brailleText),
      page.pageNumber,
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("Review raw blocks:", originalBlocks);
      console.log("Review normalized blocks:", blocks);
    }

    return {
      ...page,
      blocks,
    };
  });

  return {
    documentRecord,
    reviewPages,
  };
}

function readCachedReview(documentId) {
  if (!documentId) {
    return null;
  }

  const memoryValue = reviewDocumentCache.get(documentId);
  if (memoryValue) {
    return memoryValue;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(makeReviewCacheKey(documentId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.documentRecord || !Array.isArray(parsed?.reviewPages)) {
      return null;
    }

    reviewDocumentCache.set(documentId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedReview(documentId, value) {
  if (!documentId || !value) {
    return;
  }

  reviewDocumentCache.set(documentId, value);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(makeReviewCacheKey(documentId), JSON.stringify(value));
  } catch {
    // Ignore storage quota and serialization issues; in-memory cache still helps.
  }
}

export function ConversionReviewReader() {
  const searchParams = useSearchParams();
  const { supabase, user } = useAuth();
  const { t, locale } = useI18n();
  const [documentRecord, setDocumentRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const documentId = searchParams.get("document");

  const comparisonNotes = useMemo(
    () => [
      t("documents.comparisonNoteAligned"),
      t("documents.comparisonNoteSpacing"),
      t("documents.comparisonNoteHover"),
    ],
    [t],
  );

  const exportFormatOptions = useMemo(
    () => [
      { value: "brf", label: ".brf" },
      { value: "txt", label: ".txt" },
      { value: "docx", label: ".docx" },
      { value: "pdf", label: ".pdf" },
    ],
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      if (!documentId || !supabase || !user) {
        setDocumentRecord(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setDocumentRecord(null);

      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, original_text, braille_text, source_type, created_at")
        .eq("id", documentId)
        .eq("user_id", user.id)
        .single();

      if (isCancelled) {
        return;
      }

      if (error) {
        setDocumentRecord(null);
        setErrorMessage(getFriendlyDocumentMessage(error, t("review.loadFailed")));
        setLoading(false);
        return;
      }

      setDocumentRecord(data);
      setLoading(false);
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [documentId, supabase, t, user]);

  const reviewPages = useMemo(
    () => (documentRecord ? buildReviewPagesFromDocument(documentRecord) : []),
    [documentRecord],
  );
  const currentPage = reviewPages[currentPageIndex] || null;

  useEffect(() => {
    setCurrentPageIndex(0);
  }, [documentId]);

  useEffect(() => {
    if (!reviewPages.length) {
      if (currentPageIndex !== 0) {
        setCurrentPageIndex(0);
      }
      return;
    }

    if (currentPageIndex <= reviewPages.length - 1) {
      return;
    }

    setCurrentPageIndex(Math.max(reviewPages.length - 1, 0));
  }, [currentPageIndex, reviewPages.length]);

  async function handleCopy(value, successMessage) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setActionError("");
      setActionMessage(successMessage);
    } catch (error) {
      setActionMessage("");
      setActionError(getFriendlyDocumentMessage(error, t("review.copyBlocked")));
    }
  }

  async function handleCopyDocumentBraille() {
    if (!documentRecord) {
      return;
    }

    await handleCopy(
      stripStoredPageMarkers(documentRecord.braille_text, documentRecord.source_type),
      t("documents.brailleCopiedFrom", { name: documentRecord.file_name }),
    );
  }

  async function handleExportDocument(format) {
    if (!documentRecord) {
      return;
    }

    try {
      await exportDocuments([documentRecord], format);
      setActionError("");
      setActionMessage(
        t("documents.exportCompleteMessageSingle", { name: documentRecord.file_name, format: format.toUpperCase() }),
      );
    } catch (error) {
      setActionMessage("");
      setActionError(getFriendlyDocumentMessage(error, t("documents.exportFailed")));
    }
  }

  return (
    <main className="page-shell overflow-x-hidden">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
        </div>
        {!documentId ? (
          <div className="surface-card rounded-2xl p-8 text-center">
            <p className="text-xl font-semibold text-slate-900">{t("review.noDocumentSelected")}</p>
            <div className="mt-5 flex justify-center">
              <Link href="/dashboard?tab=documents" className="button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                {t("common.close")}
              </Link>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="surface-card rounded-2xl p-8">
            <p className="text-base text-slate-600">{t("review.loading")}</p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {documentRecord && !loading ? (
          <>
            <section className="surface-card rounded-2xl p-6 md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="section-kicker">{t("documents.documentReview")}</p>
                  <h2 className="mt-2 truncate text-3xl font-bold text-slate-950 md:text-4xl">{documentRecord.file_name}</h2>
                  <p className="mt-3 text-sm text-slate-500">{formatReviewDate(documentRecord.created_at, locale)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDocumentBraille}
                    className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                  >
                    {t("documents.copy")}
                  </button>
                  {exportFormatOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleExportDocument(option.value)}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("documents.export")} {option.label}
                    </button>
                  ))}
                  <Link href="/dashboard?tab=documents" className="button-secondary rounded-full px-4 py-3 text-sm font-semibold">
                    {t("common.close")}
                  </Link>
                </div>
              </div>
            </section>

            {currentPage ? (
              <>
                {reviewPages.length > 1 ? (
                  <section className="surface-card rounded-2xl p-4 md:p-5">
                    <section className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        {t("review.pageIndicator", { current: currentPage.pageNumber, total: reviewPages.length })}
                      </p>
                      <section className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPageIndex((index) => Math.max(index - 1, 0))}
                          disabled={currentPageIndex === 0}
                          className="button-secondary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          {t("review.previousPage")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPageIndex((index) => Math.min(index + 1, reviewPages.length - 1))}
                          disabled={currentPageIndex === reviewPages.length - 1}
                          className="button-primary rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t("review.nextPage")}
                        </button>
                      </section>
                    </section>
                  </section>
                ) : null}

                <AlignedBrailleComparison
                  originalText={currentPage.originalText}
                  brailleText={stripStoredPageMarkers(currentPage.brailleText, documentRecord.source_type)}
                  originalLabel={t("documents.originalText")}
                  brailleLabel={t("documents.brailleOutput")}
                  notesTitle={t("documents.comparisonNotesTitle")}
                  notes={comparisonNotes}
                  wordsPerRow={8}
                  interactive
                  compact
                />
                {reviewPages.length > 1 ? (
                  <section className="surface-card mt-6 rounded-2xl p-4 md:p-5">
                    <section className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        {t("review.pageIndicator", { current: currentPage.pageNumber, total: reviewPages.length })}
                      </p>
                      <section className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPageIndex((index) => Math.max(index - 1, 0))}
                          disabled={currentPageIndex === 0}
                          className="button-secondary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          {t("review.previousPage")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPageIndex((index) => Math.min(index + 1, reviewPages.length - 1))}
                          disabled={currentPageIndex === reviewPages.length - 1}
                          className="button-primary rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t("review.nextPage")}
                        </button>
                      </section>
                    </section>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
