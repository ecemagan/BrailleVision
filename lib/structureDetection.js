export const STRUCTURE_TYPES = {
  REAL_PARAGRAPH: "REAL_PARAGRAPH",
  LINE_BASED: "LINE_BASED",
  MIXED: "MIXED",
};

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .normalize("NFC");
}

function toLineArray(input) {
  if (Array.isArray(input)) {
    return input.map((line) => String(line || "").replace(/\r/g, ""));
  }

  return normalizeText(input).split("\n");
}

function splitIntoBlocks(lines) {
  const blocks = [];
  let current = [];

  lines.forEach((line) => {
    if (!String(line || "").trim()) {
      if (current.length) {
        blocks.push({ lines: current, preserveBreakAfter: true });
        current = [];
      }
      return;
    }

    current.push(String(line || "").replace(/\s+$/g, ""));
  });

  if (current.length) {
    blocks.push({ lines: current, preserveBreakAfter: false });
  }

  return blocks;
}

function isFormulaLike(line) {
  return (
    /[=∫√π∞≤≥⇔⇒⊂∈^_]/u.test(line) ||
    /\b(?:sqrt|log|ln|sin|cos|tan|int)\s*\(/iu.test(line) ||
    /(?:\d|[a-z])\s*[+/*=]\s*(?:\d|[a-z])/iu.test(line)
  );
}

function isListLike(line) {
  return /^(\(?\d+[.)]|[a-zçğıöşü]\)|[-*•▪◦])/iu.test(line.trim());
}

function isHeadingLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.length > 80) {
    return false;
  }

  if (/[.!?;:]$/.test(trimmed)) {
    return false;
  }

  if (isListLike(trimmed) || isFormulaLike(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const capitalizedWords = words.filter((word) => /^\p{Lu}/u.test(word)).length;

  return words.length <= 8 && (capitalizedWords >= Math.max(1, words.length - 1) || trimmed === trimmed.toUpperCase());
}

function getLastWord(line) {
  return line.trim().match(/([\p{L}]+)-?$/u)?.[1] || "";
}

function getFirstWord(line) {
  return line.trim().replace(/^[-–—]+/, "").match(/^\p{L}+/u)?.[0] || "";
}

function isLowercaseWord(word) {
  return Boolean(word) && word === word.toLocaleLowerCase("tr-TR");
}

function isSentenceTerminal(line) {
  return /[.!?…]["')\]]*$/u.test(String(line || "").trim());
}

function shouldMergeAsParagraph(currentLine, nextLine) {
  const currentTrimmed = currentLine.trim();
  const nextTrimmed = nextLine.trim();

  if (!currentTrimmed || !nextTrimmed) {
    return false;
  }

  if (isFormulaLike(currentTrimmed) || isFormulaLike(nextTrimmed)) {
    return false;
  }

  if (isListLike(currentTrimmed) || isListLike(nextTrimmed)) {
    return false;
  }

  if (isHeadingLine(currentTrimmed) || isHeadingLine(nextTrimmed)) {
    return false;
  }

  return true;
}

function countWrappedSentenceContinuations(lines) {
  return lines.slice(0, -1).filter((line, index) => {
    const currentTrimmed = String(line || "").trim();
    const nextTrimmed = String(lines[index + 1] || "").trim();

    if (!shouldMergeAsParagraph(currentTrimmed, nextTrimmed)) {
      return false;
    }

    if (isSentenceTerminal(currentTrimmed)) {
      return false;
    }

    return currentTrimmed.length >= 18 || nextTrimmed.length >= 18;
  }).length;
}

function repairMergedBoundaryToken(token) {
  return token
    .replace(/(aca|ece)g([ıiuü])z$/u, "$1ğ$2z")
    .replace(/(aca|ece)g([ıiuü])m$/u, "$1ğ$2m")
    .replace(/(aca|ece)g([ıiuü])n$/u, "$1ğ$2n");
}

function buildMergedLine(currentLine, nextLine, joinWithoutSpace = false) {
  const currentTrimmed = currentLine.trim();
  const nextTrimmed = nextLine.trim().replace(/^[-–—]+/, "");

  if (joinWithoutSpace) {
    const currentWord = getLastWord(currentTrimmed);
    const nextWord = getFirstWord(nextTrimmed);
    const mergedToken = repairMergedBoundaryToken(`${currentWord}${nextWord}`);
    const currentSuffixOffset = currentTrimmed.endsWith("-") ? currentWord.length + 1 : currentWord.length;
    const currentPrefix = currentTrimmed.slice(0, currentTrimmed.length - currentSuffixOffset);
    const nextSuffix = nextTrimmed.slice(nextWord.length);

    return `${currentPrefix}${mergedToken}${nextSuffix}`.replace(/\s+/g, " ").trim();
  }

  return `${currentTrimmed} ${nextTrimmed}`.replace(/\s+/g, " ").trim();
}

function shouldJoinWithoutSpace(currentLine, nextLine) {
  const currentTrimmed = currentLine.trim();
  const nextTrimmed = nextLine.trim();
  const currentWord = getLastWord(currentTrimmed);
  const nextWord = getFirstWord(nextTrimmed);

  if (!currentWord || !nextWord) {
    return false;
  }

  if (/-$/u.test(currentTrimmed)) {
    return true;
  }

  if (!isLowercaseWord(currentWord) || !isLowercaseWord(nextWord)) {
    return false;
  }

  if (/(aca|ece)$/u.test(currentWord) && /^g[ıiuü]z$/u.test(nextWord)) {
    return true;
  }

  return false;
}

function analyzeBlock(lines, { sourceType = "manual" } = {}) {
  const safeLines = lines.map((line) => String(line || "").replace(/\s+$/g, ""));
  const lengths = safeLines.map((line) => line.trim().length).filter(Boolean);
  const averageLength = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 0;
  const continuationCount = safeLines.slice(0, -1).filter((line, index) => shouldMergeAsParagraph(line, safeLines[index + 1])).length;
  const wrappedContinuationCount = countWrappedSentenceContinuations(safeLines);
  const shortMeaningfulLines = safeLines.filter((line) => line.trim().length > 0 && line.trim().length <= 44).length;
  const listCount = safeLines.filter(isListLike).length;
  const formulaCount = safeLines.filter(isFormulaLike).length;

  if (safeLines.length === 1 && isHeadingLine(safeLines[0])) {
    return STRUCTURE_TYPES.LINE_BASED;
  }

  if (listCount > 0 || formulaCount > 0) {
    return continuationCount > 0 ? STRUCTURE_TYPES.MIXED : STRUCTURE_TYPES.LINE_BASED;
  }

  if (continuationCount >= Math.max(1, Math.floor((safeLines.length - 1) * 0.6)) && averageLength >= 26) {
    return STRUCTURE_TYPES.REAL_PARAGRAPH;
  }

  if (
    sourceType === "pdf" &&
    wrappedContinuationCount >= Math.max(1, Math.floor((safeLines.length - 1) * 0.6))
  ) {
    return STRUCTURE_TYPES.REAL_PARAGRAPH;
  }

  if (shortMeaningfulLines >= Math.max(2, Math.ceil(safeLines.length * 0.7))) {
    return STRUCTURE_TYPES.LINE_BASED;
  }

  if (averageLength >= 58) {
    return STRUCTURE_TYPES.REAL_PARAGRAPH;
  }

  return continuationCount > 0 ? STRUCTURE_TYPES.MIXED : STRUCTURE_TYPES.LINE_BASED;
}

export function fixBrokenWords(lines) {
  const safeLines = toLineArray(lines).map((line) => String(line || "").replace(/\s+$/g, ""));
  const fixes = [];

  if (safeLines.length <= 1) {
    return {
      lines: safeLines.filter((line) => line !== ""),
      fixes,
    };
  }

  const mergedLines = [];
  let current = safeLines[0];

  for (let index = 1; index < safeLines.length; index += 1) {
    const next = safeLines[index];

    if (!shouldMergeAsParagraph(current, next)) {
      mergedLines.push(current.trim());
      current = next;
      continue;
    }

    if (shouldJoinWithoutSpace(current, next)) {
      const reason = /-$/.test(current.trim()) ? "merged hyphenated word" : "merged broken word";
      current = buildMergedLine(current, next, true);
      fixes.push(reason);
      continue;
    }

    current = buildMergedLine(current, next, false);
    fixes.push("merged wrapped line");
  }

  mergedLines.push(current.trim());

  return {
    lines: mergedLines.filter(Boolean),
    fixes: [...new Set(fixes)],
  };
}

function mapStructureTypeToMode(type, hadBlankLines = false) {
  if (type === STRUCTURE_TYPES.LINE_BASED) {
    return "line_preserved";
  }

  if (type === STRUCTURE_TYPES.REAL_PARAGRAPH) {
    return hadBlankLines ? "paragraph_preserved" : "plain_prose";
  }

  return "mixed_structured";
}

export function detectStructure(input, options = {}) {
  const lines = toLineArray(input);
  const blocks = splitIntoBlocks(lines);
  const analyzedBlocks = blocks.map((block, index) => ({
    id: `block_${index + 1}`,
    type: analyzeBlock(block.lines, options),
    lines: block.lines,
    preserveBreakAfter: block.preserveBreakAfter,
  }));

  const uniqueTypes = [...new Set(analyzedBlocks.map((block) => block.type))];
  const overallType = uniqueTypes.length <= 1 ? uniqueTypes[0] || STRUCTURE_TYPES.REAL_PARAGRAPH : STRUCTURE_TYPES.MIXED;
  const hadBlankLines = lines.some((line) => !String(line || "").trim());

  return {
    classification: overallType,
    mode: mapStructureTypeToMode(overallType, hadBlankLines),
    blocks: analyzedBlocks,
    sourceType: options.sourceType || "manual",
  };
}

export function rebuildText(input, requestedMode = null, options = {}) {
  const lines = toLineArray(input);
  const detection = detectStructure(lines, options);
  const classification = requestedMode || detection.classification;
  const rebuiltLines = [];
  const fixes = [];

  if (classification === STRUCTURE_TYPES.REAL_PARAGRAPH) {
    const merged = fixBrokenWords(lines.filter((line) => String(line || "").trim()));
    return {
      mode: mapStructureTypeToMode(classification, lines.some((line) => !String(line || "").trim())),
      clean_text: merged.lines.join("\n\n").trim(),
      lines: merged.lines,
      fixes: merged.fixes,
    };
  }

  if (classification === STRUCTURE_TYPES.LINE_BASED) {
    return {
      mode: mapStructureTypeToMode(classification, lines.some((line) => !String(line || "").trim())),
      clean_text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      lines,
      fixes,
    };
  }

  detection.blocks.forEach((block, index) => {
    if (block.type === STRUCTURE_TYPES.REAL_PARAGRAPH) {
      const merged = fixBrokenWords(block.lines);
      rebuiltLines.push(...merged.lines);
      fixes.push(...merged.fixes);
    } else {
      rebuiltLines.push(...block.lines);
    }

    if (block.preserveBreakAfter && index < detection.blocks.length - 1) {
      rebuiltLines.push("");
    }
  });

  return {
    mode: mapStructureTypeToMode(classification, rebuiltLines.some((line) => !String(line || "").trim())),
    clean_text: rebuiltLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    lines: rebuiltLines,
    fixes: [...new Set(fixes)],
  };
}

export function formatTextByStructure(text, options = {}) {
  const detection = detectStructure(text, options);
  const rebuilt = rebuildText(text, detection.classification, options);

  const lines = toLineArray(rebuilt.clean_text);
  const blocks = splitIntoBlocks(lines).map((block, index) => ({
    id: `block_${index + 1}`,
    type: analyzeBlock(block.lines, options),
    text: block.lines.join("\n").trim(),
    lines: block.lines,
    preserveBreakAfter: block.preserveBreakAfter,
  }));

  return {
    ...detection,
    mode: rebuilt.mode,
    blocks,
    text: rebuilt.clean_text,
    clean_text: rebuilt.clean_text,
    lines: rebuilt.lines,
    fixes: rebuilt.fixes,
  };
}

export function paginateTextByStructure(text, { mode = "plain_prose", targetLength = 1600 } = {}) {
  const normalized = normalizeText(text).trim();

  if (!normalized) {
    return [];
  }

  if (mode === "line_preserved") {
    const lines = normalized.split("\n");
    const pages = [];
    let current = [];
    let currentLength = 0;

    lines.forEach((line) => {
      const nextLength = currentLength + line.length + (current.length ? 1 : 0);

      if (current.length && nextLength > targetLength) {
        pages.push(current.join("\n").trim());
        current = [];
        currentLength = 0;
      }

      current.push(line);
      currentLength += line.length + (current.length > 1 ? 1 : 0);
    });

    if (current.length) {
      pages.push(current.join("\n").trim());
    }

    return pages.filter(Boolean);
  }

  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const pages = [];
  let currentPage = "";

  blocks.forEach((block) => {
    const candidate = currentPage ? `${currentPage}\n\n${block}` : block;

    if (candidate.length <= targetLength) {
      currentPage = candidate;
      return;
    }

    if (currentPage) {
      pages.push(currentPage);
      currentPage = "";
    }

    if (block.length <= targetLength) {
      currentPage = block;
      return;
    }

    let start = 0;

    while (start < block.length) {
      const slice = block.slice(start, start + targetLength);

      if (slice.length < targetLength || start + targetLength >= block.length) {
        pages.push(slice.trim());
        break;
      }

      const splitAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" "));
      const chunkSize = splitAt > targetLength * 0.45 ? splitAt + 1 : slice.length;
      pages.push(block.slice(start, start + chunkSize).trim());
      start += chunkSize;
    }
  });

  if (currentPage) {
    pages.push(currentPage);
  }

  return pages.filter(Boolean);
}
