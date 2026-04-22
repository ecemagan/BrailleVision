"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeGraphImage } from "@/lib/analyzeGraphImage";
import { buildGraphDocumentText } from "@/lib/graphResultUtils";
import { normalizeTag, saveDocumentRecord } from "@/lib/documents";
import { useI18n } from "@/components/I18nProvider";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";
import { GraphResultCard } from "@/components/graphs/GraphResultCard";
import { GraphUploadCard } from "@/components/graphs/GraphUploadCard";
import { SyncedBrailleExplanation } from "@/components/graphs/SyncedBrailleExplanation";

function downloadTextFile(content, fileName) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFileName(value) {
  return String(value || "graph-reader-result")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function InfoTile({ label, value }) {
  return (
    <div className="surface-muted rounded-2xl px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{value}</p>
    </div>
  );
}

function AnalysisModeBadge({ label, active }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em]",
        active
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : "border-slate-200 bg-slate-50 text-slate-600",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function EmptyResultState({ t }) {
  return (
    <div className="surface-card rounded-[28px] p-8 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-violet-200 bg-violet-50 text-3xl text-violet-700">
        ⠿
      </div>
      <h3 className="mt-5 text-3xl font-bold text-slate-950">{t("graphs.emptyResultTitle")}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-600">{t("graphs.emptyResultDescription")}</p>
    </div>
  );
}

export function GraphInsightPanel({ onNotify, supabase, userId, onSaved }) {
  const { t, locale } = useI18n();
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [savedDocumentId, setSavedDocumentId] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const baseFileName = sanitizeFileName(selectedImage?.name?.replace(/\.[^/.]+$/, ""));
  const documentText = useMemo(
    () => (analysis ? buildGraphDocumentText(analysis, t) : ""),
    [analysis, t],
  );

  function resetMessages() {
    setErrorMessage("");
    setCopyMessage("");
  }

  function handleSelectedFile(file) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      const message = t("graphs.invalidFile");
      setErrorMessage(message);
      onNotify?.({ type: "warning", title: t("graphs.invalidFileTitle"), message });
      return;
    }

    resetMessages();
    setSelectedImage(file);
    setAnalysis(null);
    setSavedDocumentId("");
  }

  async function handleCopy(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(successMessage);
      window.setTimeout(() => setCopyMessage(""), 2200);
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("graphs.copyBlocked"));
      setErrorMessage(friendlyMessage);
      onNotify?.({ type: "error", title: t("graphs.copyBlockedTitle"), message: friendlyMessage });
    }
  }

  async function handleAnalyze(event) {
    event.preventDefault();

    if (!selectedImage) {
      setErrorMessage(t("graphs.selectGraphFirst"));
      return;
    }

    setIsAnalyzing(true);
    resetMessages();
    setSavedDocumentId("");

    try {
      const nextAnalysis = await analyzeGraphImage(selectedImage, locale);
      setAnalysis(nextAnalysis);
      onNotify?.({
        type: "success",
        title: t("graphs.analysisReadyTitle"),
        message: t("graphs.analysisReadyMessage", { name: selectedImage.name }),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("graphs.analysisFailed"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("graphs.analysisFailedTitle"),
        message: friendlyMessage,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSaveResult() {
    if (!analysis) {
      return;
    }

    if (!supabase || !userId) {
      const message = t("graphs.loginToSave");
      setErrorMessage(message);
      onNotify?.({ type: "warning", title: t("graphs.saveUnavailableTitle"), message });
      return;
    }

    setIsSaving(true);
    resetMessages();

    try {
      const savedDocument = await saveDocumentRecord({
        supabase,
        userId,
        fileName: `${baseFileName || "graph-reader"}-description.txt`,
        originalText: documentText,
        brailleText: analysis.explanationBraille,
        sourceType: "graph",
        conversionMode: "graph-description",
        tags: [
          "graph",
          normalizeTag(analysis.graphType),
          normalizeTag(analysis.confidence),
        ],
      });

      setSavedDocumentId(savedDocument?.id || "");
      await onSaved?.();
      onNotify?.({
        type: "success",
        title: t("graphs.savedTitle"),
        message: t("graphs.savedMessage"),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("graphs.saveFailed"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("graphs.saveFailedTitle"),
        message: friendlyMessage,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleDownload(mode) {
    if (!analysis) {
      return;
    }

    const content = mode === "braille" ? analysis.explanationBraille : documentText;
    downloadTextFile(content, `${baseFileName || "graph-reader"}-${mode}.txt`);
  }

  return (
    <section className="space-y-6">
      <div className="surface-card overflow-hidden rounded-[28px]">
        <div className="bg-[linear-gradient(135deg,rgba(217,119,6,0.12),rgba(255,255,255,0.86),rgba(255,248,235,0.92))] px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="section-kicker">{t("graphs.kicker")}</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 md:text-[3.4rem]">
                {t("graphs.heroTitle")}
              </h2>
              <p className="mt-3 text-base leading-8 text-slate-700 md:text-lg">{t("graphs.heroDescription")}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800">
                {t("graphs.badgeCompare")}
              </span>
              <span className="rounded-full border border-amber-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800">
                {t("graphs.badgeTeacher")}
              </span>
              <span className="rounded-full border border-amber-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800">
                {t("graphs.badgeType")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleAnalyze} className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <GraphUploadCard
          t={t}
          previewUrl={previewUrl}
          selectedImageName={selectedImage?.name || ""}
          isDragging={isDragging}
          isAnalyzing={isAnalyzing}
          onSelectFile={handleSelectedFile}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
          }}
        />

        <aside className="surface-card rounded-[28px] p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-kicker">{t("graphs.uploadEyebrow")}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">{t("graphs.uploadTitle")}</h3>
            </div>
            <div className="flex flex-col items-end gap-3">
              <AnalysisModeBadge
                label={analysis?.analysisModeLabel || t("graphs.modeUnknown")}
                active={Boolean(analysis)}
              />
              <button
                type="submit"
                disabled={isAnalyzing}
                className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAnalyzing ? t("graphs.analyzing") : t("graphs.analyzeButton")}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <InfoTile label={t("graphs.fileLabel")} value={selectedImage?.name || t("graphs.noFileSelected")} />
            <InfoTile
              label={t("graphs.analysisModeLabel")}
              value={analysis?.analysisModeLabel || t("graphs.readyToAnalyze")}
            />
          </div>

          {errorMessage ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
          ) : null}

          {copyMessage ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{copyMessage}</p>
          ) : null}

          {savedDocumentId ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t("graphs.savedMessage")}
            </p>
          ) : null}

          {analysis ? (
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => handleCopy(documentText, t("graphs.normalCopied"))}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
              >
                {t("graphs.copyNormal")}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(analysis.explanationBraille, t("graphs.brailleCopied"))}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
              >
                {t("graphs.copyBraille")}
              </button>
              <button
                type="button"
                onClick={() => handleDownload("normal")}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
              >
                {t("graphs.downloadNormal")}
              </button>
              <button
                type="button"
                onClick={() => handleDownload("braille")}
                className="button-secondary rounded-full px-4 py-3 text-sm font-semibold"
              >
                {t("graphs.downloadBraille")}
              </button>
              <button
                type="button"
                onClick={handleSaveResult}
                disabled={isSaving}
                className="button-primary rounded-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? t("graphs.saving") : t("graphs.saveToLibrary")}
              </button>
            </div>
          ) : (
            <div className="surface-muted mt-5 rounded-2xl px-4 py-4">
              <p className="text-sm leading-7 text-slate-700">{t("graphs.offlineFallbackDescription")}</p>
            </div>
          )}
        </aside>
      </form>

      {!analysis ? <EmptyResultState t={t} /> : null}

      {analysis ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <GraphResultCard eyebrow={t("graphs.summaryEyebrow")} title={t("graphs.summaryTitle")}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InfoTile label={t("graphs.resultTitleLabel")} value={analysis.title} />
                <InfoTile label={t("graphs.graphTypeLabel")} value={analysis.graphType} />
                <InfoTile label={t("graphs.trendLabel")} value={analysis.trendDirection} />
                <InfoTile label={t("graphs.axisXLabel")} value={analysis.axisX} />
                <InfoTile label={t("graphs.axisYLabel")} value={analysis.axisY} />
                <InfoTile label={t("graphs.confidenceLabel")} value={analysis.confidence} />
              </div>
            </GraphResultCard>

            <div className="grid gap-6">
              {analysis.equationText ? (
                <GraphResultCard eyebrow={t("graphs.equationEyebrow")} title={t("graphs.equationTitle")}>
                  <p className="text-2xl font-bold text-slate-950">{analysis.equationText}</p>
                </GraphResultCard>
              ) : null}

              {analysis.captionText ? (
                <GraphResultCard eyebrow={t("graphs.captionEyebrow")} title={t("graphs.captionTitle")}>
                  <p className="text-base leading-8 text-slate-800">{analysis.captionText}</p>
                </GraphResultCard>
              ) : null}

              {(analysis.xInterceptText || analysis.yInterceptText || analysis.notes.length > 0) ? (
                <GraphResultCard eyebrow={t("graphs.notesEyebrow")} title={t("graphs.notesTitle")}>
                  <div className="space-y-3">
                    {analysis.xInterceptText ? (
                      <InfoTile label={t("graphs.xInterceptLabel")} value={analysis.xInterceptText} />
                    ) : null}
                    {analysis.yInterceptText ? (
                      <InfoTile label={t("graphs.yInterceptLabel")} value={analysis.yInterceptText} />
                    ) : null}
                    {analysis.notes.length ? (
                      <div className="surface-muted rounded-2xl px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t("graphs.notesLabel")}</p>
                        <div className="mt-3 space-y-2">
                          {analysis.notes.map((note) => (
                            <p key={note} className="text-sm leading-7 text-slate-700">{note}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </GraphResultCard>
              ) : null}
            </div>
          </section>

          <GraphResultCard eyebrow={t("graphs.syncEyebrow")} title={t("graphs.syncTitle")}>
            <SyncedBrailleExplanation segments={analysis.segments} t={t} />
          </GraphResultCard>
        </>
      ) : null}
    </section>
  );
}
