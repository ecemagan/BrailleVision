import test from "node:test";
import assert from "node:assert/strict";

import { buildDisplaySegments } from "../lib/blockDisplayModel.js";
import { PAGE_BLOCK_TYPES, createPageBlock } from "../lib/pageBlocks.js";

test("buildDisplaySegments keeps theorem children together as one display unit", () => {
  const originalTheorem = createPageBlock({
    id: "theorem-1",
    pageNumber: 1,
    type: PAGE_BLOCK_TYPES.THEOREM,
    order: 0,
    originalContent: "Theorem 2.6 Limit Laws",
    normalizedContent: "Theorem 2.6 Limit Laws",
    children: [
      createPageBlock({
        id: "theorem-1-p",
        pageNumber: 1,
        type: PAGE_BLOCK_TYPES.PARAGRAPH,
        order: 0,
        originalContent: "Theorem 2.6 Limit Laws",
        normalizedContent: "Theorem 2.6 Limit Laws",
      }),
      createPageBlock({
        id: "theorem-1-eq",
        pageNumber: 1,
        type: PAGE_BLOCK_TYPES.EQUATION_GROUP,
        order: 1,
        originalContent: "lim x→c f(x) = L\nlim x→c g(x) = M",
        normalizedContent: "lim x→c f(x) = L\nlim x→c g(x) = M",
        children: [
          createPageBlock({
            id: "theorem-1-eq-1",
            pageNumber: 1,
            type: "equation_step",
            order: 0,
            originalContent: "lim x→c f(x) = L",
            normalizedContent: "lim x→c f(x) = L",
          }),
          createPageBlock({
            id: "theorem-1-eq-2",
            pageNumber: 1,
            type: "equation_step",
            order: 1,
            originalContent: "lim x→c g(x) = M",
            normalizedContent: "lim x→c g(x) = M",
          }),
        ],
      }),
    ],
  });

  const brailleTheorem = {
    ...originalTheorem,
    brailleContent: "⠠⠞⠓⠑⠕⠗⠑⠍\n\n⠇⠊⠍ ⠭⠕⠉ ⠋⠷⠭⠾ ⠶ ⠠⠇\n\n⠇⠊⠍ ⠭⠕⠉ ⠛⠷⠭⠾ ⠶ ⠠⠍",
    children: [
      {
        ...originalTheorem.children[0],
        brailleContent: "⠠⠞⠓⠑⠕⠗⠑⠍",
      },
      {
        ...originalTheorem.children[1],
        brailleContent: "⠇⠊⠍ ⠭⠕⠉ ⠋⠷⠭⠾ ⠶ ⠠⠇\n\n⠇⠊⠍ ⠭⠕⠉ ⠛⠷⠭⠾ ⠶ ⠠⠍",
        children: [
          {
            ...originalTheorem.children[1].children[0],
            brailleContent: "⠇⠊⠍ ⠭⠕⠉ ⠋⠷⠭⠾ ⠶ ⠠⠇",
          },
          {
            ...originalTheorem.children[1].children[1],
            brailleContent: "⠇⠊⠍ ⠭⠕⠉ ⠛⠷⠭⠾ ⠶ ⠠⠍",
          },
        ],
      },
    ],
  };

  const segments = buildDisplaySegments(originalTheorem, brailleTheorem, "theorem-1");

  assert.equal(segments.length, 1);
  assert.equal(segments[0].type, PAGE_BLOCK_TYPES.THEOREM);
  assert.equal(segments[0].children.length, 2);
  assert.equal(segments[0].children[1].type, PAGE_BLOCK_TYPES.EQUATION_GROUP);
  assert.equal(segments[0].children[1].lines.length, 2);
});
