import { normalizeTurkishExtractedText } from "./turkishTextNormalization.js";
import { normalizePdfMathOcrText } from "./pdfMathTextNormalization.js";
import {
  hasSevereMathOcrCorruption,
  scorePdfMathTextQuality,
  selectBestPdfMathCandidate,
} from "./pdfExtractionHeuristics.js";
import { readErrorResponseMessage } from "./readErrorResponse.js";

function looksMathHeavyExtractedText(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    return false;
  }

  return (
    /[=≠≤≥∞∫√±×÷→←↔⇔∈∉^/_]/u.test(normalized) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt)\b/iu.test(normalized) ||
    /\b[fgh]\(x\)\b/u.test(normalized) ||
    /\b\d+\.\s+[A-Za-z][^:\n]{1,60}:/u.test(normalized)
  );
}

function shouldRetryImageWithMathProfile(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    return true;
  }

  return looksMathHeavyExtractedText(normalized) || hasSevereMathOcrCorruption(normalized) || scorePdfMathTextQuality(normalized) <= -10;
}

export async function extractImageTextFromBlob(blob, filename = "image.png", options = {}) {
  const sourceType = options.sourceType || "ocr";
  const profile = options.profile || "image";
  const draftText = String(options.draftText || "").trim();

  // Use Gemini Vision on the backend instead of local Tesseract
  // This provides accurate math extraction and valid Turkish text
  const formData = new FormData();
  formData.append("image", blob, filename);
  formData.append("profile", profile);
  if (draftText) {
    formData.append("draft_text", draftText);
  }

  try {
    const response = await fetch("/api/extract_image_text_full", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorMessage = await readErrorResponseMessage(response);
      throw new Error(errorMessage || `Server error: ${response.status}`);
    }

    const data = await response.json();
    let extractedText = data.text;
    
    // Clear markdown code blocks if the model accidentally included them
    extractedText = extractedText.replace(/^```[a-z]*\n/gm, "").replace(/```$/gm, "");

    if (profile === "pdf_math") {
      extractedText = normalizePdfMathOcrText(extractedText);
    }

    const normalizedText = normalizeTurkishExtractedText(extractedText, {
      sourceType,
    }).trim();

    if (!normalizedText) {
      throw new Error("No readable text or math formulas were found in the selected image.");
    }

    return normalizedText;
  } catch (err) {
    console.error("Gemini API image extraction failed:", err);
    throw new Error("Görsel okunurken bir hata oluştu veya API kullanılamıyor. Lütfen tekrar deneyin.");
  }
}

export async function extractImageText(file) {
  const filename = file?.name || "image.png";
  const firstPassText = await extractImageTextFromBlob(file, filename, {
    sourceType: "ocr",
    profile: "image",
  });

  if (!shouldRetryImageWithMathProfile(firstPassText)) {
    return firstPassText;
  }

  try {
    const mathPassText = await extractImageTextFromBlob(file, filename, {
      sourceType: "ocr",
      profile: "pdf_math",
      draftText: firstPassText,
    });

    return selectBestPdfMathCandidate(firstPassText, mathPassText);
  } catch (error) {
    console.warn("Math-focused image OCR retry failed:", error);
    return firstPassText;
  }
}
