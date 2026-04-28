import test from "node:test";
import assert from "node:assert/strict";

import { detectLanguage, detectLanguageByBlocks } from "../lib/languageDetection.js";

test("detects Turkish reliably", () => {
  const result = detectLanguage("Kökler ve kümeler aşağıda tanımlanmış işlemleri gösterir.");
  assert.equal(result.language, "tr");
});

test("detects English reliably", () => {
  const result = detectLanguage("This section explains the graph and the equation in plain language.");
  assert.equal(result.language, "en");
});

test("detects mixed Turkish and English blocks", () => {
  const result = detectLanguageByBlocks([
    { text: "Kümeler ve işlem özellikleri" },
    { text: "Graph explanation and function rules" },
  ]);

  assert.equal(result.language, "mixed");
});

test("short math lines without language clues stay safe", () => {
  const result = detectLanguage("x^2 + y^2 = 1");
  assert.equal(result.language, "unknown");
});
