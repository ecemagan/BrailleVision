import test from "node:test";
import assert from "node:assert/strict";

import { resolvePageJump } from "../lib/pageNavigation.js";

test("jumps to a valid page", () => {
  assert.deepEqual(resolvePageJump("87", 120), {
    ok: true,
    error: null,
    pageIndex: 86,
  });
});

test("rejects empty input", () => {
  assert.equal(resolvePageJump("", 10).error, "empty");
});

test("rejects invalid page text", () => {
  assert.equal(resolvePageJump("8a", 10).error, "invalid");
});

test("supports first and last page jumps", () => {
  assert.equal(resolvePageJump("1", 10).pageIndex, 0);
  assert.equal(resolvePageJump("10", 10).pageIndex, 9);
});

test("rejects out of range pages", () => {
  assert.equal(resolvePageJump("11", 10).error, "out_of_range");
});
