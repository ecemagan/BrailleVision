import test from "node:test";
import assert from "node:assert/strict";

import {
  createAlignedTokenMapping,
  decorateInteractiveTokens,
} from "../lib/blockTokenMapping.js";

test("createAlignedTokenMapping pairs word-like tokens by shared index and preserves whitespace", () => {
  const mapping = createAlignedTokenMapping("limit exists here", "⠇⠊⠍⠊⠞ ⠑⠭⠊⠎⠞⠎ ⠓⠑⠗⠑");

  assert.equal(mapping.sharedCount, 3);
  assert.deepEqual(
    mapping.originalTokens.filter((token) => !token.isWhitespace).map((token) => token.tokenIndex),
    [0, 1, 2],
  );
  assert.deepEqual(
    mapping.brailleTokens.filter((token) => !token.isWhitespace).map((token) => token.tokenIndex),
    [0, 1, 2],
  );
  assert.ok(mapping.originalTokens.some((token) => token.isWhitespace));
  assert.ok(mapping.brailleTokens.some((token) => token.isWhitespace));
});

test("createAlignedTokenMapping leaves extra unmatched tokens inactive", () => {
  const mapping = createAlignedTokenMapping("sum rule applies", "⠎⠥⠍ ⠗⠥⠇⠑");

  assert.equal(mapping.sharedCount, 2);
  assert.deepEqual(
    mapping.originalTokens.filter((token) => !token.isWhitespace).map((token) => token.counterpartIndex),
    [0, 0, 1],
  );
  assert.deepEqual(
    mapping.brailleTokens.filter((token) => !token.isWhitespace).map((token) => token.counterpartIndex),
    [0, 1],
  );
});

test("createAlignedTokenMapping uses proportional token-level fallback when token counts diverge heavily", () => {
  const mapping = createAlignedTokenMapping(
    "Suppose that the limit exists and is finite.",
    "⠎⠥⠏⠏⠕⠎⠑ ⠞⠓⠑ ⠇⠊⠍⠊⠞",
  );

  assert.equal(mapping.sharedCount, 3);
  assert.equal(mapping.degraded, true);
  assert.deepEqual(
    mapping.originalTokens.filter((token) => !token.isWhitespace).map((token) => token.counterpartIndex),
    [0, 0, 0, 1, 1, 1, 2, 2],
  );
  assert.deepEqual(
    mapping.brailleTokens.filter((token) => !token.isWhitespace).map((token) => token.counterpartIndex),
    [0, 2, 5],
  );
});

test("decorateInteractiveTokens gives different exact-match highlight keys to different tokens in the same segment", () => {
  const mapping = createAlignedTokenMapping("alpha beta gamma", "⠁⠇⠏⠓⠁ ⠃⠑⠞⠁ ⠛⠁⠍⠍⠁");
  const decorated = decorateInteractiveTokens(mapping.originalTokens, {
    blockId: "block-1-0000",
    side: "original",
    segmentId: "block-1-0000-root",
  });

  const interactiveTokens = decorated.filter((token) => token.interactionKey);

  assert.equal(interactiveTokens[2].tokenIndex, 2);
  assert.notEqual(interactiveTokens[1].interactionKey, interactiveTokens[2].interactionKey);
  assert.notEqual(interactiveTokens[0].interactionKey, interactiveTokens[2].interactionKey);
});

test("one braille token maps to exactly one original token through proportional fallback", () => {
  const mapping = createAlignedTokenMapping(
    "Suppose that the limit exists and is finite.",
    "⠎⠥⠏⠏⠕⠎⠑ ⠞⠓⠑ ⠇⠊⠍⠊⠞",
  );
  const decorated = decorateInteractiveTokens(mapping.brailleTokens, {
    blockId: "block-1-0000",
    side: "braille",
    segmentId: "block-1-0000-child-1",
  });

  const interactiveTokens = decorated.filter((token) => token.interactionKey);
  const thirdBrailleToken = interactiveTokens[2];

  assert.equal(thirdBrailleToken.counterpartIndex, 5);
  assert.equal(
    thirdBrailleToken.counterpartKey,
    "block-1-0000::original::block-1-0000-child-1::token::5",
  );
  assert.equal(interactiveTokens.filter((token) => token.counterpartKey === thirdBrailleToken.counterpartKey).length, 1);
});

test("hovering one braille token does not target all original tokens in the same segment", () => {
  const mapping = createAlignedTokenMapping(
    "Suppose that the limit exists and is finite.",
    "⠎⠥⠏⠏⠕⠎⠑ ⠞⠓⠑ ⠇⠊⠍⠊⠞",
  );
  const originalTokens = decorateInteractiveTokens(mapping.originalTokens, {
    blockId: "block-1-0000",
    side: "original",
    segmentId: "block-1-0000-child-1",
  }).filter((token) => token.interactionKey);
  const brailleTokens = decorateInteractiveTokens(mapping.brailleTokens, {
    blockId: "block-1-0000",
    side: "braille",
    segmentId: "block-1-0000-child-1",
  }).filter((token) => token.interactionKey);

  const activeBrailleToken = brailleTokens[1];
  const matchedOriginalTokens = originalTokens.filter(
    (token) => token.interactionKey === activeBrailleToken.counterpartKey,
  );

  assert.equal(matchedOriginalTokens.length, 1);
  assert.equal(matchedOriginalTokens[0].tokenIndex, 2);
});
