import { normalizeTags } from "@/lib/documents";

const STOP_WORDS = new Set([
  "ve",
  "ile",
  "bir",
  "the",
  "for",
  "that",
  "this",
  "from",
  "braille",
  "vision",
  "text",
  "document",
  "dokuman",
  "doküman",
]);

export const WORKSPACE_DOCUMENT_SOFT_LIMIT = 50;

function countSentences(text) {
  return (text.match(/[.!?]/g) || []).length;
}

function getTopKeywords(text) {
  const frequencyMap = new Map();

  text
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİ\s-]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
    .forEach((token) => {
      frequencyMap.set(token, (frequencyMap.get(token) || 0) + 1);
    });

  return [...frequencyMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([token]) => token);
}

export function suggestDocumentTags(text, sourceType, conversionMode, userTags = []) {
  const seedTags = [...userTags];

  if (sourceType && sourceType !== "manual") {
    seedTags.push(sourceType);
  }

  if (conversionMode === "nemeth") {
    seedTags.push("math");
  }

  if (conversionMode === "ocr") {
    seedTags.push("ocr");
  }

  if ((text.match(/\n/g) || []).length >= 4) {
    seedTags.push("multi-section");
  }

  seedTags.push(...getTopKeywords(text));

  return normalizeTags(seedTags);
}

export function analyzeBrailleReadability(text, sourceType = "manual", conversionMode = "text") {
  const originalText = String(text || "");
  const suggestions = [];
  let improvedText = originalText.replace(/\r\n/g, "\n");

  if (/\t/.test(improvedText) || / {2,}/.test(improvedText)) {
    improvedText = improvedText.replace(/\t/g, " ").replace(/ {2,}/g, " ");
    suggestions.push("Extra spacing was normalized for cleaner Braille grouping.");
  }

  if (/\n{3,}/.test(improvedText)) {
    improvedText = improvedText.replace(/\n{3,}/g, "\n\n");
    suggestions.push("Large blank gaps were condensed to preserve reading rhythm.");
  }

  if (/[•●▪◦]/.test(improvedText)) {
    improvedText = improvedText.replace(/[•●▪◦]\s*/g, "- ");
    suggestions.push("Bullet characters were converted into simple list markers.");
  }

  const longLines = improvedText.split("\n").filter((line) => line.length > 84).length;
  if (longLines > 0) {
    suggestions.push("Some lines are quite long; consider shorter phrases or extra line breaks.");
  }

  const denseNumberRuns = (improvedText.match(/\d{4,}/g) || []).length;
  if (denseNumberRuns > 0) {
    suggestions.push("Dense numeric runs were detected. Nemeth formatting may read better with separators.");
  }

  if (countSentences(improvedText) <= 1 && improvedText.length > 180) {
    suggestions.push("The text is very dense. Splitting it into shorter sentences could improve readability.");
  }

  if (sourceType === "pdf" || sourceType === "image" || sourceType === "camera") {
    suggestions.push("OCR-origin text can benefit from a quick proofread before saving.");
  }

  const readabilityScore = Math.max(
    35,
    100 - longLines * 8 - denseNumberRuns * 6 - Math.max(0, improvedText.length - 500) / 18,
  );

  return {
    improvedText: improvedText.trim(),
    readabilityScore: Math.round(readabilityScore),
    suggestions,
    suggestedTags: suggestDocumentTags(improvedText, sourceType, conversionMode),
    changed: improvedText.trim() !== originalText.trim(),
  };
}

export function getQuotaStatus(documentCount, softLimit = WORKSPACE_DOCUMENT_SOFT_LIMIT) {
  const safeCount = Number(documentCount) || 0;
  const usage = Math.min(100, Math.round((safeCount / softLimit) * 100));

  return {
    count: safeCount,
    softLimit,
    usage,
    isWarning: safeCount >= Math.ceil(softLimit * 0.8),
    isExceeded: safeCount >= softLimit,
  };
}
