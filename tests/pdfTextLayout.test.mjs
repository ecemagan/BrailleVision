import test from "node:test";
import assert from "node:assert/strict";

import { reconstructPdfPageText, repairPdfPageBreaks } from "../lib/pdfTextLayout.js";

test("keeps separate bullet-style lines on separate output lines", () => {
  const items = [
    { str: "1.", transform: [1, 0, 0, 1, 70, 760], width: 10, height: 12 },
    { str: "Birinci", transform: [1, 0, 0, 1, 90, 760], width: 35, height: 12 },
    { str: "madde", transform: [1, 0, 0, 1, 132, 760], width: 40, height: 12 },
    { str: "2.", transform: [1, 0, 0, 1, 70, 735], width: 10, height: 12 },
    { str: "Ikinci", transform: [1, 0, 0, 1, 90, 735], width: 34, height: 12 },
    { str: "madde", transform: [1, 0, 0, 1, 130, 735], width: 40, height: 12 },
  ];

  assert.equal(reconstructPdfPageText(items), "1. Birinci madde\n2. Ikinci madde");
});

test("merges split symbol tokens that belong to the same line", () => {
  const items = [
    { str: "x", transform: [1, 0, 0, 1, 70, 410], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 79, 410], width: 2, height: 0 },
    { str: "∈", transform: [1, 0, 0, 1, 84, 410], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 93, 410], width: 2, height: 0 },
    { str: "A", transform: [1, 0, 0, 1, 97, 410], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 106, 410], width: 2, height: 0 },
    { str: "⇔", transform: [1, 0, 0, 1, 110, 410], width: 10, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 121, 410], width: 2, height: 0 },
    { str: "x", transform: [1, 0, 0, 1, 125, 410], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 134, 410], width: 2, height: 0 },
    { str: "∉", transform: [1, 0, 0, 1, 138, 410], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 147, 410], width: 2, height: 0 },
    { str: "A^c", transform: [1, 0, 0, 1, 151, 410], width: 24, height: 12 },
  ];

  assert.equal(reconstructPdfPageText(items), "x ∈ A ⇔ x ∉ A^c");
});

test("inserts a blank line when the vertical gap is large", () => {
  const items = [
    { str: "Baslik", transform: [1, 0, 0, 1, 70, 760], width: 40, height: 12 },
    { str: "Madde", transform: [1, 0, 0, 1, 70, 720], width: 40, height: 12 },
  ];

  assert.equal(reconstructPdfPageText(items), "Baslik\n\nMadde");
});

test("repairs common lost-i corruption from pdf text layers", () => {
  const items = [
    { str: "Kısm: İntegrasyon Formülü: :nt(u, x)", transform: [1, 0, 0, 1, 70, 760], width: 200, height: 12 },
    { str: "Bel:rl: İntegral: :nt(exp(-x^2), x, -:nf, :nf) = sqrt(p:)", transform: [1, 0, 0, 1, 70, 735], width: 320, height: 12 },
  ];

  assert.equal(
    reconstructPdfPageText(items),
    "Kısmi İntegrasyon Formülü: int(u, x)\nBelirli İntegral: int(exp(-x^2), x, -inf, inf) = sqrt(pi)",
  );
});

test("repairs Turkish marker glyphs when they arrive as separate PDF items after letters", () => {
  const items = [
    { str: "T", transform: [1, 0, 0, 1, 70, 760], width: 8, height: 12 },
    { str: "u", transform: [1, 0, 0, 1, 79, 760], width: 8, height: 12 },
    { str: "¨", transform: [1, 0, 0, 1, 87, 760], width: 6, height: 12 },
    { str: "r", transform: [1, 0, 0, 1, 93, 760], width: 8, height: 12 },
    { str: "k", transform: [1, 0, 0, 1, 101, 760], width: 8, height: 12 },
    { str: "c", transform: [1, 0, 0, 1, 109, 760], width: 8, height: 12 },
    { str: "¸", transform: [1, 0, 0, 1, 117, 760], width: 6, height: 12 },
    { str: "e", transform: [1, 0, 0, 1, 123, 760], width: 8, height: 12 },
    { str: " ", transform: [1, 0, 0, 1, 131, 760], width: 4, height: 0 },
    { str: "o", transform: [1, 0, 0, 1, 137, 760], width: 8, height: 12 },
    { str: "¨", transform: [1, 0, 0, 1, 145, 760], width: 6, height: 12 },
    { str: "g", transform: [1, 0, 0, 1, 151, 760], width: 8, height: 12 },
    { str: "˘", transform: [1, 0, 0, 1, 159, 760], width: 6, height: 12 },
    { str: "r", transform: [1, 0, 0, 1, 165, 760], width: 8, height: 12 },
    { str: "e", transform: [1, 0, 0, 1, 173, 760], width: 8, height: 12 },
    { str: "t", transform: [1, 0, 0, 1, 181, 760], width: 8, height: 12 },
    { str: "m", transform: [1, 0, 0, 1, 189, 760], width: 10, height: 12 },
    { str: "e", transform: [1, 0, 0, 1, 199, 760], width: 8, height: 12 },
    { str: "n", transform: [1, 0, 0, 1, 207, 760], width: 8, height: 12 },
  ];

  assert.equal(reconstructPdfPageText(items), "Türkçe öğretmen");
});

test("repairs hyphenated words split across PDF page boundaries", () => {
  const pages = [
    "Rule in Section 2.3, based on a precise definition of limit. Rules 2-5\nare proved in Appen-",
    "dix 4. Rule 6 is obtained by applying Rule 4 repeatedly. Rule 7 is\nproved in more advanced",
  ];

  assert.deepEqual(repairPdfPageBreaks(pages), [
    "Rule in Section 2.3, based on a precise definition of limit. Rules 2-5\nare proved in Appendix",
    "4. Rule 6 is obtained by applying Rule 4 repeatedly. Rule 7 is\nproved in more advanced",
  ]);
});

test("merges stacked PDF math lines into one readable expression", () => {
  const items = [
    { str: "5.", transform: [1, 0, 0, 1, 70, 760], width: 18, height: 12 },
    { str: "Quotient", transform: [1, 0, 0, 1, 100, 760], width: 82, height: 12 },
    { str: "Rule:", transform: [1, 0, 0, 1, 192, 760], width: 50, height: 12 },
    { str: "f(x)", transform: [1, 0, 0, 1, 520, 778], width: 42, height: 12 },
    { str: "L", transform: [1, 0, 0, 1, 690, 778], width: 12, height: 12 },
    { str: "lim", transform: [1, 0, 0, 1, 430, 760], width: 28, height: 12 },
    { str: "=", transform: [1, 0, 0, 1, 590, 760], width: 16, height: 12 },
    { str: ",", transform: [1, 0, 0, 1, 728, 760], width: 6, height: 12 },
    { str: "M", transform: [1, 0, 0, 1, 760, 760], width: 16, height: 12 },
    { str: "≠", transform: [1, 0, 0, 1, 790, 760], width: 14, height: 12 },
    { str: "0", transform: [1, 0, 0, 1, 820, 760], width: 10, height: 12 },
    { str: "xSc", transform: [1, 0, 0, 1, 425, 742], width: 34, height: 12 },
    { str: "g(x)", transform: [1, 0, 0, 1, 520, 742], width: 44, height: 12 },
    { str: "M", transform: [1, 0, 0, 1, 690, 742], width: 16, height: 12 },
  ];

  assert.equal(
    reconstructPdfPageText(items),
    "5. Quotient Rule: lim x→c f(x)/g(x) = L/M, M ≠ 0",
  );
});
