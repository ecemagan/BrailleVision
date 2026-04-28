import { normalizeTurkish } from "./turkishTextNormalization.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

function splitTextLines(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  return normalized.split("\n").map((line) => line.trimEnd());
}

function splitWords(line) {
  if (!String(line || "").trim()) {
    return [];
  }

  return String(line || "").trim().split(/\s+/).filter(Boolean);
}

export function normalizeTextForDisplay(rawText) {
  const rawLines = splitTextLines(rawText);
  const rows = [];
  let rawIndex = 0;
  let normalizedIndex = 0;
  let renderedIndex = 0;

  rawLines.forEach((rawLine, rowIndex) => {
    const normalizedLine = normalizeTurkish(rawLine).text;
    const rawWords = splitWords(rawLine);
    const normalizedWords = splitWords(normalizedLine);
    const wordCount = Math.max(rawWords.length, normalizedWords.length, rawLine.trim() ? 1 : 0);
    const words = [];

    if (wordCount === 1 && !rawWords.length && !normalizedWords.length) {
      words.push({
        raw: "",
        normalized: "",
        rawIndex,
        normalizedIndex,
        renderedIndex,
      });
      rawIndex += 1;
      normalizedIndex += 1;
      renderedIndex += 1;
    } else {
      for (let index = 0; index < wordCount; index += 1) {
        words.push({
          raw: rawWords[index] || "",
          normalized: normalizedWords[index] || rawWords[index] || "",
          rawIndex,
          normalizedIndex,
          renderedIndex,
        });
        rawIndex += 1;
        normalizedIndex += 1;
        renderedIndex += 1;
      }
    }

    rows.push({
      id: `display_row_${rowIndex + 1}`,
      rowNumber: rowIndex + 1,
      raw: rawLine,
      normalized: normalizedLine,
      words,
    });
  });

  return {
    rawText: normalizeText(rawText),
    normalizedText: rows.map((row) => row.normalized).join("\n"),
    rows,
  };
}

export function tokenizePreservingMapping(rawText) {
  return normalizeTextForDisplay(rawText);
}
