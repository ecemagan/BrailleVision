import test from "node:test";
import assert from "node:assert/strict";

import { normalizePdfMathOcrText } from "../lib/pdfMathTextNormalization.js";

test("joins split rule heading, limit subscript, and formula into one readable line", () => {
  const rawText = [
    "1. Sum Rule:",
    "lim",
    "x→c",
    "(f(x) + g(x)) = L + M",
  ].join("\n");

  assert.equal(
    normalizePdfMathOcrText(rawText),
    "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M",
  );
});

test("normalizes common OCR math artifacts", () => {
  const rawText = [
    "5. Quotient Rule:",
    "lim",
    "x Sc",
    "ƒ(x) / g(x) = L / M, M ≠ 0",
  ].join("\n");

  assert.equal(
    normalizePdfMathOcrText(rawText),
    "5. Quotient Rule: lim x→c f(x)/g(x) = L/M, M ≠ 0",
  );
});
