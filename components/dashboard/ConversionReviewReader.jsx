"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { BlockAlignedComparison } from "@/components/BlockAlignedComparison";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/components/I18nProvider";
import { alignBrailleTextToOriginalBlocks, buildReviewPagesFromDocument, isReaderRecommended } from "@/lib/documentReview";
import { getSourceLabel } from "@/lib/documents";
import { exportDocuments } from "@/lib/exportDocuments";
import { resolvePageJump } from "@/lib/pageNavigation";
import { segmentPlainTextPage } from "@/lib/pageSegmentation";
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
  const [preparedReview, setPreparedReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [jumpValue, setJumpValue] = useState("1");
  const documentId = searchParams.get("document");
  const isFreshResult = searchParams.get("fresh") === "1";

  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      if (!documentId || !supabase || !user) {
        setDocumentRecord(null);
        setPreparedReview(null);
        setLoading(false);
        return;
      }

      const cachedReview = readCachedReview(documentId);
      if (cachedReview) {
        setDocumentRecord(cachedReview.documentRecord);
        setPreparedReview(cachedReview);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setDocumentRecord(null);
      setPreparedReview(null);

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
        setPreparedReview(null);
        setErrorMessage(getFriendlyDocumentMessage(error, t("review.loadFailed")));
        setLoading(false);
        return;
      }

      const nextPreparedReview = prepareReviewDocument(data);
      writeCachedReview(documentId, nextPreparedReview);
      setDocumentRecord(data);
      setPreparedReview(nextPreparedReview);
      setLoading(false);
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [documentId, supabase, t, user]);

  const reviewPages = useMemo(
    () => preparedReview?.reviewPages || [],
    [preparedReview],
  );

  useEffect(() => {
    setCurrentPageIndex(0);
  }, [documentId]);

  useEffect(() => {
    setJumpValue(String((currentPageIndex || 0) + 1));
  }, [currentPageIndex]);

  useEffect(() => {
    if (currentPageIndex <= reviewPages.length - 1) {
      return;
    }

    setCurrentPageIndex(Math.max(reviewPages.length - 1, 0));
  }, [currentPageIndex, reviewPages.length]);

  const currentPage = reviewPages[currentPageIndex] ?? null;
  const canOpenReader = documentRecord
    ? isReaderRecommended({ sourceType: documentRecord.source_type, originalText: documentRecord.original_text })
    : false;
  const comparisonNotes = useMemo(
    () => [
      t("review.noteAlignedRows"),
      t("review.noteSpacing"),
      t("review.noteSync"),
    ],
    [t],
  );

  const blocks = useMemo(() => {
    if (!currentPage) {
      return [];
    }

    const rawBlocks =
      currentPage.blocks ||
      currentPage.brailleBlocks ||
      currentPage.originalBlocks ||
      currentPage.reviewBlocks ||
      currentPage.alignedBlocks ||
      currentPage.pageBlocks ||
      [];
    const normalizedBlocks = normalizeReviewBlocks(rawBlocks, currentPage.pageNumber);

    if (process.env.NODE_ENV !== "production") {
      console.log("Review raw blocks:", rawBlocks);
      console.log("Review normalized blocks:", normalizedBlocks);
    }

    return normalizedBlocks;
  }, [currentPage]);
  const baseFileName = useMemo(
    () => sanitizeFileToken(documentRecord?.file_name?.replace(/\.[^/.]+$/, "")) || "braille-review",
    [documentRecord?.file_name],
  );

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

  function handleDownload(content, type) {
    if (!currentPage) {
      return;
    }

    const suffix = type === "braille" ? "braille" : "original";
    downloadTextFile(content, `${baseFileName}-page-${currentPage.pageNumber}-${suffix}.txt`);
    setActionError("");
    setActionMessage(
      type === "braille" ? t("review.downloadBrailleSuccess") : t("review.downloadOriginalSuccess"),
    );
  }

  async function handleDownloadBrf() {
    if (!documentRecord) {
      return;
    }

    try {
      await exportDocuments([documentRecord], "brf");
      setActionError("");
      setActionMessage(t("review.downloadBrailleBrfSuccess"));
    } catch (error) {
      setActionMessage("");
      setActionError(getFriendlyDocumentMessage(error, t("review.downloadFailed")));
    }
  }

  function handlePageJump() {
    const result = resolvePageJump(jumpValue, reviewPages.length);

    if (!result.ok) {
      setActionMessage("");
      if (result.error === "empty") {
        setActionError(t("review.jumpEmpty"));
        return;
      }

      setActionError(
        result.error === "out_of_range"
          ? t("review.jumpOutOfRange", { total: reviewPages.length })
          : t("review.jumpInvalid"),
      );
      return;
    }

    setActionError("");
    setCurrentPageIndex(result.pageIndex);
  }

  return (
    <main className="page-shell overflow-x-hidden">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
          <p className="section-kicker">{t("review.kicker")}</p>
        </div>

        <section className="surface-card hero-wash rounded-2xl p-6 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                {t("review.title")}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-700 md:text-lg">
                {t("review.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard?tab=upload" className="button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                {t("review.backToConvert")}
              </Link>
              <Link href="/dashboard?tab=documents" className="button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                {t("review.backToLibrary")}
              </Link>
            </div>
          </div>
        </section>

        {isFreshResult ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {t("review.freshResultMessage")}
          </p>
        ) : null}

        {!documentId ? (
          <div className="surface-card rounded-2xl p-8 text-center">
            <p className="text-xl font-semibold text-slate-900">{t("review.noDocumentSelected")}</p>
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
                  <p className="section-kicker">{t("review.documentLabel")}</p>
                  <h2 className="mt-2 truncate text-3xl font-bold text-slate-950 md:text-4xl">{documentRecord.file_name}</h2>
                  <p className="mt-3 text-sm text-slate-500">{formatReviewDate(documentRecord.created_at, locale)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="panel-subtle rounded-2xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("review.sourceType")}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{getSourceLabel(documentRecord.source_type)}</p>
                  </div>
                  <div className="panel-subtle rounded-2xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("review.pageCount")}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{reviewPages.length}</p>
                  </div>
                </div>
              </div>
            </section>

            {!canOpenReader ? (
              <div className="surface-card rounded-2xl p-8 text-center">
                <p className="text-lg font-semibold text-slate-900">{t("review.readerNotNeeded")}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{t("review.readerNotNeededDescription")}</p>
              </div>
            ) : null}

            {canOpenReader && currentPage ? (
              <>
                <div className="surface-card rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="section-kicker">{t("review.syncMode")}</p>
                      <h3 className="mt-2 text-2xl font-bold text-slate-950">{t("review.pageIndicator", { current: currentPage.pageNumber, total: reviewPages.length })}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPageIndex((index) => Math.max(index - 1, 0))}
                        disabled={currentPageIndex === 0}
                        className="button-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {t("review.previousPage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPageIndex((index) => Math.min(index + 1, reviewPages.length - 1))}
                        disabled={currentPageIndex === reviewPages.length - 1}
                        className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("review.nextPage")}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
                      {currentPage.structureMode}
                    </span>
                    <span className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
                      {currentPage.language}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(currentPage.originalText, t("review.copyOriginalSuccess"))}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("review.copyOriginal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentPage.brailleText, t("review.copyBrailleSuccess"))}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("review.copyBraille")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(currentPage.originalText, "original")}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("review.downloadOriginal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(currentPage.brailleText, "braille")}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("review.downloadBraille")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBrf}
                      className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                    >
                      {t("review.downloadBrailleBrf")}
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="page-jump-input">
                      {t("review.jumpLabel")}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="page-jump-input"
                        inputMode="numeric"
                        value={jumpValue}
                        onChange={(event) => setJumpValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handlePageJump();
                          }
                        }}
                        className="field-input w-24 rounded-full px-4 py-2 text-sm"
                        aria-label={t("review.jumpLabel")}
                      />
                      <button
                        type="button"
                        onClick={handlePageJump}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        {t("review.jumpGo")}
                      </button>
                      <span className="text-sm text-slate-500">
                        {t("review.pageIndicator", { current: currentPage.pageNumber, total: reviewPages.length })}
                      </span>
                    </div>
                  </div>
                </div>

                <BlockAlignedComparison
                  blocks={blocks}
                  originalLabel={t("review.originalPage")}
                  brailleLabel={t("review.braillePage")}
                  notesTitle={t("review.notesTitle")}
                  notes={comparisonNotes}
                />

                <div className="surface-card rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="text-sm leading-7 text-slate-600">
                      {t("review.footerHint")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPageIndex((index) => Math.max(index - 1, 0))}
                        disabled={currentPageIndex === 0}
                        className="button-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {t("review.previousPage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPageIndex((index) => Math.min(index + 1, reviewPages.length - 1))}
                        disabled={currentPageIndex === reviewPages.length - 1}
                        className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("review.nextPage")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
