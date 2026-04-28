import test from "node:test";
import assert from "node:assert/strict";

import { extractImageText } from "../lib/extractImageText.js";

function createJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

test("retries image OCR with math profile when the first pass is corrupted", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (_url, options = {}) => {
    calls.push(options);

    if (calls.length === 1) {
      return createJsonResponse({
        text: "lim f(x) = L 1. 2. 3. 4. Sum Rule: Difference Rule: Constant Multiple Rule: Product Rule: x S c and lim g ( x ) = M, then x x x x lim lim",
      });
    }

    return createJsonResponse({
      text: ["1. Sum Rule:", "lim", "x→c", "(f(x) + g(x)) = L + M"].join("\n"),
    });
  };

  try {
    const file = new File(["fake-image"], "limits.png", { type: "image/png" });
    const extracted = await extractImageText(file);

    assert.equal(calls.length, 2);
    assert.equal(extracted, "1. Sum Rule: lim x→c (f(x) + g(x)) = L + M");
  } finally {
    global.fetch = originalFetch;
  }
});

test("keeps single-pass OCR for clean non-math image text", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (_url, options = {}) => {
    calls.push(options);

    return createJsonResponse({
      text: "This is a clean short paragraph from an image.",
    });
  };

  try {
    const file = new File(["fake-image"], "notes.png", { type: "image/png" });
    const extracted = await extractImageText(file);

    assert.equal(calls.length, 1);
    assert.equal(extracted, "This is a clean short paragraph from an image.");
  } finally {
    global.fetch = originalFetch;
  }
});
