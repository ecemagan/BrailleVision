import test from "node:test";
import assert from "node:assert/strict";

import {
  PAGE_BREAK_MARKER,
  buildReviewPagesFromDocument,
  splitStoredTextIntoPages,
} from "../lib/documentReview.js";

test("preserves legacy pdf text as a single review page when no page markers exist", () => {
  const originalText = [
    "1. Sum Rule: lim (f(x) + g(x)) = L + M",
    "x→c",
    "",
    "2. Difference Rule: lim (f(x) - g(x)) = L - M",
    "x→c",
  ].join("\n");

  assert.deepEqual(splitStoredTextIntoPages(originalText, "pdf"), [originalText]);
});

test("buildReviewPagesFromDocument keeps pdf original and braille text aligned without repagination", () => {
  const originalText = [
    "1. Sum Rule: lim (f(x) + g(x)) = L + M",
    "x→c",
  ].join("\n");
  const brailleText = "⠼⠁ ⠠⠎⠥⠍ ⠠⠗⠥⠇⠑";

  assert.deepEqual(buildReviewPagesFromDocument({
    source_type: "pdf",
    original_text: originalText,
    braille_text: brailleText,
  }), [
    {
      pageNumber: 1,
      originalText,
      brailleText,
      structureMode: "line_preserved",
      language: "unknown",
    },
  ]);
});

test("still honors explicit stored page markers for pdf documents", () => {
  const originalText = ["page one", "page two"].join(`\n${PAGE_BREAK_MARKER}\n`);

  assert.deepEqual(splitStoredTextIntoPages(originalText, "pdf"), ["page one", "page two"]);
});
