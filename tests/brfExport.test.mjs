import test from "node:test";
import assert from "node:assert/strict";

import {
  BRF_CELLS_PER_LINE,
  BRF_LINES_PER_PAGE,
  buildBrfContentForDocument,
  buildBrfContentForDocuments,
  convertUnicodeBrailleToBrf,
} from "../lib/brfExport.js";
import { PAGE_BREAK_MARKER } from "../lib/exportStructure.js";

test("convertUnicodeBrailleToBrf maps unicode braille to NABCC ASCII", () => {
  assert.equal(convertUnicodeBrailleToBrf("\u2801\u2803\u283c\u2811"), "ab#e");
});

test("convertUnicodeBrailleToBrf wraps long rows and paginates every 25 lines", () => {
  const longLine = "\u2801".repeat(BRF_CELLS_PER_LINE + 5);
  const manyLines = Array.from({ length: BRF_LINES_PER_PAGE + 1 }, () => "\u2801").join("\n");

  assert.equal(convertUnicodeBrailleToBrf(longLine), `${"a".repeat(BRF_CELLS_PER_LINE)}\naaaaa`);
  assert.equal(
    convertUnicodeBrailleToBrf(manyLines),
    `${Array.from({ length: BRF_LINES_PER_PAGE }, () => "a").join("\n")}\n\f\na`,
  );
});

test("buildBrfContentForDocument respects stored page markers", () => {
  const document = {
    braille_text: ["\u2801\u2803", "\u2811\u281d"].join(`\n${PAGE_BREAK_MARKER}\n`),
  };

  assert.equal(buildBrfContentForDocument(document), "ab\n\f\nen");
});

test("buildBrfContentForDocuments concatenates multiple documents with page breaks", () => {
  const documents = [
    { braille_text: "\u2801\u2803" },
    { braille_text: "\u2811\u281d" },
  ];

  assert.equal(buildBrfContentForDocuments(documents), "ab\n\f\nen");
});
