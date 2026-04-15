"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { saveDocumentRecord } from "@/lib/documents";
import { getFriendlyDocumentMessage } from "@/lib/userMessages";

const backendBase = "";

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

function speakText(text) {
  if (!text || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "tr-TR";
  window.speechSynthesis.speak(utterance);
}

async function insertIntoWordDocument(title, contentLines) {
  if (!window.Word) {
    throw new Error("Word context is not available.");
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

      if (line.startsWith("Nemeth Braille:") || line.startsWith("Braille Çevirisi:")) {
        paragraph.font.size = 13;
        paragraph.font.bold = true;
        paragraph.font.color = "#1e1b4b";
      }
    });

    await context.sync();
  });
}

function ResultCard({ result, onCopy, onDownload, onInsert, onSpeak }) {
  return (
    <article className="surface-card rounded-[28px] p-5 md:p-6">
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
            Insert to Word
          </button>
          <button
            type="button"
            onClick={() => onCopy(result.brailleText)}
            className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => onDownload(result)}
            className="button-secondary rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => onSpeak(result.speakText)}
            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
          >
            Listen
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source</p>
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{result.sourceText}</p>
        </div>

        {result.explanation ? (
          <div className="rounded-[24px] border border-violet-100 bg-violet-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Explanation</p>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{result.explanation}</p>
          </div>
        ) : null}

        <div className="rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(216,180,254,0.42),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,238,255,0.92))] p-4 shadow-[0_24px_60px_rgba(124,58,237,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Braille output</p>
          <p className="mt-3 break-all text-xl leading-8 text-slate-950">{result.brailleText}</p>
        </div>
      </div>
    </article>
  );
}

export function WordAddinWorkspace() {
  const initializedRef = useRef(false);
  const { supabase, user, loading: authLoading } = useAuth();
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
        setErrorMessage("This workspace is designed to run inside Microsoft Word.");
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
  }, [officeScriptLoaded]);

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
      setErrorMessage(getFriendlyDocumentMessage(error, "The Word add-in action failed."));
    } finally {
      setLoading(false);
    }
  }

  async function translateSelection(mode) {
    await runAction(async () => {
      if (!officeReady) {
        throw new Error("Open this page inside Word before using the add-in actions.");
      }

      const selectedText = (await getSelectionText())?.trim();

      if (!selectedText) {
        throw new Error("Select text in Word first.");
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
        throw new Error("Open this page inside Word before using the add-in actions.");
      }

      const documentText = (await getDocumentText())?.trim();

      if (!documentText) {
        throw new Error("The current Word document appears to be empty.");
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
      throw new Error(error.detail || `Request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const nextResult = {
      id: createId(),
      kind: "Selected text",
      title: "Grade 1 Braille output",
      timestamp: new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
      sourceText: data.original,
      brailleText: data.braille,
      explanation: "",
      speakText: data.original,
      downloadName: "BrailleVision_Alfabesi.txt",
      insertTitle: "BrailleVision – Metin Çevirisi",
      insertLines: [data.braille],
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
      throw new Error(error.detail || `Request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const nextResults = (data.results || [])
      .filter((item) => !item.error)
      .map((item, index) => ({
        id: createId(),
        kind: "Math selection",
        title: `Nemeth output ${index + 1}`,
        timestamp: new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date()),
        sourceText: item.expression,
        brailleText: item.braille,
        explanation: item.explanation || "",
        speakText: item.explanation || item.expression,
        downloadName: `BrailleVision_Nemeth_${index + 1}.txt`,
        insertTitle: "BrailleVision – Matematik Çevirisi",
        insertLines: [
          item.expression,
          `Nemeth Braille: ${item.braille}`,
          ...(item.explanation ? [`Açıklama: ${item.explanation}`] : []),
        ],
        historyFileName: `word-math-${index + 1}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
        conversionMode: "nemeth",
      }));

    if (nextResults.length === 0) {
      throw new Error("No mathematical expression was returned from the backend.");
    }

    setResults(nextResults);
    await syncResultsToHistory(nextResults);
  }

  async function syncResultsToHistory(items) {
    if (!user || !supabase) {
      setActionMessage(
        authLoading
          ? "Conversion is ready. Session sync is still loading."
          : "Conversion is ready. Log in to save it to the dashboard history.",
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

    setActionMessage("Conversion is ready and synced to your dashboard history.");
  }

  async function handleInsert(result) {
    await runAction(async () => {
      await insertIntoWordDocument(result.insertTitle, result.insertLines);
      setActionMessage("Result inserted into the current Word document.");
    });
  }

  async function handleCopy(text) {
    await runAction(async () => {
      await copyToClipboard(text);
      setActionMessage("Braille copied to clipboard.");
    });
  }

  function handleDownload(result) {
    downloadTextFile(result.insertLines.join("\n"), result.downloadName);
    setActionMessage("Text file downloaded.");
  }

  function handleSpeak(text) {
    speakText(text);
    setActionMessage("Reading started.");
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
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="surface-card hero-wash rounded-[32px] p-6 md:p-8 xl:sticky xl:top-6 xl:self-start">
            <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
              Braille Vision for Word
            </div>
            <h1 className="font-display mt-5 text-4xl font-bold tracking-tight text-slate-950">
              Convert selected text and math inside Microsoft Word.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              The add-in keeps the existing Word workflow, but with the new lilac workspace. Select content in Word,
              trigger a conversion, then insert or export the result.
            </p>

            <div className={`mt-6 rounded-[24px] border px-4 py-4 text-sm font-semibold ${statusTone}`}>
              <p>
                Word host: {officeReady ? "Connected" : officeScriptLoaded ? "Waiting for Word" : "Loading Office.js"}
              </p>
              <p className="mt-1">
                Backend:{" "}
                {backendStatus === "online" ? "Connected" : backendStatus === "offline" ? "Offline" : "Checking"}
              </p>
              <p className="mt-1">History sync: {user ? "Signed in" : authLoading ? "Checking session" : "Not signed in"}</p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => translateSelection("alpha")}
                disabled={loading}
                className="button-primary rounded-[24px] px-5 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-100">Selected text</span>
                <span className="font-display mt-2 block text-2xl font-bold text-white">Convert to Grade 1 Braille</span>
                <span className="mt-2 block text-sm text-violet-100">Reads the active Word selection and returns Braille output.</span>
              </button>

              <button
                type="button"
                onClick={() => translateSelection("math")}
                disabled={loading}
                className="surface-soft rounded-[24px] px-5 py-4 text-left transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Math selection</span>
                <span className="font-display mt-2 block text-2xl font-bold text-slate-950">Convert to Nemeth</span>
                <span className="mt-2 block text-sm text-slate-600">Use the existing math backend for selected equations or expressions.</span>
              </button>

              <button
                type="button"
                onClick={translateDocument}
                disabled={loading}
                className="surface-soft rounded-[24px] px-5 py-4 text-left transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Full document</span>
                <span className="font-display mt-2 block text-2xl font-bold text-slate-950">Convert the entire document</span>
                <span className="mt-2 block text-sm text-slate-600">Reads the full Word document and generates a text-to-Braille result.</span>
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 p-4 text-sm leading-7 text-slate-600">
              Keep the Python backend and this Word gateway open while testing. Sideloading still uses the same manifest flow.
            </div>
          </section>

          <section className="space-y-6">
            {loading ? (
              <div className="surface-card rounded-[28px] p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                  <div>
                    <p className="font-display text-2xl font-bold text-slate-950">Converting in progress</p>
                    <p className="mt-1 text-sm text-slate-600">Word content is being sent through the existing Braille backend.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            {actionMessage ? (
              <p className="rounded-[24px] border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-700">
                {actionMessage}
              </p>
            ) : null}

            {results.length === 0 ? (
              <div className="surface-card rounded-[28px] p-8 text-center">
                <p className="font-display text-3xl font-bold text-slate-950">No conversion yet</p>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Open the task pane inside Word, select text or math, and run one of the actions on the left. The results
                  will appear here with insert, copy, listen, and download controls.
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
              />
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
