import test from "node:test";
import assert from "node:assert/strict";

import { PAGE_BREAK_MARKER, splitStoredTextForExport } from "../lib/exportStructure.js";

test("structured source remains separated by stored page markers", () => {
  const text = ["Başlık\n1. Adım\n2. Adım", "Yeni Sayfa\n3. Adım"].join(`\n${PAGE_BREAK_MARKER}\n`);

  assert.deepEqual(splitStoredTextForExport(text), [
    "Başlık\n1. Adım\n2. Adım",
    "Yeni Sayfa\n3. Adım",
  ]);
});

test("prose source stays a single export page when no marker exists", () => {
  const text = "This is a paragraph.\n\nThis is another paragraph.";
  assert.deepEqual(splitStoredTextForExport(text), [text]);
});
