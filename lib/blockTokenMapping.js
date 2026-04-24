const MATH_OPERATOR_CHARS = new Set([
  "→",
  "≤",
  "≥",
  "≠",
  "=",
  "+",
  "-",
  "*",
  "/",
  "^",
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
  ",",
  ".",
  ":",
  ";",
  "√",
  "∑",
  "∫",
  "∞",
  "·",
]);

function isAsciiLetter(char) {
  return /[A-Za-z]/u.test(char);
}

function isDigit(char) {
  return /[0-9]/u.test(char);
}

function isMathLikeText(text) {
  return /\blim\b|√|∫|∑|→|=|\^|\/|·|[(){}\[\]]/u.test(String(text || ""));
}

export function tokenizeForHighlight(text, { isMath = false } = {}) {
  const value = String(text || "");
  if (!value) {
    return [];
  }

  if (!isMath) {
    return (value.match(/\s+|[^\s]+/gu) || []).map((token) => ({
      value: token,
      kind: /^\s+$/u.test(token) ? "space" : "word",
    }));
  }

  const tokens = [];
  let index = 0;

  while (index < value.length) {
    const current = value[index];

    if (/\s/u.test(current)) {
      let end = index + 1;
      while (end < value.length && /\s/u.test(value[end])) {
        end += 1;
      }
      tokens.push({ value: value.slice(index, end), kind: "space" });
      index = end;
      continue;
    }

    if (MATH_OPERATOR_CHARS.has(current)) {
      tokens.push({
        value: current,
        kind: /[=+\-*/^(){}\[\],.:;]/u.test(current) ? "operator" : "math",
      });
      index += 1;
      continue;
    }

    if (isDigit(current)) {
      let end = index + 1;
      while (end < value.length && isDigit(value[end])) {
        end += 1;
      }
      if (value[end] === "." && isDigit(value[end + 1])) {
        end += 2;
        while (end < value.length && isDigit(value[end])) {
          end += 1;
        }
      }
      tokens.push({ value: value.slice(index, end), kind: "math" });
      index = end;
      continue;
    }

    if (isAsciiLetter(current)) {
      let end = index + 1;
      while (end < value.length && isAsciiLetter(value[end])) {
        end += 1;
      }
      tokens.push({ value: value.slice(index, end), kind: "math" });
      index = end;
      continue;
    }

    tokens.push({ value: current, kind: "math" });
    index += 1;
  }

  return tokens;
}

function splitIntoDisplayTokens(text, { isMath = false } = {}) {
  const rawTokens = tokenizeForHighlight(text, { isMath });
  let segmentIndex = 0;

  return rawTokens.map((token) => {
    const isWhitespace = token.kind === "space";
    const mappedIndex = isWhitespace ? null : segmentIndex++;
    return {
      text: token.value,
      kind: token.kind,
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

export function createAlignedTokenMapping(originalText, brailleText, options = {}) {
  const shouldUseMathForOriginal =
    options.isMathOriginal !== undefined
      ? options.isMathOriginal
      : options.isMath !== undefined
        ? options.isMath
        : isMathLikeText(originalText);
  const shouldUseMathForBraille =
    options.isMathBraille !== undefined
      ? options.isMathBraille
      : options.isMath !== undefined
        ? options.isMath
        : isMathLikeText(originalText) || isMathLikeText(brailleText);

  const originalTokens = splitIntoDisplayTokens(originalText, {
    isMath: shouldUseMathForOriginal,
  });
  const brailleTokens = splitIntoDisplayTokens(brailleText, {
    isMath: shouldUseMathForBraille,
  });
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
