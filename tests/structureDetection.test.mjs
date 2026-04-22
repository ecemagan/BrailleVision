import test from "node:test";
import assert from "node:assert/strict";

import { detectStructure, formatTextByStructure } from "../lib/structureDetection.js";

test("detects true line-by-line educational content as line preserved", () => {
  const input = "1. Kökler\n2. Üsler\n3. İntegral";
  const result = detectStructure(input, { sourceType: "pdf" });

  assert.equal(result.mode, "line_preserved");
});

test("reconstructs wrapped pdf prose into paragraphs", () => {
  const input = "This is a long paragraph that was wrapped by the PDF layout\nbut it should be reconstructed as one paragraph for reading.";
  const result = formatTextByStructure(input, { sourceType: "pdf" });

  assert.equal(result.mode, "plain_prose");
  assert.equal(
    result.text,
    "This is a long paragraph that was wrapped by the PDF layout but it should be reconstructed as one paragraph for reading.",
  );
});

test("detects mixed heading paragraph and list content", () => {
  const input = [
    "Integration Rules",
    "",
    "This paragraph explains the basic logic of integration and should remain a paragraph.",
    "It continues on a second wrapped line for the same paragraph.",
    "",
    "1. Power rule",
    "2. Substitution",
  ].join("\n");

  const result = formatTextByStructure(input, { sourceType: "pdf" });

  assert.equal(result.mode, "mixed_structured");
  assert.equal(
    result.text,
    [
      "Integration Rules",
      "",
      "This paragraph explains the basic logic of integration and should remain a paragraph. It continues on a second wrapped line for the same paragraph.",
      "",
      "1. Power rule\n2. Substitution",
    ].join("\n"),
  );
});

test("preserves blank lines in structured content", () => {
  const input = "Başlık\n\n1. Adım\n2. Adım";
  const result = formatTextByStructure(input, { sourceType: "manual" });

  assert.equal(result.text, input);
});

test("reconstructs short wrapped pdf prose without leaving mid-sentence line breaks", () => {
  const input = [
    "Bir fonksiyonun davranisini incelerken",
    "once tanim kumesine bakilir ve",
    "ardindan artan azalan araliklar",
    "dikkatlice belirlenir.",
  ].join("\n");

  const result = formatTextByStructure(input, { sourceType: "pdf" });

  assert.equal(result.mode, "plain_prose");
  assert.equal(
    result.text,
    "Bir fonksiyonun davranisini incelerken once tanim kumesine bakilir ve ardindan artan azalan araliklar dikkatlice belirlenir.",
  );
});
