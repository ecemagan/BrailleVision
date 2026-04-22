import test from "node:test";
import assert from "node:assert/strict";

import {
  detectTextStructureMode,
  normalizeTurkishExtractedText,
  repairCorruptedTurkishLine,
} from "../lib/turkishTextNormalization.js";

test("repairs common Turkish PDF corruption samples with high confidence", () => {
  const samples = new Map([
    ['"Usler', "Üsler"],
    ['K"okler', "Kökler"],
    ['b"oyle', "böyle"],
    ['k"umeleri', "kümeleri"],
    ["i¸slemleri", "işlemleri"],
    ["tanımlanmı¸s", "tanımlanmış"],
    ["¸carpma", "çarpma"],
    ["do˘gal", "doğal"],
    ["a¸sa˘gıda", "aşağıda"],
    ["hi¸c", "hiç"],
    ['"ozellikleri', "özellikleri"],
    ["ozellikleri", "özellikleri"],
  ]);

  for (const [corrupted, expected] of samples) {
    assert.equal(repairCorruptedTurkishLine(corrupted).text, expected);
  }
});

test("repairs PDF math lines without changing line count", () => {
  const input = [
    "Kısm: İntegrasyon Formülü: :nt(u * d:@(v, x), x) = u * v - :nt(v * d:@(u, x), x)",
    "Bel:rl: İntegral (Gauss İntegral:): :nt(exp(-x^2), x, -:nf, :nf) = sqrt(p:)",
    "",
    'K"okler ve "Usler',
  ].join("\n");

  const output = normalizeTurkishExtractedText(input, {
    sourceType: "pdf",
    mode: "line-preserved",
  });

  assert.deepEqual(output.split("\n"), [
    "Kısmi İntegrasyon Formülü: int(u * d:@(v, x), x) = u * v - int(v * d:@(u, x), x)",
    "Belirli İntegral (Gauss İntegral:): int(exp(-x^2), x, -inf, inf) = sqrt(pi)",
    "",
    "Kökler ve Üsler",
  ]);
});

test("keeps paragraph mode for prose OCR while still repairing Turkish text", () => {
  const input = 'Bu b"oyle bir satir.\nBu da ozellikleri anlatan ikinci satir.';
  const output = normalizeTurkishExtractedText(input, {
    sourceType: "ocr",
    mode: "paragraph",
  });

  assert.equal(output, "Bu böyle bir satir. Bu da özellikleri anlatan ikinci satir.");
});

test("defaults pdf extraction to line-preserved mode", () => {
  const input = "1. K" + 'okler\n2. "Usler';
  assert.equal(detectTextStructureMode(input, { sourceType: "pdf" }), "line-preserved");
});

test("leaves uncertain tokens unchanged", () => {
  const input = 'x"yz';
  const repaired = repairCorruptedTurkishLine(input);

  assert.equal(repaired.text, input);
  assert.equal(repaired.changed, false);
});

test("restores additional Turkish pdf words safely", () => {
  const samples = new Map([
    ['"ogrenci', "öğrenci"],
    ['"ogretmen', "öğretmen"],
    ['t"urkce', "türkçe"],
    ['"ozellikler', "özellikler"],
    ["i¸cin", "için"],
    ["L:m:t", "Limit"],
    ["l:m:t:", "limiti"],
    ["H:perbol:k", "Hiperbolik"],
    ["Tr:gonometr::", "Trigonometri:"],
  ]);

  for (const [corrupted, expected] of samples) {
    assert.equal(repairCorruptedTurkishLine(corrupted).text, expected);
  }
});

test("repairs colon-corrupted Turkish titles without changing math functions", () => {
  const input = "Ters H:perbol:k Tr:gonometr:: arcsin(x) + arccos(x) = pi / 2";

  assert.equal(
    repairCorruptedTurkishLine(input).text,
    "Ters Hiperbolik Trigonometri: arcsin(x) + arccos(x) = pi / 2",
  );
});

test("does not rewrite short ratio-like tokens as Turkish words", () => {
  assert.equal(repairCorruptedTurkishLine("a:b").text, "a:b");
});

test("repairs Turkish letters when PDF markers appear after the base letter", () => {
  const samples = new Map([
    ["Tu¨rkc¸e", "Türkçe"],
    ["o¨g˘retmen", "öğretmen"],
    ["c¸o¨zu¨m", "çözüm"],
    ["as¸ag˘ıdaki", "aşağıdaki"],
  ]);

  for (const [corrupted, expected] of samples) {
    assert.equal(repairCorruptedTurkishLine(corrupted).text, expected);
  }
});

test("normalizes common math glyph variants used in PDFs", () => {
  const samples = new Map([
    ["ƒ(x) = x + 1", "f(x) = x + 1"],
  ]);

  for (const [corrupted, expected] of samples) {
    assert.equal(repairCorruptedTurkishLine(corrupted).text, expected);
  }
});
