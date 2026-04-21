"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeBrailleReadability, suggestDocumentTags } from "@/lib/brailleAssistant";
import { convertToBraille } from "@/lib/convertToBraille";
import { normalizeTags, saveDocumentRecord } from "@/lib/documents";
import { exportDocuments } from "@/lib/exportDocuments";
import { extractImageText } from "@/lib/extractImageText";
import { extractPdfText } from "@/lib/extractPdfText";
import { useI18n } from "@/components/I18nProvider";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

function detectConversionMode(text, sourceType) {
  if (sourceType === "image" || sourceType === "camera") {
    return "ocr";
  }

  return /[=+\-*/^_()[\]{}<>]|sqrt|log|ln|sin|cos|tan/i.test(text) ? "nemeth" : "text";
}

export function UploadPanel({
  userId,
  supabase,
  onSaved,
  onNotify,
  density = "comfortable",
  quickSaveSignal = 0,
  isActive = false,
}) {
  const isCompact = density === "compact";
  const { t } = useI18n();
  const formRef = useRef(null);
  const documentInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [manualText, setManualText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSourceType, setSelectedSourceType] = useState("manual");
  const [brailleResult, setBrailleResult] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [resultDocument, setResultDocument] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [useImprovedText, setUseImprovedText] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const allowedDocumentExtensions = useMemo(() => ["pdf", "txt", "jpg", "jpeg", "png"], []);

  useEffect(() => {
    if (quickSaveSignal > 0 && isActive) {
      formRef.current?.requestSubmit();
    }
  }, [isActive, quickSaveSignal]);

  function setFileSelection(file, sourceType) {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setSelectedSourceType(sourceType);
    setErrorMessage("");
  }

  function notifyInvalidSelection(message) {
    setErrorMessage(message);
    onNotify?.({
      type: "warning",
      title: t("upload.invalidSelectionTitle"),
      message,
    });
  }

  function validateDocumentFile(file) {
    if (!file) {
      return false;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const isImageType = file.type.startsWith("image/");

    return allowedDocumentExtensions.includes(extension) || isImageType;
  }

  function validateCameraFile(file) {
    if (!file) {
      return false;
    }

    return file.type.startsWith("image/");
  }

  function handleDocumentInputChange(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!validateDocumentFile(file)) {
      notifyInvalidSelection(t("upload.unsupportedDocumentFormat"));
      return;
    }

    setFileSelection(file, inferSourceType(file));
  }

  function handleCameraInputChange(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!validateCameraFile(file)) {
      notifyInvalidSelection(t("upload.unsupportedCameraFormat"));
      return;
    }

    setFileSelection(file, "camera");
  }

  function openDocumentPicker() {
    documentInputRef.current?.click();
  }

  async function openCameraPicker() {
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        notifyInvalidSelection(t("upload.cameraPermissionDenied"));
        return;
      }
    }

    cameraInputRef.current?.click();
  }

  function inferSourceType(file) {
    if (!file) {
      return "manual";
    }

    if (file.type.startsWith("image/")) {
      return "image";
    }

    return "manual";
  }

  function handleDropzoneDragOver(event) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function handleDropzoneDragLeave(event) {
    event.preventDefault();
    setIsDraggingFile(false);
  }

  function handleDropzoneDrop(event) {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    if (!validateDocumentFile(file)) {
      notifyInvalidSelection(t("upload.unsupportedDocumentFormat"));
      return;
    }

    setFileSelection(file, inferSourceType(file));
  }

  async function getInputText() {
    if (selectedFile) {
      const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();

      if (fileExtension === "txt") {
        return {
          fileName: selectedFile.name,
          originalText: await selectedFile.text(),
          sourceType: "manual",
        };
      }

      if (fileExtension === "pdf") {
        return {
          fileName: selectedFile.name,
          originalText: await extractPdfText(selectedFile),
          sourceType: "pdf",
        };
      }

      if (selectedFile.type.startsWith("image/")) {
        return {
          fileName: selectedFile.name,
          originalText: await extractImageText(selectedFile),
          sourceType: selectedSourceType === "camera" ? "camera" : "image",
        };
      }

      throw new Error(t("upload.supportedFiles"));
    }

    if (manualText.trim()) {
      return {
        fileName: "manual-input.txt",
        originalText: manualText.trim(),
        sourceType: "manual",
      };
    }

    throw new Error(t("upload.addTextOrChooseFile"));
  }

  const currentAnalysis = useMemo(() => {
    const liveText = sourceText || manualText;
    const sourceType = selectedFile ? selectedSourceType : "manual";
    const conversionMode = detectConversionMode(liveText, sourceType);

    return analyzeBrailleReadability(liveText, sourceType, conversionMode);
  }, [manualText, selectedFile, selectedSourceType, sourceText]);

  const suggestedTags = useMemo(() => {
    const manualTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    return suggestDocumentTags(
      sourceText || manualText,
      selectedFile ? selectedSourceType : "manual",
      detectConversionMode(sourceText || manualText, selectedFile ? selectedSourceType : "manual"),
      manualTags,
    );
  }, [manualText, selectedFile, selectedSourceType, sourceText, tagInput]);

  async function handleCopyResult() {
    if (!brailleResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(brailleResult);
      setCopyMessage(t("upload.brailleCopied"));
      onNotify?.({
        type: "success",
        title: t("upload.brailleCopiedTitle"),
        message: t("upload.brailleCopiedMessage"),
      });
      window.setTimeout(() => setCopyMessage(""), 2200);
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("upload.clipboardBlocked"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("upload.clipboardBlockedTitle"),
        message: friendlyMessage,
      });
    }
  }

  async function handleExportResult(format) {
    if (!resultDocument) {
      return;
    }

    try {
      await exportDocuments([resultDocument], format);
      onNotify?.({
        type: "success",
        title: t("upload.exportComplete"),
        message: t("upload.exportCompleteMessage", { name: resultDocument.file_name, format: format.toUpperCase() }),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("upload.exportFailed"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("upload.exportFailedTitle"),
        message: friendlyMessage,
      });
    }
  }

  function handleCloseResult() {
    setBrailleResult("");
    setSourceText("");
    setResultDocument(null);
    setSuccessMessage("");
    setCopyMessage("");
  }

  async function handleConvert(event) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    setCopyMessage("");

    try {
      const { fileName, originalText, sourceType } = await getInputText();
      const conversionMode = detectConversionMode(originalText, sourceType);
      const analysis = analyzeBrailleReadability(originalText, sourceType, conversionMode);
      const textToConvert = useImprovedText ? analysis.improvedText : originalText;
      const brailleText = convertToBraille(textToConvert);
      const tags = normalizeTags([
        ...analysis.suggestedTags,
        ...tagInput.split(",").map((tag) => tag.trim()),
      ]);

      const nextResultDocument = {
        file_name: fileName,
        original_text: textToConvert,
        braille_text: brailleText,
        source_type: sourceType,
        conversion_mode: conversionMode,
        tags,
      };

      setSourceText(textToConvert);
      setBrailleResult(brailleText);
      setResultDocument(nextResultDocument);

      await saveDocumentRecord({
        supabase,
        userId,
        fileName,
        originalText: textToConvert,
        brailleText,
        sourceType,
        conversionMode,
        tags,
      });

      const message = t("upload.conversionSavedMessageShort");
      setSuccessMessage(message);
      setSelectedFile(null);
      setSelectedSourceType("manual");
      setTagInput("");
      onSaved?.();
      onNotify?.({
        type: "success",
        title: t("upload.conversionSaved"),
        message: t("upload.conversionSavedMessage", { name: fileName }),
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, t("upload.conversionFailed"));
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: t("upload.conversionFailedTitle"),
        message: friendlyMessage,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className={`surface-card ${isCompact ? "rounded-2xl p-5 md:p-6" : "rounded-2xl p-6 md:p-8"}`}>
        <form ref={formRef} className="grid gap-6" onSubmit={handleConvert}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">{t("upload.sourceText")}</span>
                <textarea
                  rows={isCompact ? 9 : 11}
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  className="field-input w-full rounded-2xl px-4 py-4 outline-none transition"
                  placeholder={t("upload.sourcePlaceholder")}
                />
              </label>

              <div>
                <p className="mb-2 block text-sm font-semibold text-slate-700">{t("upload.dropzoneTitle")}</p>

                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={handleDropzoneDragOver}
                  onDragLeave={handleDropzoneDragLeave}
                  onDrop={handleDropzoneDrop}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDraggingFile
                      ? "border-violet-500 bg-violet-50/75"
                      : "border-violet-200 bg-white/70 hover:border-violet-300 hover:bg-violet-50/45"
                  }`}
                >
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".txt,.pdf,image/*"
                    onChange={handleDocumentInputChange}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraInputChange}
                    className="hidden"
                  />

                  <div className="flex items-center justify-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-lg text-violet-700">
                      📄
                    </span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-lg text-violet-700">
                      📷
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-900">{t("upload.dropzoneHint")}</p>
                  <p className="mt-1 text-xs text-slate-600">{t("upload.dropzoneSubhint")}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDocumentPicker();
                      }}
                      className="button-secondary rounded-full px-4 py-2 text-xs font-semibold"
                    >
                      {t("upload.uploadDocumentOrImage")}
                    </button>
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        await openCameraPicker();
                      }}
                      className="button-secondary rounded-full px-4 py-2 text-xs font-semibold"
                    >
                      {t("upload.captureWithCamera")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">{t("upload.tags")}</span>
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                    placeholder={t("upload.tagsPlaceholder")}
                  />
                </label>

                <label className="surface-muted flex items-start gap-3 rounded-2xl px-4 py-4">
                  <input
                    type="checkbox"
                    checked={useImprovedText}
                    onChange={(event) => setUseImprovedText(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t("upload.cleanFormatting")}</span>
                  </span>
                </label>
              </div>

              {selectedFile ? (
                <p className="surface-muted rounded-2xl px-4 py-3 text-sm text-slate-700">
                  {t("upload.selectedFile")} <span className="font-semibold">{selectedFile.name}</span>
                </p>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-slate-800/80 bg-slate-900 p-5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-20px_48px_rgba(15,23,42,0.7),0_20px_40px_rgba(2,6,23,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("upload.previewLabel")}</p>
                  <h3 className="mt-2 text-xl font-bold text-white">{t("upload.brailleOutput")}</h3>
                </div>

                {brailleResult ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyResult}
                      className="rounded-full border border-slate-500/70 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:border-violet-400 hover:text-violet-200"
                    >
                      {t("documents.copy")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportResult("docx")}
                      className="rounded-full border border-slate-500/70 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:border-violet-400 hover:text-violet-200"
                    >
                      {t("upload.exportToWord")}
                    </button>
                  </div>
                ) : null}
              </div>

              {copyMessage ? <p className="mt-4 text-sm font-semibold text-emerald-300">{copyMessage}</p> : null}

              <div className="mt-5 min-h-[320px] rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-950 to-slate-900 px-5 py-5 shadow-[inset_0_0_28px_rgba(15,23,42,0.8)]">
                {brailleResult ? (
                  <div className="max-h-[48vh] overflow-y-auto whitespace-pre-wrap break-all text-[2rem] leading-[1.9] text-amber-100 [text-shadow:0_0_10px_rgba(250,204,21,0.38),0_0_20px_rgba(255,255,255,0.16)] md:text-[2.5rem]">
                    {brailleResult}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-center text-sm text-slate-400">
                    {t("upload.previewPlaceholder")}
                  </div>
                )}
              </div>

              {brailleResult ? (
                <button
                  type="button"
                  onClick={handleCloseResult}
                  className="mt-4 button-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
                >
                  {t("upload.closeResult")}
                </button>
              ) : null}
            </aside>
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={saving}
              className="button-primary rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? t("upload.convertingAndSaving") : t("upload.convertToBraille")}
            </button>
          </div>
        </form>
      </div>

      <div className="surface-muted rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{t("upload.readabilityScore")}: {currentAnalysis.readabilityScore}/100</p>
          {suggestedTags.length ? (
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag) => (
                <span key={tag} className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
