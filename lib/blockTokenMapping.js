function splitIntoDisplayTokens(text) {
  const rawTokens = String(text || "").match(/\s+|[^\s]+/g) || [];
  let segmentIndex = 0;

  return rawTokens.map((token) => {
    const isWhitespace = /^\s+$/u.test(token);
    const mappedIndex = isWhitespace ? null : segmentIndex++;
    return {
      text: token,
      isWhitespace,
      tokenIndex: mappedIndex,
    };
  });
}

function limitMappedIndexes(tokens, sharedCount) {
  return tokens.map((token) => ({
    ...token,
    tokenIndex:
      token.isWhitespace || token.tokenIndex === null || token.tokenIndex >= sharedCount
        ? null
        : token.tokenIndex,
  }));
}

function mapTokenIndex(sourceIndex, sourceCount, targetCount) {
  if (sourceIndex === null || sourceCount <= 0 || targetCount <= 0) {
    return null;
  }

  return Math.min(targetCount - 1, Math.floor((sourceIndex / sourceCount) * targetCount));
}

function addCounterpartIndexes(tokens, sourceCount, targetCount) {
  return tokens.map((token) => ({
    ...token,
    counterpartIndex:
      token.isWhitespace || token.tokenIndex === null
        ? null
        : mapTokenIndex(token.tokenIndex, sourceCount, targetCount),
  }));
}

function getInteractionKey(blockId, side, segmentId, tokenIndex) {
  return `${blockId}::${side}::${segmentId}::token::${tokenIndex}`;
}

export function decorateInteractiveTokens(tokens, { blockId, side, segmentId }) {
  const oppositeSide = side === "original" ? "braille" : "original";

  return tokens.map((token, renderIndex) => {
    if (token.isWhitespace || token.tokenIndex === null) {
      return {
        ...token,
        tokenKey: `${blockId}::${side}::${segmentId}::space::${renderIndex}`,
        interactionKey: null,
        counterpartKey: null,
      };
    }

    return {
      ...token,
      tokenKey: `${blockId}::${side}::${segmentId}::token::${token.tokenIndex}::${renderIndex}`,
      interactionKey: getInteractionKey(blockId, side, segmentId, token.tokenIndex),
      counterpartKey:
        token.counterpartIndex === null
          ? null
          : getInteractionKey(blockId, oppositeSide, segmentId, token.counterpartIndex),
    };
  });
}

export function createAlignedTokenMapping(originalText, brailleText) {
  const originalTokens = splitIntoDisplayTokens(originalText);
  const brailleTokens = splitIntoDisplayTokens(brailleText);
  const originalCount = originalTokens.filter((token) => !token.isWhitespace).length;
  const brailleCount = brailleTokens.filter((token) => !token.isWhitespace).length;

  return {
    originalTokens: addCounterpartIndexes(originalTokens, originalCount, brailleCount),
    brailleTokens: addCounterpartIndexes(brailleTokens, brailleCount, originalCount),
    sharedCount: Math.min(originalCount, brailleCount),
    degraded: originalCount !== brailleCount,
    originalCount,
    brailleCount,
  };
}
