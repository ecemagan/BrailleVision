import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSevereMathOcrCorruption,
  looksMathHeavyPdfPage,
  selectBestPdfMathCandidate,
  scorePdfMathTextQuality,
  shouldPreferOcrForPdfTextLayer,
} from "../lib/pdfExtractionHeuristics.js";

test("prefers OCR for badly ordered math-heavy PDF text", () => {
  const text = "Sum Rule: Difference Rule: Constant Multiple Rule: Product Rule: x S c and lim g ( x ) = M, then x x x x lim lim lim lim";
  const items = [
    { str: "lim", transform: [1, 0, 0, 1, 430, 760] },
    { str: "xSc", transform: [1, 0, 0, 1, 430, 742] },
    { str: "g(x)", transform: [1, 0, 0, 1, 520, 742] },
    { str: "M", transform: [1, 0, 0, 1, 690, 742] },
    { str: "L", transform: [1, 0, 0, 1, 690, 778] },
  ];

  assert.equal(shouldPreferOcrForPdfTextLayer(text, items), true);
});

test("does not force OCR for clean plain PDF text", () => {
  const text = "This is a clean paragraph that should stay in the regular PDF text extraction flow.";
  const items = [
    { str: "This", transform: [1, 0, 0, 1, 70, 760] },
    { str: "is", transform: [1, 0, 0, 1, 102, 760] },
    { str: "clean", transform: [1, 0, 0, 1, 118, 760] },
  ];

  assert.equal(shouldPreferOcrForPdfTextLayer(text, items), false);
});

test("recognizes math-heavy pages even when text is partly readable", () => {
  const text = "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M";
  const items = [
    { str: "1.", transform: [1, 0, 0, 1, 70, 760] },
    { str: "Sum", transform: [1, 0, 0, 1, 95, 760] },
    { str: "Rule:", transform: [1, 0, 0, 1, 135, 760] },
    { str: "lim", transform: [1, 0, 0, 1, 430, 760] },
    { str: "xSc", transform: [1, 0, 0, 1, 430, 742] },
  ];

  assert.equal(looksMathHeavyPdfPage(text, items), true);
});

test("scores clean inline math higher than broken OCR-like output", () => {
  const broken = "Sum Rule: Difference Rule: x S c lim lim x x x";
  const clean = "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M";

  assert.ok(scorePdfMathTextQuality(clean) > scorePdfMathTextQuality(broken));
});

test("heavily penalizes multiple rule headings collapsed onto one line", () => {
  const collapsed = "1. Sum Rule: 2. Difference Rule: 3. Product Rule: lim lim x x x";
  const clean = [
    "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M",
    "2. Difference Rule: lim x→c (f(x) - g(x)) = L - M",
    "3. Product Rule: lim x→c (f(x)g(x)) = LM",
  ].join("\n");

  assert.ok(scorePdfMathTextQuality(clean) > scorePdfMathTextQuality(collapsed));
});

test("flags collapsed rule-list OCR as severely corrupted", () => {
  const broken = [
    "Sum Rule: Difference Rule: Constant Multiple Rule: Product Rule:",
    "x S c and lim g ( x ) = M, then x x x x lim lim lim lim",
    "S S S S c c c c (f( (f( ( (f( k # x x x f( ) ) )",
  ].join(" ");

  assert.equal(hasSevereMathOcrCorruption(broken), true);
});

test("keeps the text layer when OCR math output collapses into garbage", () => {
  const textLayer = [
    "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M",
    "2. Difference Rule: lim x→c (f(x) - g(x)) = L - M",
    "3. Constant Multiple Rule: lim x→c (k·f(x)) = k·L",
  ].join("\n");
  const brokenOcr = [
    "Sum Rule: Difference Rule: Constant Multiple Rule: Product Rule:",
    "x S c and lim g ( x ) = M, then x x x x lim lim lim lim",
    "S S S S c c c c (f( (f( ( (f( k # x x x f( ) ) )",
  ].join(" ");

  assert.equal(selectBestPdfMathCandidate(textLayer, brokenOcr), textLayer);
});

test("uses OCR when it clearly repairs a broken math text layer", () => {
  const brokenTextLayer = "Sum Rule: Difference Rule: x S c lim lim x x x";
  const repairedOcr = "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M";

  assert.equal(selectBestPdfMathCandidate(brokenTextLayer, repairedOcr), repairedOcr);
});
