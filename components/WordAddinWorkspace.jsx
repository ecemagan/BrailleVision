"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/components/I18nProvider";
import { saveDocumentRecord } from "@/lib/documents";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

const backendBase = typeof window !== "undefined" ? window.location.origin : "";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function speakText(text, lang) {
  if (!text || !window.speechSynthesis) {
    return;
  }
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

async function insertIntoWordDocument(title, contentLines) {
  if (!window.Word) {
    throw new Error("Word runtime is not available.");
  }

  await window.Word.run(async (context) => {
    const body = context.document.body;

    const divider = body.insertParagraph("─".repeat(40), window.Word.InsertLocation.end);
    divider.font.color = "#7c3aed";
    divider.font.size = 9;

    const heading = body.insertParagraph(title, window.Word.InsertLocation.end);
    heading.font.bold = true;
    heading.font.color = "#5b21b6";
    heading.font.size = 11;

    contentLines.forEach((line) => {
      const paragraph = body.insertParagraph(line, window.Word.InsertLocation.end);
      paragraph.font.size = 10;

      if (line.startsWith("Nemeth Braille:") || line.startsWith("Braille Translation:")) {
        paragraph.font.size = 13;
        paragraph.font.bold = true;
        paragraph.font.color = "#1e1b4b";
      }
    });

    await context.sync();
  });
}

function ResultCard({ result, onCopy, onDownload, onInsert, onSpeak, t }) {
  return (
    <article className="surface-card rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="accent-label text-xs font-semibold uppercase tracking-[0.22em]">{result.kind}</p>
          <h3 className="font-display mt-3 text-2xl font-bold text-slate-950">{result.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{result.timestamp}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onInsert(result)}
            className="button-primary rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            {t("wordAddin.insertToWord")}
          </button>
          <button
            type="button"
            onClick={() => onCopy(result.brailleText)}
            className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            {t("wordAddin.copy")}
          </button>
          <button
            type="button"
            onClick={() => onDownload(result)}
            className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            {t("wordAddin.download")}
          </button>
          <button
            type="button"
            onClick={() => onSpeak(result.speakText)}
            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
          >
            {t("wordAddin.listen")}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("wordAddin.source")}</p>
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{result.sourceText}</p>
        </div>

        {result.explanation ? (
          <div className="glass-card rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">{t("wordAddin.explanation")}</p>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{result.explanation}</p>
          </div>
        ) : null}

        <div className="glass-card rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(216,180,254,0.42),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,255,0.92))] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">{t("wordAddin.brailleOutput")}</p>
          <p className="mt-3 break-all text-xl leading-8 text-slate-950">{result.brailleText}</p>
        </div>
      </div>
    </article>
  );
}

export function WordAddinWorkspace() {
  const initializedRef = useRef(false);
  const { supabase, user, loading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const [officeScriptLoaded, setOfficeScriptLoaded] = useState(false);
  const [officeReady, setOfficeReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!officeScriptLoaded || initializedRef.current || !window.Office) {
      return;
    }

    initializedRef.current = true;

    window.Office.onReady(async (info) => {
      if (info.host !== window.Office.HostType.Word) {
        setErrorMessage(t("wordAddin.workspaceDesignedForWord"));
        return;
      }

      setOfficeReady(true);

      try {
        const response = await fetch(`${backendBase}/backend-health`, { signal: AbortSignal.timeout(3000) });
        setBackendStatus(response.ok ? "online" : "offline");
      } catch {
        setBackendStatus("offline");
      }
    });
  }, [officeScriptLoaded, t]);

  async function getSelectionText() {
    return window.Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();
      return selection.text;
    });
  }

  async function getDocumentText() {
    return window.Word.run(async (context) => {
      const body = context.document.body;
      body.load("text");
      await context.sync();
      return body.text;
    });
  }

  async function runAction(work) {
    setLoading(true);
    setErrorMessage("");
    setActionMessage("");

    try {
      await work();
    } catch (error) {
      setErrorMessage(getFriendlyDocumentMessage(error, t("wordAddin.actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function translateSelection(mode) {
    await runAction(async () => {
      if (!officeReady) {
        throw new Error(t("wordAddin.openInWord"));
      }

      const selectedText = (await getSelectionText())?.trim();

      if (!selectedText) {
        throw new Error(t("wordAddin.selectTextFirst"));
      }

      if (mode === "alpha") {
        await requestAlphaTranslation(selectedText);
        return;
      }

      await requestMathTranslation(selectedText);
    });
  }

  async function translateDocument() {
    await runAction(async () => {
      if (!officeReady) {
        throw new Error(t("wordAddin.openInWord"));
      }

      const documentText = (await getDocumentText())?.trim();

      if (!documentText) {
        throw new Error(t("wordAddin.documentEmpty"));
      }

      await requestAlphaTranslation(documentText);
    });
  }

  async function requestAlphaTranslation(text) {
    const response = await fetch(`${backendBase}/api/translate_braille_text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Request failed (${response.status}).`);
    }

    const data = await response.json();
    const nextResult = {
      id: createId(),
      kind: t("wordAddin.selectedText"),
      title: t("wordAddin.grade1OutputTitle"),
      timestamp: new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
      sourceText: data.original,
      brailleText: data.braille,
      explanation: "",
      speakText: data.original,
      downloadName: "BrailleVision_Alfabesi.txt",
      insertTitle: t("wordAddin.textTranslationInsertTitle"),
      insertLines: [
        `${t("wordAddin.originalTextLabel")}:`,
        data.original,
        "",
        `${t("wordAddin.brailleTranslationLabel")}:`,
        data.braille,
      ],
      historyFileName: `word-selection-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
      conversionMode: "text",
    };

    setResults([nextResult]);
    await syncResultsToHistory([nextResult]);
  }

  async function requestMathTranslation(text) {
    const response = await fetch(`${backendBase}/api/process_text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Request failed (${response.status}).`);
    }

    const data = await response.json();
    const nextResults = (data.results || [])
      .filter((item) => !item.error)
      .map((item, index) => ({
        id: createId(),
        kind: t("wordAddin.mathSelection"),
        title: t("wordAddin.nemethOutputTitle", { index: index + 1 }),
        timestamp: new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date()),
        sourceText: item.expression,
        brailleText: item.braille,
        explanation: item.explanation || "",
        speakText: item.explanation || item.expression,
        downloadName: `BrailleVision_Nemeth_${index + 1}.txt`,
        insertTitle: t("wordAddin.mathTranslationInsertTitle"),
        insertLines: [
          item.expression,
          `${t("wordAddin.nemethBrailleLabel")}: ${item.braille}`,
          ...(item.explanation ? [`${t("wordAddin.explanationLabel")}: ${item.explanation}`] : []),
        ],
        historyFileName: `word-math-${index + 1}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
        conversionMode: "nemeth",
      }));

    if (nextResults.length === 0) {
      throw new Error(t("wordAddin.noMathExpression"));
    }

    setResults(nextResults);
    await syncResultsToHistory(nextResults);
  }

  async function syncResultsToHistory(items) {
    if (!user || !supabase) {
      setActionMessage(
        authLoading
          ? t("wordAddin.conversionReadySessionLoading")
          : t("wordAddin.conversionReadyLoginToSave"),
      );
      return;
    }

    await Promise.all(
      items.map((item) =>
        saveDocumentRecord({
          supabase,
          userId: user.id,
          fileName: item.historyFileName,
          originalText: item.sourceText,
          brailleText: item.brailleText,
          sourceType: "word-addin",
          conversionMode: item.conversionMode,
        }),
      ),
    );

    setActionMessage(t("wordAddin.conversionReadySynced"));
  }

  async function handleInsert(result) {
    await runAction(async () => {
      await insertIntoWordDocument(result.insertTitle, result.insertLines);
      setActionMessage(t("wordAddin.resultInserted"));
    });
  }

  async function handleCopy(text) {
    await runAction(async () => {
      await copyToClipboard(text);
      setActionMessage(t("wordAddin.brailleCopied"));
    });
  }

  function handleDownload(result) {
    downloadTextFile(result.insertLines.join("\n"), result.downloadName);
    setActionMessage(t("wordAddin.textFileDownloaded"));
  }

  function handleSpeak(text) {
    const speechLang = locale === "tr" ? "tr-TR" : "en-US";
    speakText(text, speechLang);
    setActionMessage(t("wordAddin.readingStarted"));
  }

  const statusTone =
    backendStatus === "online"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : backendStatus === "offline"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-violet-200 bg-violet-50 text-violet-700";

  return (
    <>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
        onLoad={() => setOfficeScriptLoaded(true)}
      />

      <main className="page-shell">
        <div className="relative mx-auto grid max-w-7xl gap-6 pt-16 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="absolute left-0 top-4 z-20 md:top-6">
            <BackButton />
          </div>

          <section className="surface-card hero-wash rounded-2xl p-6 md:p-8 xl:sticky xl:top-6 xl:self-start">
            <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
              {t("wordAddin.title")}
            </div>
            <h1 className="font-display mt-5 text-4xl font-bold tracking-tight text-slate-950">
              {t("wordAddin.subtitle")}
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              {t("wordAddin.description")}
            </p>

            <div className={`glass-card mt-6 rounded-2xl border px-4 py-4 text-sm font-semibold ${statusTone}`}>
              <p>
                {t("wordAddin.statusWordHost")}: {officeReady ? t("wordAddin.connected") : officeScriptLoaded ? t("wordAddin.waitingForWord") : t("wordAddin.loadingOfficeJs")}
              </p>
              <p className="mt-1">
                {t("wordAddin.statusBackend")}: {backendStatus === "online" ? t("wordAddin.connected") : backendStatus === "offline" ? t("wordAddin.offline") : t("wordAddin.checking")}
              </p>
              <p className="mt-1">{t("wordAddin.statusHistorySync")}: {user ? t("wordAddin.signedIn") : authLoading ? t("auth.checkingSession") : t("wordAddin.notSignedIn")}</p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => translateSelection("alpha")}
                disabled={loading}
                className="button-primary rounded-3xl px-5 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-100">{t("wordAddin.selectedText")}</span>
                <span className="font-display mt-2 block text-2xl font-bold text-white">{t("wordAddin.convertGrade1")}</span>
                <span className="mt-2 block text-sm text-violet-100">{t("wordAddin.selectedTextDesc")}</span>
              </button>

              <button
                type="button"
                onClick={() => translateSelection("math")}
                disabled={loading}
                className="surface-soft rounded-3xl px-5 py-4 text-left transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">{t("wordAddin.mathSelection")}</span>
                <span className="font-display mt-2 block text-2xl font-bold text-slate-950">{t("wordAddin.convertNemeth")}</span>
                <span className="mt-2 block text-sm text-slate-600">{t("wordAddin.mathSelectionDesc")}</span>
              </button>

              <button
                type="button"
                onClick={translateDocument}
                disabled={loading}
                className="surface-soft rounded-3xl px-5 py-4 text-left transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">{t("wordAddin.fullDocument")}</span>
                <span className="font-display mt-2 block text-2xl font-bold text-slate-950">{t("wordAddin.convertEntireDocument")}</span>
                <span className="mt-2 block text-sm text-slate-600">{t("wordAddin.fullDocumentDesc")}</span>
              </button>
            </div>

            <div className="glass-card mt-6 rounded-2xl p-4 text-sm leading-7 text-slate-600">
              {t("wordAddin.keepBackendOpen")}
            </div>
          </section>

          <section className="space-y-6">
            {loading ? (
              <div className="surface-card rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                  <div>
                    <p className="font-display text-2xl font-bold text-slate-950">{t("wordAddin.convertingInProgress")}</p>
                    <p className="mt-1 text-sm text-slate-600">{t("wordAddin.wordContentSending")}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            {actionMessage ? (
              <p className="rounded-3xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-700">
                {actionMessage}
              </p>
            ) : null}

            {results.length === 0 ? (
              <div className="surface-card rounded-2xl p-8 text-center">
                <p className="font-display text-3xl font-bold text-slate-950">{t("wordAddin.noConversionYet")}</p>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  {t("wordAddin.noConversionDescription")}
                </p>
              </div>
            ) : null}

            {results.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                onCopy={handleCopy}
                onDownload={handleDownload}
                onInsert={handleInsert}
                onSpeak={handleSpeak}
                t={t}
              />
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
