import test from "node:test";
import assert from "node:assert/strict";

import { buildAlignedBrailleRows } from "../lib/alignedBrailleRows.js";

test("preserves explicit source lines as individual comparison rows", () => {
  const rows = buildAlignedBrailleRows(
    "Birinci satir uzun bir ifade\nIkinci satir tek parca",
    "⠠⠃⠊⠗⠊⠝⠉⠊ ⠎⠁⠞⠊⠗ ⠥⠵⠥⠝ ⠃⠊⠗ ⠊⠋⠁⠙⠑\n⠠⠔⠅⠊⠝⠉⠊ ⠎⠁⠞⠊⠗ ⠞⠑⠅ ⠏⠁⠗⠉⠁",
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].originalText, "Birinci satir uzun bir ifade");
  assert.equal(rows[1].originalText, "Ikinci satir tek parca");
});

test("preserves blank lines as their own comparison rows", () => {
  const rows = buildAlignedBrailleRows("Birinci satir\n\nUcuncu satir", "⠃⠊⠗⠊⠝⠉⠊\n\n⠥⠉⠥⠝⠉⠥");

  assert.equal(rows.length, 3);
  assert.equal(rows[1].originalText, "");
});

test("restores Turkish characters while preserving rendered token indexes", () => {
  const rows = buildAlignedBrailleRows(
    '3. Kesirli "Usler ve K"okler\nBundan b"oyle N, Z ve Q sayı k"umeleri "uzerine tanımlanmış toplama',
    "⠼⠉ ⠠⠅⠑⠎⠊⠗⠇⠊ ⠠⠥⠎⠇⠑⠗ ⠧⠑ ⠠⠅⠪⠅⠇⠑⠗\n⠠⠃⠥⠝⠙⠁⠝ ⠃⠪⠽⠇⠑",
  );

  assert.equal(rows[0].tokenPairs[2].original, "Üsler");
  assert.equal(rows[0].tokenPairs[4].original, "Kökler");
  assert.equal(rows[0].tokenPairs[2].renderedIndex, rows[0].tokenPairs[2].index);
  assert.equal(rows[1].tokenPairs[1].original, "böyle");
  assert.equal(rows[1].tokenPairs[7].original, "kümeleri");
  assert.equal(rows[1].tokenPairs[8].original, "üzerine");
});

test("selection indexes stay stable across rerenders for the same text", () => {
  const first = buildAlignedBrailleRows('Bundan b"oyle N, Z', "⠠⠃⠥⠝⠙⠁⠝ ⠃⠪⠽⠇⠑ ⠠⠝ ⠠⠵");
  const second = buildAlignedBrailleRows('Bundan b"oyle N, Z', "⠠⠃⠥⠝⠙⠁⠝ ⠃⠪⠽⠇⠑ ⠠⠝ ⠠⠵");

  assert.equal(first[0].tokenPairs[1].index, second[0].tokenPairs[1].index);
  assert.equal(first[0].tokenPairs[1].original, second[0].tokenPairs[1].original);
});
