import { reconstructPdfPageLines, reconstructPdfPageText, repairPdfPageBreaks } from "@/lib/pdfTextLayout";
import { extractImageTextFromBlob } from "@/lib/extractImageText";
import {
  looksMathHeavyPdfPage,
  selectBestPdfMathCandidate,
  shouldPreferOcrForPdfTextLayer,
} from "@/lib/pdfExtractionHeuristics";
import { normalizeTurkishExtractedText } from "@/lib/turkishTextNormalization";

async function renderPdfPageToBlob(page, scale = 2.2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is not available in this browser.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render PDF page as image."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

// Client-side PDF text extraction using Mozilla PDF.js.
export async function extractPdfContent(file) {
  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts = [];
  const pageLayouts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const pageLines = reconstructPdfPageLines(textContent.items);
    const reconstructedPageText = reconstructPdfPageText(textContent.items);
    let pageText = normalizeTurkishExtractedText(reconstructedPageText, {
      sourceType: "pdf",
      mode: "line-preserved",
    });

    const shouldTryOcr =
      shouldPreferOcrForPdfTextLayer(pageText, textContent.items) ||
      looksMathHeavyPdfPage(pageText, textContent.items);

    if (shouldTryOcr) {
      try {
        const blob = await renderPdfPageToBlob(page, 3.2);
        const ocrPageText = await extractImageTextFromBlob(blob, `pdf-page-${pageNumber}.png`, {
          sourceType: "pdf",
          profile: "pdf_math",
          draftText: pageText,
        });

        if (ocrPageText.trim()) {
          pageText = selectBestPdfMathCandidate(pageText, ocrPageText);
        }
      } catch (error) {
        console.warn(`PDF OCR fallback failed on page ${pageNumber}:`, error);
      }
    }

    if (pageText) {
      pageTexts.push(pageText);
    }

    pageLayouts.push({
      pageNumber,
      width: Number(viewport?.width || 0),
      height: Number(viewport?.height || 0),
      lines: pageLines,
      source: "pdf-text-layer",
    });
  }

  const repairedPages = repairPdfPageBreaks(pageTexts).filter(Boolean);
  const extractedText = repairedPages.join("\n\n").trim();

  if (!extractedText) {
    throw new Error("This PDF does not contain selectable text. OCR support is not added yet.");
  }

  return {
    text: extractedText,
    pages: repairedPages,
    pageLayouts,
  };
}

export async function extractPdfText(file) {
  const result = await extractPdfContent(file);
  return result.text;
}
