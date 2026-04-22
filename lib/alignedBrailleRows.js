import { normalizeTextForDisplay } from "./textDisplayModel.js";

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

export function buildAlignedBrailleRows(originalText, brailleText, options = {}) {
  const originalModel = normalizeTextForDisplay(originalText);
  const originalLines = originalModel.rows;
  const brailleLines = splitTextLines(brailleText);
  const lineCount = Math.max(originalLines.length, brailleLines.length);
  const rows = [];
  let rowNumber = 1;
  let globalTokenIndex = 0;

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const originalLine = originalLines[lineIndex] || { raw: "", normalized: "", words: [] };
    const brailleLine = brailleLines[lineIndex] || "";
    const originalWords = originalLine.words || [];
    const brailleWords = brailleLine.split(/\s+/).filter(Boolean);
    const pairCount = Math.max(originalWords.length, brailleWords.length, originalLine.normalized.trim() ? 1 : 0);

    const tokenPairs = [];

    if (pairCount === 0) {
      tokenPairs.push({
        id: `pair_${lineIndex + 1}_blank`,
        index: globalTokenIndex,
        original: "",
        braille: "",
      });
      globalTokenIndex += 1;
    } else {
      for (let index = 0; index < pairCount; index += 1) {
        const originalWord = originalWords[index] || null;
        tokenPairs.push({
          id: `pair_${lineIndex + 1}_${index + 1}`,
          index: originalWord?.renderedIndex ?? globalTokenIndex,
          original: originalWord?.normalized || "",
          rawOriginal: originalWord?.raw || "",
          braille: brailleWords[index] || "",
          rawIndex: originalWord?.rawIndex ?? globalTokenIndex,
          normalizedIndex: originalWord?.normalizedIndex ?? globalTokenIndex,
          renderedIndex: originalWord?.renderedIndex ?? globalTokenIndex,
        });
        globalTokenIndex += 1;
      }
    }

    rows.push({
      id: `row_${lineIndex + 1}`,
      rowNumber,
      paragraphIndex: lineIndex,
      rawOriginalText: originalLine.raw || "",
      originalText: originalLine.normalized || "",
      brailleText: brailleLine,
      tokenPairs,
    });
    rowNumber += 1;
  }

  return rows;
}
