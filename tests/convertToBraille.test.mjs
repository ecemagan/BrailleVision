import test from "node:test";
import assert from "node:assert/strict";

import { convertToBraille } from "../lib/convertToBraille.js";

test("converts unicode minus in plain-text math snippets", () => {
  assert.equal(convertToBraille("x→−2"), "⠭⠳⠕⠤⠼⠃");
});

test("converts unicode minus in parsed math expressions", () => {
  assert.equal(convertToBraille("y = x−2"), "⠽ ⠨⠅ ⠭ ⠤ ⠼⠃");
});
