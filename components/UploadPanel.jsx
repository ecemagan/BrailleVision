"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeBrailleReadability, suggestDocumentTags } from "@/lib/brailleAssistant";
import { convertToBraille } from "@/lib/convertToBraille";
import { normalizeTags, saveDocumentRecord } from "@/lib/documents";
import { exportDocuments } from "@/lib/exportDocuments";
import { extractImageText } from "@/lib/extractImageText";
import { extractPdfText } from "@/lib/extractPdfText";
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
  const formRef = useRef(null);
  const resultRef = useRef(null);
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

  function scrollToResult() {
    if (!resultRef.current) {
      return;
    }

    const targetTop = resultRef.current.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo(0, Math.max(targetTop, 0));
  }

  useEffect(() => {
    if (quickSaveSignal > 0 && isActive) {
      formRef.current?.requestSubmit();
    }
  }, [isActive, quickSaveSignal]);

  useEffect(() => {
    if (!brailleResult) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      scrollToResult();
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [brailleResult]);

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

      throw new Error("Please upload a .txt, .pdf, or image file.");
    }

    if (manualText.trim()) {
      return {
        fileName: "manual-input.txt",
        originalText: manualText.trim(),
        sourceType: "manual",
      };
    }

    throw new Error("Add text or choose a file before converting.");
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
      setCopyMessage("Braille output copied.");
      onNotify?.({
        type: "success",
        title: "Braille copied",
        message: "The converted Braille output was copied to the clipboard.",
      });
      window.setTimeout(() => setCopyMessage(""), 2200);
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "Clipboard access is blocked in this browser tab.");
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: "Clipboard blocked",
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
        title: "Export complete",
        message: `${resultDocument.file_name} exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "The export could not be completed.");
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: "Export failed",
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

      const message = "Conversion saved to your library.";
      setSuccessMessage(message);
      setSelectedFile(null);
      setSelectedSourceType("manual");
      setTagInput("");
      onSaved?.();
      window.requestAnimationFrame(() => {
        scrollToResult();
        window.setTimeout(scrollToResult, 220);
      });
      onNotify?.({
        type: "success",
        title: "Conversion saved",
        message: `${fileName} is ready to review, copy, or export.`,
      });
    } catch (error) {
      const friendlyMessage = getFriendlyDocumentMessage(error, "The upload could not be converted right now.");
      setErrorMessage(friendlyMessage);
      onNotify?.({
        type: "error",
        title: "Conversion failed",
        message: friendlyMessage,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className={`surface-card ${isCompact ? "rounded-[24px] p-5 md:p-6" : "rounded-[28px] p-6 md:p-8"}`}>
        <form ref={formRef} className="grid gap-5" onSubmit={handleConvert}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Source text</span>
            <textarea
              rows={isCompact ? 6 : 8}
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              className="field-input w-full rounded-[24px] px-4 py-4 outline-none transition"
              placeholder="Paste or type the text you want to convert."
            />
          </label>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Upload document or image</span>
              <input
                type="file"
                accept=".txt,.pdf,image/*"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setSelectedSourceType("image");
                }}
                className="field-input w-full rounded-[24px] border border-dashed px-4 py-3 text-sm text-slate-600"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Capture with camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setSelectedSourceType("camera");
                }}
                className="field-input w-full rounded-[24px] border border-dashed px-4 py-3 text-sm text-slate-600"
              />
            </label>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tags</span>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                className="field-input w-full rounded-2xl px-4 py-3 outline-none transition"
                placeholder="Optional: exam, chapter-3, math"
              />
            </label>

            <label className="surface-muted flex items-start gap-3 rounded-[24px] px-4 py-4">
              <input
                type="checkbox"
                checked={useImprovedText}
                onChange={(event) => setUseImprovedText(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Clean formatting before conversion</span>
              </span>
            </label>
          </div>

          {selectedFile ? (
            <p className="surface-muted rounded-2xl px-4 py-3 text-sm text-slate-700">
              Selected file: <span className="font-semibold">{selectedFile.name}</span>
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="button-primary rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Converting and saving..." : "Convert to Braille"}
            </button>

            {brailleResult ? (
              <button
                type="button"
                onClick={handleCloseResult}
                className="button-secondary rounded-full px-6 py-3 font-semibold transition"
              >
                Close result
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {brailleResult ? (
        <div ref={resultRef} className="grid gap-6">
          <article className={`surface-card ${isCompact ? "rounded-[24px] p-5" : "rounded-[30px] p-7"}`}>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                  {resultDocument?.file_name || "Braille output"}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Copy Braille
                </button>
                <button
                  type="button"
                  onClick={() => handleExportResult("txt")}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Download .txt
                </button>
                <button
                  type="button"
                  onClick={() => handleExportResult("docx")}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Download .docx
                </button>
                <button
                  type="button"
                  onClick={() => handleExportResult("pdf")}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Download .pdf
                </button>
              </div>
            </div>

            {copyMessage ? <p className="mt-4 text-sm font-semibold text-emerald-700">{copyMessage}</p> : null}

            <div className="mt-6 rounded-[26px] border border-slate-200 bg-white px-5 py-6">
              <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-all text-[2.1rem] leading-[1.95] text-slate-950 md:text-[2.8rem]">
                {brailleResult}
              </div>
            </div>
          </article>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <article className={`surface-card ${isCompact ? "rounded-[24px] p-5" : "rounded-[28px] p-6"}`}>
              <h3 className="text-2xl font-bold text-slate-950">Original text</h3>
              <div className="mt-4 max-h-[36vh] overflow-y-auto whitespace-pre-wrap text-base leading-7 text-slate-700">
                {sourceText}
              </div>
            </article>

            <aside className={`surface-muted ${isCompact ? "rounded-[24px] p-5" : "rounded-[28px] p-6"}`}>
              <p className="text-3xl font-bold text-slate-950">{currentAnalysis.readabilityScore}/100</p>
              {suggestedTags.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {suggestedTags.map((tag) => (
                    <span key={tag} className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
