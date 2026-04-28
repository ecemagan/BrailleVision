import test from "node:test";
import assert from "node:assert/strict";

import { formatLimitExpressionForDisplay, formatOriginalLineForDisplay } from "../lib/mathDisplayFormatting.js";

test("formats inline limit expressions into a lim-with-subscript display block", () => {
  assert.deepEqual(
    formatLimitExpressionForDisplay("1. Sum Rule: lim x→c (f(x) + g(x)) = L + M"),
    [
      "1. Sum Rule: lim (f(x) + g(x)) = L + M",
      "             x→c",
    ],
  );
});

test("normalizes ascii arrow syntax when formatting limits", () => {
  assert.deepEqual(
    formatOriginalLineForDisplay("lim x->c f(x)/g(x) = L/M, M ≠ 0"),
    [
      "lim f(x)/g(x) = L/M, M ≠ 0",
      "x→c",
    ],
  );
});

test("formats limit lines that use unicode minus in the subscript", () => {
  assert.deepEqual(
    formatOriginalLineForDisplay("lim x→−2 f(x) = L"),
    [
      "lim f(x) = L",
      "x→−2",
    ],
  );
});

test("leaves non-limit lines unchanged", () => {
  assert.deepEqual(formatOriginalLineForDisplay("5. Product Rule"), ["5. Product Rule"]);
});
