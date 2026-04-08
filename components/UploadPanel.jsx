"use client";

import { useState } from "react";
import { convertToBraille } from "@/lib/convertToBraille";
import { extractPdfText } from "@/lib/extractPdfText";

export function UploadPanel({ userId, supabase, onSaved }) {
  const [manualText, setManualText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [brailleResult, setBrailleResult] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function getInputText() {
    if (selectedFile) {
      const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();

      if (fileExtension === "txt") {
        return {
          fileName: selectedFile.name,
          originalText: await selectedFile.text(),
        };
      }

      if (fileExtension === "pdf") {
        return {
          fileName: selectedFile.name,
          originalText: await extractPdfText(selectedFile),
        };
      }

      throw new Error("Please upload a .txt or .pdf file.");
    }

    if (manualText.trim()) {
      return {
        fileName: "manual-input.txt",
        originalText: manualText.trim(),
      };
    }

    throw new Error("Add text or choose a file before converting.");
  }

  async function handleConvert(event) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { fileName, originalText } = await getInputText();
      const brailleText = convertToBraille(originalText);

      setSourceText(originalText);
      setBrailleResult(brailleText);

      // Every saved conversion is tied to the logged-in user.
      const { error } = await supabase.from("documents").insert({
        user_id: userId,
        file_name: fileName,
        original_text: originalText,
        braille_text: brailleText,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Conversion saved to Supabase.");
      setManualText("");
      setSelectedFile(null);
      onSaved?.();
    } catch (error) {
      setErrorMessage(error.message || "Could not convert the document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Upload</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-slate-950">Convert text to Braille</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Paste text directly, or upload a `.txt` or `.pdf` file. Text, math, and selectable PDF text are converted for real.
          </p>
        </div>

        <form className="mt-8 grid gap-5" onSubmit={handleConvert}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Paste text</span>
            <textarea
              rows={7}
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              className="field-input w-full rounded-[24px] px-4 py-3 outline-none transition"
              placeholder="Paste content here if you do not want to upload a file."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Upload file</span>
            <input
              type="file"
              accept=".txt,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-[24px] border border-dashed border-violet-200 bg-white/80 px-4 py-3 text-sm text-slate-600"
            />
          </label>

          {selectedFile ? (
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Selected file: <span className="font-semibold">{selectedFile.name}</span>
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="button-primary w-full rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Converting and saving..." : "Convert to Braille"}
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="surface-card rounded-[28px] p-6">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Original text</p>
          <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-700">
            {sourceText || "Your extracted or pasted text will appear here after conversion."}
          </p>
        </article>

        <article className="surface-card surface-soft rounded-[28px] p-6">
          <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Braille output</p>
          <p className="mt-4 break-all text-3xl leading-relaxed text-slate-950">
            {brailleResult || "⠤⠤⠤"}
          </p>
        </article>
      </div>
    </section>
  );
}
