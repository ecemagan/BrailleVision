/**
 * alignedBrailleRows.js – Paragraph-aware, count-correcting row builder.
 *
 * KEY FIX: When the Braille side has MORE paragraph chunks than the original
 * (which happens because the Braille translator often inserts extra blank
 * lines), we proportionally redistribute / merge the surplus Braille chunks
 * so that every original block has exactly one Braille counterpart.
 *
 * Example:
 *   original:  ["Graph y= 1 - …"]                 → 1 chunk
 *   braille:   ["⠛⠗⠁⠏⠓ …", "⠉⠕⠍⠍⠑⠝⠞ …", "⠁⠎ …"]  → 3 chunks
 *   result:    1 row — original[0] ↔ braille[0,1,2] joined
 */

import { normalizeTextForDisplay } from "./textDisplayModel.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

/** Split text into paragraph chunks (separated by ≥1 blank line). */
function splitParagraphs(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Split a Braille paragraph string into individual cell tokens. */
function splitBrailleWords(chunk) {
  return chunk.split(/\s+/).filter(Boolean);
}

/**
 * Distribute brailleChunks across originalChunks proportionally.
 * If brailleChunks.length ≤ originalChunks.length  → simple zip.
 * If brailleChunks.length >  originalChunks.length → merge extras
 *   into their closest original chunk via proportional bucketing.
 */
function distributeChunks(originalChunks, brailleChunks) {
  const oLen = originalChunks.length;
  const bLen = brailleChunks.length;

  if (oLen === 0) {
    // No original text — still render orphaned Braille chunks
    return brailleChunks.map((b) => ({ original: "", braille: b }));
  }

  if (bLen <= oLen) {
    // Equal or fewer Braille chunks — simple zip, pad with ""
    return originalChunks.map((orig, i) => ({
      original: orig,
      braille:  brailleChunks[i] || "",
    }));
  }

  // More Braille chunks than original chunks → merge proportionally
  const pairs = [];
  const ratio = bLen / oLen;

  for (let i = 0; i < oLen; i += 1) {
    const start = Math.round(i * ratio);
    const end   = i === oLen - 1 ? bLen : Math.round((i + 1) * ratio);
    pairs.push({
      original: originalChunks[i],
      braille:  brailleChunks.slice(start, end).join(" "),
    });
  }

  return pairs;
}

// ─── main export ─────────────────────────────────────────────────────────────

export function buildAlignedBrailleRows(originalText, brailleText, options = {}) {
  const originalChunks = splitParagraphs(originalText);
  const brailleChunks  = splitParagraphs(brailleText);

  const pairs = distributeChunks(originalChunks, brailleChunks);

  const rows = [];
  let rowNumber        = 1;
  let globalTokenIndex = 0;

  for (let ci = 0; ci < pairs.length; ci += 1) {
    const { original: origChunk, braille: brailleChunk } = pairs[ci];

    // Word-level tokenisation for the hover-highlight feature
    const originalModel = normalizeTextForDisplay(origChunk);
    const originalWords = originalModel.rows.flatMap((r) => r.words || []);
    const brailleWords  = splitBrailleWords(brailleChunk);

    const pairCount = Math.max(
      originalWords.length,
      brailleWords.length,
      origChunk.trim() ? 1 : 0,
    );

    const tokenPairs = [];

    if (pairCount === 0) {
      tokenPairs.push({
        id:      `pair_${ci + 1}_blank`,
        index:   globalTokenIndex,
        original: "",
        braille:  "",
      });
      globalTokenIndex += 1;
    } else {
      for (let wi = 0; wi < pairCount; wi += 1) {
        const ow = originalWords[wi] || null;
        tokenPairs.push({
          id:              `pair_${ci + 1}_${wi + 1}`,
          index:           ow?.renderedIndex ?? globalTokenIndex,
          original:        ow?.normalized    || "",
          rawOriginal:     ow?.raw           || "",
          braille:         brailleWords[wi]  || "",
          rawIndex:        ow?.rawIndex        ?? globalTokenIndex,
          normalizedIndex: ow?.normalizedIndex ?? globalTokenIndex,
          renderedIndex:   ow?.renderedIndex   ?? globalTokenIndex,
        });
        globalTokenIndex += 1;
      }
    }

    rows.push({
      id:              `row_${ci + 1}`,
      rowNumber,
      paragraphIndex:  ci,
      rawOriginalText: origChunk,
      originalText:    origChunk,
      brailleText:     brailleChunk,
      tokenPairs,
    });
    rowNumber += 1;
  }

  return rows;
}
