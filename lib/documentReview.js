import { convertToBraille } from "./convertToBraille.js";
import { detectLanguage } from "./languageDetection.js";
import { repairPdfPageBreaks } from "./pdfTextLayout.js";
import { detectStructure, paginateTextByStructure } from "./structureDetection.js";

export const PAGE_BREAK_MARKER = "[[BRAILLEVISION_PAGE_BREAK]]";
const DEFAULT_PAGE_TARGET = 1600;

function normalizeReviewText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function splitBrailleDisplayUnits(text) {
  const normalized = normalizeReviewText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function buildAlignedBrailleBlock(block, chunks, state, isLastLeaf = false) {
  const children = Array.isArray(block?.children) ? block.children : [];

  if (!children.length) {
    const sliceEnd = isLastLeaf ? chunks.length : Math.min(state.index + 1, chunks.length);
    const brailleContent = chunks.slice(state.index, sliceEnd).join("\n\n").trim();
    state.index = sliceEnd;

    return {
      ...block,
      brailleContent,
    };
  }

  const alignedChildren = children.map((child, index) =>
    buildAlignedBrailleBlock(child, chunks, state, isLastLeaf && index === children.length - 1),
  );

  return {
    ...block,
    children: alignedChildren,
    brailleContent: alignedChildren
      .map((child) => child.brailleContent)
      .filter(Boolean)
      .join("\n\n")
      .trim(),
  };
}

export function alignBrailleTextToOriginalBlocks(originalBlocks, brailleText) {
  const safeBlocks = Array.isArray(originalBlocks) ? originalBlocks : [];
  const chunks = splitBrailleDisplayUnits(brailleText);
  const state = { index: 0 };

  return safeBlocks.map((block, index) =>
    buildAlignedBrailleBlock(block, chunks, state, index === safeBlocks.length - 1),
  );
}

export function paginateLongText(text, targetLength = DEFAULT_PAGE_TARGET) {
  const normalizedText = normalizeReviewText(text);
  const detectedMode = detectStructure(normalizedText).mode;

  if (!normalizedText) {
    return [];
  }

  return paginateTextByStructure(normalizedText, { mode: detectedMode, targetLength });
}

export function joinPagesForStorage(pages) {
  const safePages = (pages || []).map(normalizeReviewText).filter(Boolean);

  if (safePages.length <= 1) {
    return safePages[0] || "";
  }

  return safePages.join(`\n${PAGE_BREAK_MARKER}\n`);
}

function repairPagesForSourceType(pages, sourceType = "manual") {
  if (sourceType !== "pdf") {
    return pages;
  }

  return repairPdfPageBreaks(pages);
}

function shouldPreserveStoredPdfAsSinglePage(text, sourceType = "manual") {
  if (sourceType !== "pdf") {
    return false;
  }

  const normalizedText = normalizeReviewText(text);

  if (!normalizedText || normalizedText.includes(PAGE_BREAK_MARKER)) {
    return false;
  }

  return true;
}

export function splitStoredTextIntoPages(text, sourceType = "manual") {
  const normalizedText = normalizeReviewText(text);

  if (!normalizedText) {
    return [];
  }

  if (normalizedText.includes(PAGE_BREAK_MARKER)) {
    return repairPagesForSourceType(
      normalizedText
      .split(PAGE_BREAK_MARKER)
      .map((page) => normalizeReviewText(page))
      .filter(Boolean),
      sourceType,
    );
  }

  if (shouldPreserveStoredPdfAsSinglePage(normalizedText, sourceType)) {
    return [normalizedText];
  }

  return paginateLongText(normalizedText);
}

export function stripStoredPageMarkers(text, sourceType = "manual") {
  return splitStoredTextIntoPages(text, sourceType).join("\n\n");
}

export function isReaderRecommended({ sourceType = "manual", originalText = "" }) {
  const pages = splitStoredTextIntoPages(originalText, sourceType);
  const plainText = stripStoredPageMarkers(originalText, sourceType);

  if (pages.length > 1) {
    return true;
  }

  if (sourceType === "pdf" && plainText.length > 1000) {
    return true;
  }

  return plainText.length > 2200;
}

export function buildReviewPagesFromDocument(document) {
  const originalPages = splitStoredTextIntoPages(document?.original_text, document?.source_type);
  const braillePages = splitStoredTextIntoPages(document?.braille_text, document?.source_type);

  return originalPages.map((pageText, index) => ({
    pageNumber: index + 1,
    originalText: pageText,
    brailleText: braillePages[index] || convertToBraille(pageText),
    structureMode: detectStructure(pageText, { sourceType: document?.source_type }).mode,
    language: detectLanguage(pageText).language,
  }));
}
