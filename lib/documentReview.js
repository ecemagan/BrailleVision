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

function splitOriginalDisplayUnits(text) {
  const normalized = normalizeReviewText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function splitBrailleTextToMatchOriginalPages(originalPages, brailleText) {
  const safeOriginalPages = Array.isArray(originalPages) ? originalPages : [];
  const normalizedBraille = normalizeReviewText(brailleText);

  if (safeOriginalPages.length <= 1) {
    return [normalizedBraille];
  }

  const chunks = splitBrailleDisplayUnits(normalizedBraille);

  if (chunks.length === 0) {
    return safeOriginalPages.map(() => "");
  }

  const desiredCounts = safeOriginalPages.map((pageText) => splitOriginalDisplayUnits(pageText).length);
  const normalizedDesired = desiredCounts.map((count) => (count > 0 ? count : 0));
  const totalDesired = normalizedDesired.reduce((sum, count) => sum + count, 0);

  if (totalDesired === 0) {
    return [chunks.join("\n\n").trim()];
  }

  const pageCount = safeOriginalPages.length;
  const pages = [];
  let chunkIndex = 0;

  for (let index = 0; index < pageCount; index += 1) {
    const remainingChunks = chunks.length - chunkIndex;
    const desired = normalizedDesired[index];

    if (index === pageCount - 1) {
      pages.push(chunks.slice(chunkIndex).join("\n\n").trim());
      break;
    }

    if (!desired) {
      pages.push("");
      continue;
    }

    const nonEmptyPagesRemainingAfter = normalizedDesired
      .slice(index + 1)
      .filter((count) => count > 0)
      .length;
    const minChunksToKeep = Math.min(nonEmptyPagesRemainingAfter, Math.max(remainingChunks - 1, 0));
    const maxTake = Math.max(remainingChunks - minChunksToKeep, 1);

    const proportional = Math.round((chunks.length * desired) / totalDesired);
    const take = Math.max(1, Math.min(proportional, maxTake));

    pages.push(chunks.slice(chunkIndex, chunkIndex + take).join("\n\n").trim());
    chunkIndex += take;
  }

  return pages;
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
  const rawBrailleText = normalizeReviewText(document?.braille_text);
  const brailleHasMarkers = rawBrailleText.includes(PAGE_BREAK_MARKER);
  let braillePages = brailleHasMarkers
    ? splitStoredTextIntoPages(rawBrailleText, document?.source_type)
    : splitBrailleTextToMatchOriginalPages(originalPages, rawBrailleText);

  if (originalPages.length > 1 && braillePages.length !== originalPages.length) {
    braillePages = splitBrailleTextToMatchOriginalPages(originalPages, braillePages.join("\n\n"));
  }

  return originalPages.map((pageText, index) => ({
    pageNumber: index + 1,
    originalText: pageText,
    brailleText: braillePages[index] || "",
    structureMode: detectStructure(pageText, { sourceType: document?.source_type }).mode,
    language: detectLanguage(pageText).language,
  }));
}
