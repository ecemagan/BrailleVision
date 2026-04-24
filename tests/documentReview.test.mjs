import test from "node:test";
import assert from "node:assert/strict";

import { alignBrailleTextToOriginalBlocks } from "../lib/documentReview.js";

test("alignBrailleTextToOriginalBlocks preserves the original block tree ids while attaching braille text", () => {
  const originalBlocks = [
    {
      id: "page-1-block-0",
      type: "section_header",
      originalContent: "2.2 Limit of a Function and Limit Laws 69",
      normalizedContent: "2.2 Limit of a Function and Limit Laws 69",
    },
    {
      id: "page-1-block-1",
      type: "equation_group",
      originalContent: "f(x) = x^2",
      normalizedContent: "f(x) = x^2",
      children: [
        {
          id: "page-1-block-1-step-01",
          type: "equation_step",
          originalContent: "f(x) = x^2",
          normalizedContent: "f(x) = x^2",
        },
      ],
    },
  ];

  const alignedBlocks = alignBrailleTextToOriginalBlocks(
    originalBlocks,
    "⠼⠃⠲⠼⠃ ⠠⠇⠊⠍⠊⠞ ⠕⠋ ⠁ ⠠⠋⠥⠝⠉⠞⠊⠕⠝ ⠁⠝⠙ ⠠⠇⠊⠍⠊⠞ ⠠⠇⠁⠺⠎ ⠼⠋⠊\n\n⠋⠷⠭⠾⠀⠶⠀⠭⠘⠆",
  );

  assert.equal(alignedBlocks.length, 2);
  assert.equal(alignedBlocks[0].id, "page-1-block-0");
  assert.equal(alignedBlocks[1].id, "page-1-block-1");
  assert.equal(alignedBlocks[1].children[0].id, "page-1-block-1-step-01");
  assert.match(alignedBlocks[0].brailleContent, /⠠⠇⠊⠍⠊⠞/u);
  assert.match(alignedBlocks[1].children[0].brailleContent, /⠋⠷⠭⠾/u);
});
