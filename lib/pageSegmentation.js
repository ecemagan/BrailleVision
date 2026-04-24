import { PAGE_BLOCK_TYPES, createPageBlock, makeBlockId } from "./pageBlocks.js";

function normalizeLine(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trimEnd();
}

function clampNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeBBox(bbox) {
  if (!bbox) return undefined;
  const x0 = clampNumber(bbox.x0);
  const y0 = clampNumber(bbox.y0);
  const x1 = clampNumber(bbox.x1);
  const y1 = clampNumber(bbox.y1);
  if (!Number.isFinite(x0 + y0 + x1 + y1)) return undefined;
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
    space: bbox.space || "pdf",
  };
}

function bboxWidth(bbox) {
  return bbox ? Math.max(0, bbox.x1 - bbox.x0) : 0;
}

function bboxHeight(bbox) {
  return bbox ? Math.max(0, bbox.y1 - bbox.y0) : 0;
}

function bboxXMid(bbox) {
  return bbox ? (bbox.x0 + bbox.x1) / 2 : 0;
}

function bboxYMid(bbox) {
  return bbox ? (bbox.y0 + bbox.y1) / 2 : 0;
}

function bboxOverlapRatioY(a, b) {
  if (!a || !b) return 0;
  const top = Math.min(a.y1, b.y1);
  const bottom = Math.max(a.y0, b.y0);
  const overlap = Math.max(0, top - bottom);
  const denom = Math.min(bboxHeight(a) || 1, bboxHeight(b) || 1);
  return overlap / denom;
}

export function sortLayoutLinesByReadingOrder(lines = []) {
  const safe = (lines || []).map((line) => ({
    ...line,
    bbox: normalizeBBox(line?.bbox),
    text: normalizeLine(line?.text),
  }));

  return safe
    .filter((line) => line.text && line.bbox)
    .sort((left, right) => {
      const dy = bboxYMid(right.bbox) - bboxYMid(left.bbox);
      if (Math.abs(dy) > 0.8) {
        return dy;
      }
      const dx = left.bbox.x0 - right.bbox.x0;
      if (Math.abs(dx) > 0.8) {
        return dx;
      }
      return (left.text || "").localeCompare(right.text || "");
    });
}

function looksLikeMathLine(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (looksLikeRuleItemStart(value)) return false;

  return (
    /[=≠≤≥∞∫√±×÷→←↔⇔∈∉^/_]/u.test(value) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt|int|diff)\b/iu.test(value) ||
    /\b[fgh]\(x\)\b/u.test(value)
  );
}

function looksLikeEquationStep(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/^=/.test(value)) return true;
  if (/^[+\-−]/.test(value) && /[=]/.test(value)) return true;
  return looksLikeMathLine(value);
}

function looksLikeProseLine(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (looksLikeMathLine(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 7) return true;
  if (/[.!?…]$/.test(value) && words.length >= 4) return true;
  return false;
}

function looksLikeShortExplanatoryProseLine(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (looksLikeMathLine(value) || looksLikeCaptionLine(value) || looksLikeKeywordBlockStart(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 7) return false;

  return /^(?:by|so|thus|therefore|hence|since|because|using|where|then|now)\b/iu.test(value);
}

function startsWithExplanatoryLead(text) {
  return /^(?:in words|that is|this means|note that|in particular|therefore|thus|so)\b/iu.test(String(text || "").trim());
}

function looksLikeCaptionLine(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 110) return false;
  return /^(?:figure|fig\.|table)\s*\d+/iu.test(value);
}

function looksLikeHeadingLine(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 80) return false;
  if (/[.!?;:]$/.test(value)) return false;
  if (looksLikeMathLine(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 10) return false;

  const capitalized = words.filter((word) => /^\p{Lu}/u.test(word)).length;
  const allCaps = value === value.toUpperCase() && /[A-Z]/.test(value);
  return allCaps || capitalized >= Math.max(1, words.length - 1);
}

function looksLikeRuleItemStart(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return /^\d+\.\s+\S/u.test(value);
}

function appendText(a, b) {
  return [a, b].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizeTheoremMathText(text) {
  return String(text || "")
    .replace(/\bx\s*S\s*c\b/giu, "x→c")
    .replace(/\bxSc\b/giu, "x→c")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function findInlineRuleStart(text) {
  const value = String(text || "");
  const match = /(?:^|\s)(\d+)\.\s+([A-Z][A-Za-z\s]+Rule):?\s*/u.exec(value);
  if (!match) {
    return null;
  }

  const leadingWhitespace = /^\s/u.test(match[0]) ? 1 : 0;

  return {
    index: (match.index || 0) + leadingWhitespace,
    number: match[1],
    title: match[2].trim(),
    fullMatch: match[0].trim(),
  };
}

function parseRuleItemStart(text) {
  const value = String(text || "").trim();
  if (!value) {
    return null;
  }

  const match = /^(\d+)\.\s+(.+?Rule):?\s*(.*)$/iu.exec(value);
  if (!match) {
    return null;
  }

  return {
    number: match[1],
    title: match[2].trim(),
    remainder: match[3].trim(),
  };
}

function isTheoremStartLine(text) {
  return /^(?:THEOREM|Theorem)\s+\d+/u.test(String(text || "").trim());
}

function splitTheoremHeadingAndIntro(text) {
  const value = String(text || "").trim();
  const markerMatch = /\b(?:If|Suppose|Let|Assume|For)\b/u.exec(value);

  if (!markerMatch || markerMatch.index <= 0) {
    return {
      title: value,
      intro: "",
    };
  }

  return {
    title: value
      .slice(0, markerMatch.index)
      .replace(/(?:-|—|–|:|\s)+$/u, "")
      .trim(),
    intro: value.slice(markerMatch.index).trim(),
  };
}

function splitLeadingTheoremIntroFromMath(text) {
  const value = String(text || "").trim();
  if (!/^(?:If|Suppose|Let|Assume|For)\b/u.test(value)) {
    return null;
  }

  const mathMarker = /\blim\b|ƒ|f\(x\)|g\(x\)|[=≠≤≥→∞∫√]/iu.exec(value);
  if (!mathMarker || mathMarker.index <= 0) {
    return null;
  }

  const intro = value.slice(0, mathMarker.index).replace(/[,:;\s]+$/u, "").trim();
  const remainder = value.slice(mathMarker.index).trim();

  if (!intro || !remainder) {
    return null;
  }

  return { intro, remainder };
}

function isMathLikeLine(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  return (
    /lim|ƒ|f\(x\)|g\(x\)|xSc|x→c|=|≠|#|·|\+|-|\/|\^|√|[∑∫]/iu.test(value) ||
    looksLikeEquationStep(value) ||
    looksLikeMathLine(value)
  );
}

function isEquationContinuationLine(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return false;
  }

  return (
    isMathLikeLine(trimmed) ||
    /^x\s*(?:Sc|→c|->c)/iu.test(trimmed) ||
    /^[a-zA-Z]\(x\)/u.test(trimmed) ||
    /^[()]/u.test(trimmed) ||
    /^[+\-*/=]/u.test(trimmed)
  );
}

function looksLikeTheoremNoteStart(text) {
  return /^\((?:If|Suppose|Let|Assume|For)\b/u.test(String(text || "").trim());
}

function isStrongTheoremBoundary(text) {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }

  const keywordType = detectKeywordBlockType(value);
  if (keywordType && keywordType !== PAGE_BLOCK_TYPES.THEOREM) {
    return true;
  }

  if (looksLikeCaptionLine(value)) {
    return true;
  }

  if (looksLikeRuleItemStart(value)) {
    return false;
  }

  if (/^\d+(?:\.\d+)+\s+\S/u.test(value) && !looksLikeRuleItemStart(value)) {
    return true;
  }

  return looksLikeHeadingLine(value) && !isTheoremStartLine(value);
}

function detectKeywordBlockType(text) {
  const value = String(text || "").trim();
  if (!value) return null;

  const keywordMatch =
    /^(?:\d+[\s.)-]*)?(?:(worked)\s+)?(definition|theorem|example|solution|proof|remark|note|exercise)s?\b[:.\-]?/iu.exec(
      value,
    );

  if (!keywordMatch) {
    return null;
  }

  const keyword = keywordMatch[2].toLowerCase();
  if (keyword === "definition") return PAGE_BLOCK_TYPES.DEFINITION_BOX;
  if (keyword === "theorem") return PAGE_BLOCK_TYPES.THEOREM;
  if (keyword === "example") return PAGE_BLOCK_TYPES.EXAMPLE;
  if (keyword === "solution" || keyword === "proof") return PAGE_BLOCK_TYPES.SOLUTION;
  if (keyword === "exercise") return PAGE_BLOCK_TYPES.EXERCISE_LIST;
  return PAGE_BLOCK_TYPES.SIDEBAR_NOTE;
}

function looksLikeKeywordBlockStart(text) {
  return Boolean(detectKeywordBlockType(text));
}

function hasStrongProseSignal(lines = []) {
  const safeLines = (lines || []).map((line) => String(line || "").trim()).filter(Boolean);
  if (!safeLines.length) {
    return false;
  }

  const proseCount = safeLines.filter(
    (line) => looksLikeProseLine(line) || looksLikeShortExplanatoryProseLine(line) || startsWithExplanatoryLead(line),
  ).length;

  if (!proseCount) {
    return false;
  }

  if (startsWithExplanatoryLead(safeLines[0]) || looksLikeProseLine(safeLines[0])) {
    return true;
  }

  return proseCount >= Math.ceil(safeLines.length / 2);
}

function classifyBlock(lines) {
  const first = String(lines[0] || "").trim();
  const joined = lines.map((line) => String(line || "").trim()).filter(Boolean).join(" \n");

  if (!first) {
    return PAGE_BLOCK_TYPES.PARAGRAPH;
  }

  if (looksLikeCaptionLine(first)) {
    return first.toLowerCase().startsWith("table") ? PAGE_BLOCK_TYPES.TABLE_PLACEHOLDER : PAGE_BLOCK_TYPES.GRAPH_PLACEHOLDER;
  }

  if (looksLikeHeadingLine(first) && lines.length <= 2) {
    return first.length <= 38 ? PAGE_BLOCK_TYPES.CHAPTER_HEADER : PAGE_BLOCK_TYPES.SECTION_HEADER;
  }

  const keywordType = detectKeywordBlockType(first);
  if (keywordType) {
    return keywordType;
  }

  if (lines.every((line) => looksLikeMathLine(line))) {
    return PAGE_BLOCK_TYPES.EQUATION_GROUP;
  }

  if (hasStrongProseSignal(lines)) {
    return PAGE_BLOCK_TYPES.PARAGRAPH;
  }

  if (looksLikeMathLine(joined) && lines.length >= 2) {
    return PAGE_BLOCK_TYPES.EQUATION_GROUP;
  }

  return PAGE_BLOCK_TYPES.PARAGRAPH;
}

function buildBBoxFromLines(lines) {
  const lineBBoxes = (lines || []).map((line) => line?.bbox).filter(Boolean);
  if (!lineBBoxes.length) return undefined;
  const xs0 = lineBBoxes.map((b) => b.x0);
  const ys0 = lineBBoxes.map((b) => b.y0);
  const xs1 = lineBBoxes.map((b) => b.x1);
  const ys1 = lineBBoxes.map((b) => b.y1);
  return {
    x0: Math.min(...xs0),
    y0: Math.min(...ys0),
    x1: Math.max(...xs1),
    y1: Math.max(...ys1),
    space: lineBBoxes[0].space || "pdf",
  };
}

function makeEquationChildren(pageNumber, parentId, steps) {
  return steps.map((stepText, index) =>
    createPageBlock({
      id: `${parentId}-step-${String(index + 1).padStart(2, "0")}`,
      pageNumber,
      type: "equation_step",
      order: index,
      originalContent: stepText,
      normalizedContent: stepText,
      confidence: 0.65,
    }),
  );
}

function createChildBlockFromEntries({ parentId, pageNumber, order, type, entries, confidence = 0.66, children } = {}) {
  const contentLines = (entries || []).map((entry) => entry?.text).filter(Boolean);
  const joined = contentLines.join("\n").trim();
  return createPageBlock({
    id: `${parentId}-${type}-${String(order + 1).padStart(2, "0")}`,
    pageNumber,
    type,
    order,
    bbox: buildBBoxFromLines(entries),
    originalContent: joined,
    normalizedContent: joined,
    confidence,
    children,
  });
}

function createTheoremChildBlock({
  parentId,
  pageNumber,
  order,
  type,
  entries,
  confidence = 0.66,
  children,
  extra = {},
} = {}) {
  const block = createChildBlockFromEntries({
    parentId,
    pageNumber,
    order,
    type,
    entries,
    confidence,
    children,
  });

  const content = block.originalContent || "";

  return {
    ...block,
    content,
    text: content,
    originalText: content,
    ...extra,
  };
}

function median(values = []) {
  const safe = values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!safe.length) return 0;
  const mid = Math.floor(safe.length / 2);
  return safe.length % 2 ? safe[mid] : (safe[mid - 1] + safe[mid]) / 2;
}

function shouldTreatTheoremLineAsMath(text) {
  const value = String(text || "").trim();
  if (!value || looksLikeRuleItemStart(value) || looksLikeCaptionLine(value) || looksLikeKeywordBlockStart(value)) {
    return false;
  }

  if (isEquationContinuationLine(value)) {
    return true;
  }

  if ((looksLikeProseLine(value) || (/[.!?]$/.test(value) && value.split(/\s+/).filter(Boolean).length >= 6)) && !/^(?:lim\b|[=+\-−]|∫|√|[fgh]\(x\))/u.test(value)) {
    return false;
  }

  if (looksLikeEquationStep(value) || looksLikeMathLine(value)) {
    return true;
  }

  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= 8 && /(?:\blim\b|\bf\(x\)\b|\bg\(x\)\b|[=≠≤≥→∞∫√])/u.test(value);
}

function splitEntryAroundInlineRule(entries, index) {
  const entry = entries[index];
  const value = String(entry?.text || "").trim();
  const inlineRule = findInlineRuleStart(value);

  if (!inlineRule || inlineRule.index <= 0) {
    return false;
  }

  const beforeRule = value.slice(0, inlineRule.index).trim();
  const rulePart = value.slice(inlineRule.index).trim();

  if (!beforeRule || !rulePart) {
    return false;
  }

  entries.splice(
    index,
    1,
    { ...entry, text: beforeRule },
    { ...entry, text: rulePart },
  );

  return true;
}

function buildTheoremChildren(entries, { pageNumber = 1, parentId } = {}) {
  if (!Array.isArray(entries) || entries.length <= 1 || !parentId) {
    return { children: undefined, title: "" };
  }

  const safeEntries = entries.filter((entry) => entry?.text?.trim());
  if (!safeEntries.length) {
    return { children: undefined, title: "" };
  }

  const children = [];
  let childOrder = 0;
  let index = 0;
  let theoremTitle = "";

  if (isTheoremStartLine(safeEntries[0]?.text)) {
    const heading = splitTheoremHeadingAndIntro(safeEntries[0].text);
    theoremTitle = heading.title;
    if (heading.intro) {
      children.push(
        createTheoremChildBlock({
          parentId,
          pageNumber,
          order: childOrder,
          type: "theorem_intro",
          entries: [{ ...safeEntries[0], text: heading.intro }],
          confidence: 0.68,
        }),
      );
      childOrder += 1;
    }
    index = 1;
  }

  while (index < safeEntries.length) {
    if (splitEntryAroundInlineRule(safeEntries, index)) {
      continue;
    }

    let entry = safeEntries[index];
    let value = String(entry?.text || "").trim();

    if (!value) {
      index += 1;
      continue;
    }

    if (!children.length) {
      const splitIntro = splitLeadingTheoremIntroFromMath(value);
      if (splitIntro) {
        children.push(
          createTheoremChildBlock({
            parentId,
            pageNumber,
            order: childOrder,
            type: "theorem_intro",
            entries: [{ ...entry, text: splitIntro.intro }],
            confidence: 0.68,
          }),
        );
        childOrder += 1;
        entry = { ...entry, text: splitIntro.remainder };
        value = splitIntro.remainder;
      }
    }

    if (looksLikeTheoremNoteStart(value)) {
      const noteEntries = [entry];
      let balance = (value.match(/\(/g) || []).length - (value.match(/\)/g) || []).length;
      let cursor = index + 1;

      while (cursor < safeEntries.length) {
        if (splitEntryAroundInlineRule(safeEntries, cursor)) {
          continue;
        }

        const next = safeEntries[cursor];
        const nextText = String(next?.text || "").trim();
        if (!nextText) {
          break;
        }

        if (balance <= 0 && (looksLikeRuleItemStart(nextText) || isStrongTheoremBoundary(nextText))) {
          break;
        }

        noteEntries.push(next);
        balance += (nextText.match(/\(/g) || []).length - (nextText.match(/\)/g) || []).length;
        cursor += 1;

        if (balance <= 0 && cursor < safeEntries.length) {
          const after = String(safeEntries[cursor]?.text || "").trim();
          if (looksLikeRuleItemStart(after) || isStrongTheoremBoundary(after)) {
            break;
          }
        }
      }

      children.push(
        createTheoremChildBlock({
          parentId,
          pageNumber,
          order: childOrder,
          type: "theorem_note",
          entries: noteEntries,
          confidence: 0.68,
        }),
      );
      childOrder += 1;
      index = cursor;
      continue;
    }

    if (looksLikeRuleItemStart(value)) {
      const ruleItems = [];
      let cursor = index;
      let ruleOrder = 0;

      while (cursor < safeEntries.length) {
        const current = safeEntries[cursor];
        const parsedRule = parseRuleItemStart(current?.text);
        if (!parsedRule) {
          break;
        }

        let ruleBody = normalizeTheoremMathText(parsedRule.remainder);
        cursor += 1;

        while (cursor < safeEntries.length) {
          if (splitEntryAroundInlineRule(safeEntries, cursor)) {
            continue;
          }

          const next = safeEntries[cursor];
          const nextText = String(next?.text || "").trim();
          if (!nextText || parseRuleItemStart(nextText) || looksLikeTheoremNoteStart(nextText) || isStrongTheoremBoundary(nextText)) {
            break;
          }

          if (!isEquationContinuationLine(nextText) && !isMathLikeLine(nextText) && !shouldTreatTheoremLineAsMath(nextText)) {
            break;
          }

          ruleBody = appendText(ruleBody, normalizeTheoremMathText(nextText));
          cursor += 1;
        }

        const ruleDisplayText = appendText(
          `${parsedRule.number}. ${parsedRule.title}${ruleBody ? ":" : ""}`,
          ruleBody,
        );
        ruleItems.push({
          ...createTheoremChildBlock({
            parentId: `${parentId}-rule-list`,
            pageNumber,
            order: ruleOrder,
            type: PAGE_BLOCK_TYPES.RULE_ITEM,
            entries: [{ ...current, text: ruleDisplayText }],
            confidence: 0.72,
            extra: {
              number: parsedRule.number,
              title: parsedRule.title,
              text: ruleBody,
              content: ruleDisplayText,
              originalText: ruleDisplayText,
            },
          }),
          originalContent: ruleDisplayText,
          normalizedContent: ruleDisplayText,
          originalText: ruleDisplayText,
        });
        ruleOrder += 1;

        const nextRuleText = String(safeEntries[cursor]?.text || "").trim();
        if (!parseRuleItemStart(nextRuleText)) {
          break;
        }
      }

      const ruleListText = ruleItems.map((ruleItem) => ruleItem.originalContent).filter(Boolean).join("\n").trim();
      children.push(
        createTheoremChildBlock({
          parentId,
          pageNumber,
          order: childOrder,
          type: "rule_list",
          entries: ruleItems.map((ruleItem) => ({ text: ruleItem.originalContent, bbox: ruleItem.bbox })),
          confidence: 0.74,
          children: ruleItems,
          extra: {
            text: ruleListText,
            content: ruleListText,
            originalText: ruleListText,
          },
        }),
      );
      childOrder += 1;
      index = cursor;
      continue;
    }

    if (isMathLikeLine(value) || shouldTreatTheoremLineAsMath(value)) {
      const mathEntries = [entry];
      let cursor = index + 1;

      while (cursor < safeEntries.length) {
        if (splitEntryAroundInlineRule(safeEntries, cursor)) {
          continue;
        }

        const next = safeEntries[cursor];
        const nextText = String(next?.text || "").trim();
        if (!nextText || looksLikeRuleItemStart(nextText) || looksLikeTheoremNoteStart(nextText) || isStrongTheoremBoundary(nextText)) {
          break;
        }

        if (!isEquationContinuationLine(nextText) && !isMathLikeLine(nextText) && !shouldTreatTheoremLineAsMath(nextText)) {
          break;
        }

        mathEntries.push(next);
        cursor += 1;
      }

      const equationText = mathEntries.reduce(
        (combined, mathEntry) => appendText(combined, normalizeTheoremMathText(mathEntry?.text)),
        "",
      );

      const child = createTheoremChildBlock({
        parentId,
        pageNumber,
        order: childOrder,
        type: PAGE_BLOCK_TYPES.EQUATION_GROUP,
        entries: [{ ...entry, text: equationText }],
        confidence: 0.74,
      });
      child.children = makeEquationChildren(pageNumber, child.id, [equationText]);
      children.push(child);
      childOrder += 1;
      index = cursor;
      continue;
    }

    const proseEntries = [entry];
    let cursor = index + 1;

    while (cursor < safeEntries.length) {
      if (splitEntryAroundInlineRule(safeEntries, cursor)) {
        break;
      }

      const next = safeEntries[cursor];
      const nextText = String(next?.text || "").trim();
      if (!nextText || looksLikeRuleItemStart(nextText) || looksLikeTheoremNoteStart(nextText) || isStrongTheoremBoundary(nextText)) {
        break;
      }

      if (isMathLikeLine(nextText) || shouldTreatTheoremLineAsMath(nextText)) {
        break;
      }

      proseEntries.push(next);
      cursor += 1;
    }

    const proseType = children.length === 0 ? "theorem_intro" : PAGE_BLOCK_TYPES.PARAGRAPH;
    children.push(
      createTheoremChildBlock({
        parentId,
        pageNumber,
        order: childOrder,
        type: proseType,
        entries: proseEntries,
        confidence: 0.66,
      }),
    );
    childOrder += 1;
    index = cursor;
  }

  return {
    children: children.length ? children : undefined,
    title: theoremTitle,
  };
}

function detectMainColumnBand(lines, { pageWidth = 0 } = {}) {
  const candidates = (lines || [])
    .filter((line) => line?.bbox)
    .map((line) => ({
      line,
      width: bboxWidth(line.bbox),
      center: bboxXMid(line.bbox),
    }));

  if (candidates.length < 3) {
    return null;
  }

  const widths = candidates.map((entry) => entry.width).filter(Boolean);
  const typicalWidth = median(widths);
  const wideThreshold = Math.max(typicalWidth * 0.82, Number(pageWidth || 0) * 0.36, 140);

  const wideLines = candidates.filter((entry) => entry.width >= wideThreshold);
  if (!wideLines.length) {
    return null;
  }

  return {
    x0: median(wideLines.map((entry) => entry.line.bbox.x0)),
    x1: median(wideLines.map((entry) => entry.line.bbox.x1)),
    width: median(wideLines.map((entry) => entry.width)),
    center: median(wideLines.map((entry) => entry.center)),
  };
}

function detectRegionsFromLayout(lines, { pageWidth = 0 } = {}) {
  const width = Number(pageWidth || 0);

  if (!width || lines.length < 3) {
    return [{ id: "main", kind: "main", lines }];
  }

  const rightSidebar = [];
  const leftSidebar = [];
  const main = [];
  const mainBand = detectMainColumnBand(lines, { pageWidth: width });

  const narrowThreshold = width * 0.42;
  const rightEdgeThreshold = width * 0.62;
  const leftEdgeThreshold = width * 0.38;
  const gutterThreshold = Math.max(width * 0.04, 26);

  lines.forEach((line) => {
    const w = bboxWidth(line.bbox);
    const x0 = line.bbox.x0;
    const x1 = line.bbox.x1;
    const center = bboxXMid(line.bbox);

    const isNarrow = w > 0 && w <= narrowThreshold;
    const isRight = x0 >= rightEdgeThreshold;
    const isLeft = x1 <= leftEdgeThreshold;
    const outsideMainBandRight = mainBand ? x0 >= mainBand.x1 + gutterThreshold * 0.5 : isRight;
    const outsideMainBandLeft = mainBand ? x1 <= mainBand.x0 - gutterThreshold * 0.5 : isLeft;
    const insideMainBand =
      mainBand &&
      center >= mainBand.x0 - gutterThreshold &&
      center <= mainBand.x1 + gutterThreshold;

    if (insideMainBand) {
      main.push(line);
      return;
    }

    if (isNarrow && outsideMainBandRight && (isRight || x0 >= (mainBand?.center || 0))) {
      rightSidebar.push(line);
      return;
    }

    if (isNarrow && outsideMainBandLeft && (isLeft || x1 <= (mainBand?.center || width))) {
      leftSidebar.push(line);
      return;
    }

    main.push(line);
  });

  const regions = [];
  const shouldKeepSidebarRegion = (sidebarLines, side) => {
    if (sidebarLines.length >= 2) {
      return true;
    }

    const onlyLine = sidebarLines[0];
    if (!onlyLine?.text) {
      return false;
    }

    if (looksLikeKeywordBlockStart(onlyLine.text) || looksLikeCaptionLine(onlyLine.text) || looksLikeHeadingLine(onlyLine.text)) {
      return true;
    }

    if (!onlyLine.bbox || looksLikeMathLine(onlyLine.text)) {
      return false;
    }

    const words = onlyLine.text.split(/\s+/).filter(Boolean);
    const isShortNote = words.length >= 2 && words.length <= 8 && onlyLine.text.length <= 60;
    const isStrongRightMargin =
      side === "right" &&
      onlyLine.bbox.x0 >= Math.max(rightEdgeThreshold, (mainBand?.x1 || 0) + gutterThreshold * 0.75) &&
      bboxWidth(onlyLine.bbox) <= Math.max(width * 0.24, 110);

    return isShortNote && isStrongRightMargin;
  };

  if (main.length) {
    regions.push({ id: "main", kind: "main", lines: main });
  }

  if (shouldKeepSidebarRegion(rightSidebar, "right")) {
    regions.push({ id: "sidebar-right", kind: "sidebar_right", lines: rightSidebar });
  } else {
    regions[0]?.lines.push(...rightSidebar);
  }

  if (shouldKeepSidebarRegion(leftSidebar, "left")) {
    regions.push({ id: "sidebar-left", kind: "sidebar_left", lines: leftSidebar });
  } else {
    regions[0]?.lines.push(...leftSidebar);
  }

  return regions;
}

function shouldSplitBlockByGap(prev, next, gap, typicalHeight) {
  if (!prev || !next) return true;
  const threshold = Math.max(typicalHeight * 1.9, 18);
  if (gap > threshold) return true;
  return false;
}

function shouldGroupAsEquation(prev, next, gap, typicalHeight) {
  if (!prev || !next) return false;
  const threshold = Math.max(typicalHeight * 1.5, 16);
  if (gap > threshold) return false;

  if (!looksLikeEquationStep(prev.text) || !looksLikeEquationStep(next.text)) {
    return false;
  }

  if (looksLikeCaptionLine(next.text) || looksLikeKeywordBlockStart(next.text) || looksLikeShortExplanatoryProseLine(next.text)) {
    return false;
  }

  const overlapY = bboxOverlapRatioY(prev.bbox, next.bbox);
  if (overlapY <= 0) {
    // stacked lines; ok
    return true;
  }

  // if lines overlap heavily, they are likely same line; still fine
  return true;
}

function shouldSplitExampleBlock(current, next, pageWidth) {
  if (!current?.length || !next?.text || !next?.bbox) {
    return false;
  }

  if (detectKeywordBlockType(current[0]?.text) !== PAGE_BLOCK_TYPES.EXAMPLE) {
    return false;
  }

  if (!looksLikeProseLine(next.text) && !looksLikeShortExplanatoryProseLine(next.text)) {
    return false;
  }

  if (looksLikeMathLine(next.text) || looksLikeKeywordBlockStart(next.text) || looksLikeCaptionLine(next.text)) {
    return false;
  }

  const first = current[0];
  if (!first?.bbox) {
    return false;
  }

  const marginThreshold = Math.max(pageWidth * 0.03, 16);
  const indentThreshold = Math.max(pageWidth * 0.035, 18);
  const nextAtMainMargin = Math.abs((next.bbox.x0 || 0) - (first.bbox.x0 || 0)) <= marginThreshold;
  const bodyShowsExampleContent = current.slice(1).some((entry) => {
    const indent = (entry?.bbox?.x0 || 0) - (first.bbox.x0 || 0);
    return indent >= indentThreshold || looksLikeMathLine(entry.text);
  });

  if (!nextAtMainMargin || !bodyShowsExampleContent) {
    return false;
  }

  const last = current[current.length - 1];
  const lastIndent = (last?.bbox?.x0 || 0) - (first.bbox.x0 || 0);
  return lastIndent >= indentThreshold || looksLikeMathLine(last?.text);
}

function shouldKeepExampleBlockRunning(current, next, gap, typicalHeight, pageWidth) {
  if (!current?.length || !next?.text) {
    return false;
  }

  if (detectKeywordBlockType(current[0]?.text) !== PAGE_BLOCK_TYPES.EXAMPLE) {
    return false;
  }

  if (shouldSplitExampleBlock(current, next, pageWidth)) {
    return false;
  }

  if (looksLikeKeywordBlockStart(next.text) || looksLikeCaptionLine(next.text)) {
    return false;
  }

  if (gap > Math.max(typicalHeight * 2.35, 32)) {
    return false;
  }

  return (
    looksLikeProseLine(next.text) ||
    looksLikeShortExplanatoryProseLine(next.text) ||
    looksLikeMathLine(next.text) ||
    looksLikeEquationStep(next.text)
  );
}

function shouldKeepTheoremBlockRunning(current, next, gap, typicalHeight) {
  if (!current?.length || !next?.text) {
    return false;
  }

  if (detectKeywordBlockType(current[0]?.text) !== PAGE_BLOCK_TYPES.THEOREM) {
    return false;
  }

  if (isStrongTheoremBoundary(next.text)) {
    return false;
  }

  return gap <= Math.max(typicalHeight * 3.2, 48);
}

function shouldStartStandaloneBlock(current, next, pageWidth) {
  if (!current?.length || !next?.text) {
    return false;
  }

  if (looksLikeCaptionLine(next.text) || looksLikeKeywordBlockStart(next.text)) {
    return true;
  }

  if (looksLikeHeadingLine(next.text) && current.some((entry) => looksLikeProseLine(entry.text))) {
    return true;
  }

  const last = current[current.length - 1];
  const indentDelta = Math.abs((last?.bbox?.x0 || 0) - (next.bbox?.x0 || 0));
  const indentSplitThreshold = Math.max(pageWidth * 0.06, 26);
  return indentDelta > indentSplitThreshold && (looksLikeCaptionLine(next.text) || looksLikeHeadingLine(next.text));
}

function buildBlocksFromRegion(region, { pageNumber = 1, pageWidth = 0 } = {}) {
  const ordered = sortLayoutLinesByReadingOrder(region.lines);
  if (!ordered.length) return [];

  const heights = ordered.map((line) => bboxHeight(line.bbox)).filter(Boolean);
  const typicalHeight = median(heights) || 12;

  const blocks = [];
  let current = [];
  let order = 0;

  function flush() {
    const contentLines = current.map((entry) => entry.text).filter(Boolean);
    if (!contentLines.length) {
      current = [];
      return;
    }

    let type = classifyBlock(contentLines);

    // Region-based defaulting: keep sidebars separate and labeled.
    if (region.kind !== "main") {
      if (type === PAGE_BLOCK_TYPES.PARAGRAPH) {
        type = PAGE_BLOCK_TYPES.SIDEBAR_NOTE;
      }
    }

    // Caption placeholders: keep the caption as child for stability.
    if (type === PAGE_BLOCK_TYPES.GRAPH_PLACEHOLDER || type === PAGE_BLOCK_TYPES.TABLE_PLACEHOLDER) {
      const id = makeBlockId("block", pageNumber, order);
      const captionText = contentLines.join("\n").trim();
      const bbox = buildBBoxFromLines(current);

      const placeholder = createPageBlock({
        id,
        pageNumber,
        type,
        order,
        bbox,
        originalContent: captionText,
        normalizedContent: captionText,
        confidence: 0.7,
        children: [
          createPageBlock({
            id: `${id}-caption`,
            pageNumber,
            type: PAGE_BLOCK_TYPES.FIGURE_CAPTION,
            order: 0,
            bbox,
            originalContent: captionText,
            normalizedContent: captionText,
            confidence: 0.72,
          }),
        ],
      });

      placeholder.debugRegionKind = region.kind;
      placeholder.debugLineIds = current.map((entry) => entry.debugLineId).filter(Boolean);
      blocks.push(placeholder);
      order += 1;
      current = [];
      return;
    }

    const joined = contentLines.join("\n").trim();
    const bbox = buildBBoxFromLines(current);
    const id = makeBlockId("block", pageNumber, order);

    const block = createPageBlock({
      id,
      pageNumber,
      type,
      order,
      bbox,
      originalContent: joined,
      normalizedContent: joined,
      confidence: type === PAGE_BLOCK_TYPES.EQUATION_GROUP ? 0.72 : 0.65,
    });

    if (type === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
      block.children = makeEquationChildren(pageNumber, id, contentLines);
    }

    if (type === PAGE_BLOCK_TYPES.THEOREM) {
      const theoremData = buildTheoremChildren(current, { pageNumber, parentId: id });
      block.children = theoremData.children;
      block.title = theoremData.title || contentLines[0] || "";
      block.content = joined;
      block.text = joined;
      block.originalText = joined;
      if (process.env.NODE_ENV !== "production") {
        console.log("THEOREM BLOCK CREATED", block);
      }
    }

    block.debugRegionKind = region.kind;
    block.debugLineIds = current.map((entry) => entry.debugLineId).filter(Boolean);
    blocks.push(block);
    order += 1;
    current = [];
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const line = ordered[index];
    if (!line?.text?.trim()) {
      flush();
      continue;
    }

    if (!current.length) {
      current.push(line);
      continue;
    }

    const prev = current[current.length - 1];
    const gap = bboxYMid(prev.bbox) - bboxYMid(line.bbox);

    if (shouldSplitExampleBlock(current, line, pageWidth)) {
      flush();
      current.push(line);
      continue;
    }

    if (shouldKeepTheoremBlockRunning(current, line, gap, typicalHeight)) {
      current.push(line);
      continue;
    }

    if (shouldKeepExampleBlockRunning(current, line, gap, typicalHeight, pageWidth)) {
      current.push(line);
      continue;
    }

    if (shouldStartStandaloneBlock(current, line, pageWidth)) {
      flush();
      current.push(line);
      continue;
    }

    // Equation grouping: keep consecutive equation steps together.
    if (shouldGroupAsEquation(prev, line, gap, typicalHeight)) {
      current.push(line);
      continue;
    }

    // Stop equation group before absorbing prose.
    const currentIsEquationRun = current.length >= 1 && current.every((entry) => looksLikeEquationStep(entry.text));
    if (currentIsEquationRun && (looksLikeProseLine(line.text) || looksLikeShortExplanatoryProseLine(line.text))) {
      flush();
      current.push(line);
      continue;
    }

    // Visual block splitting based on vertical gaps.
    if (shouldSplitBlockByGap(prev, line, gap, typicalHeight)) {
      flush();
      current.push(line);
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks;
}

function blockTop(block) {
  return block?.bbox?.y1 || 0;
}

function blockLeft(block) {
  return block?.bbox?.x0 || 0;
}

function sortBlocksForReadingOrder(blocks = []) {
  const heights = blocks.map((block) => bboxHeight(block?.bbox)).filter(Boolean);
  const sameBandThreshold = Math.max((median(heights) || 14) * 1.6, 26);

  return [...blocks].sort((left, right) => {
    const dy = blockTop(right) - blockTop(left);
    if (Math.abs(dy) > sameBandThreshold) {
      return dy;
    }

    if (left.debugRegionKind === "main" && right.debugRegionKind !== "main") {
      return -1;
    }

    if (right.debugRegionKind === "main" && left.debugRegionKind !== "main") {
      return 1;
    }

    const dx = blockLeft(left) - blockLeft(right);
    if (Math.abs(dx) > 1) {
      return dx;
    }

    return (left.order || 0) - (right.order || 0);
  });
}

function stripDebugFields(block) {
  if (!block) {
    return block;
  }

  const { debugRegionKind, debugLineIds, ...safe } = block;
  return {
    ...safe,
    children: Array.isArray(block.children) ? block.children.map((child) => stripDebugFields(child)) : block.children,
  };
}

function describeDebugLine(line, regionKind) {
  return {
    id: line.debugLineId,
    text: line.text,
    bbox: line.bbox,
    regionKind,
  };
}

function describeDebugBlock(block) {
  return {
    id: block.id,
    order: block.order,
    type: block.type,
    bbox: block.bbox,
    confidence: block.confidence,
    originalContent: block.originalContent,
    regionKind: block.debugRegionKind || "main",
    sourceLineIds: Array.isArray(block.debugLineIds) ? block.debugLineIds : [],
    children:
      block.children?.map((child) => ({
        id: child.id,
        order: child.order,
        type: child.type,
        originalContent: child.originalContent,
      })) || [],
  };
}

function segmentPageInternal({ pageNumber = 1, lines = [], pageWidth = 0, pageHeight = 0 } = {}) {
  const safeLines = (lines || []).map((line, index) => {
    if (typeof line === "string") {
      const text = normalizeLine(line);
      return { text, bbox: undefined, debugLineId: `p${pageNumber}-l${String(index + 1).padStart(3, "0")}` };
    }

    const text = normalizeLine(line?.text);
    return {
      text,
      bbox: normalizeBBox(line?.bbox),
      debugLineId: `p${pageNumber}-l${String(index + 1).padStart(3, "0")}`,
    };
  });

  const isLayout = safeLines.some((entry) => entry?.bbox);

  if (!isLayout) {
    const blocks = [];
    let current = [];
    let order = 0;

    function flush() {
      const contentLines = current.map((entry) => entry.text).filter(Boolean);
      if (!contentLines.length) {
        current = [];
        return;
      }

      const type = classifyBlock(contentLines);
      const joined = contentLines.join("\n").trim();
      const id = makeBlockId("block", pageNumber, order);
      const block = createPageBlock({
        id,
        pageNumber,
        type,
        order,
        originalContent: joined,
        normalizedContent: joined,
        confidence: type === PAGE_BLOCK_TYPES.EQUATION_GROUP ? 0.7 : 0.62,
      });

      if (type === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
        block.children = makeEquationChildren(pageNumber, id, contentLines);
      }

      if (type === PAGE_BLOCK_TYPES.THEOREM) {
        const theoremData = buildTheoremChildren(current, { pageNumber, parentId: id });
        block.children = theoremData.children;
        block.title = theoremData.title || joined;
        block.content = joined;
        block.text = joined;
        block.originalText = joined;
        if (process.env.NODE_ENV !== "production") {
          console.log("THEOREM BLOCK CREATED", block);
        }
      }

      block.debugRegionKind = "main";
      block.debugLineIds = current.map((entry) => entry.debugLineId).filter(Boolean);
      blocks.push(block);
      order += 1;
      current = [];
    }

    for (const entry of safeLines) {
      if (!entry.text.trim()) {
        flush();
        continue;
      }

      const currentIsEquationRun =
        current.length >= 1 &&
        current.every((line) => looksLikeEquationStep(line.text));

      if (currentIsEquationRun && looksLikeProseLine(entry.text)) {
        flush();
      }

      current.push(entry);
    }

    flush();

    return {
      blocks: blocks.map((block) => stripDebugFields(block)),
      debug: {
        pageNumber,
        pageWidth,
        pageHeight,
        isLayout: false,
        orderedLines: safeLines.filter((line) => line.text).map((line) => describeDebugLine(line, "main")),
        regions: [
          {
            id: "main",
            kind: "main",
            bbox: undefined,
            lineIds: safeLines.filter((line) => line.text).map((line) => line.debugLineId),
          },
        ],
        blocks: blocks.map((block, index) => describeDebugBlock({ ...block, order: index })),
      },
    };
  }

  const orderedLines = sortLayoutLinesByReadingOrder(safeLines);
  const regions = detectRegionsFromLayout(orderedLines, { pageWidth, pageHeight });
  const regionBlocks = regions.flatMap((region) => buildBlocksFromRegion(region, { pageNumber, pageWidth, pageHeight }));
  const orderedBlocks = sortBlocksForReadingOrder(regionBlocks).map((block, index) => ({
    ...block,
    order: index,
    id: block.id || makeBlockId("block", pageNumber, index),
  }));

  return {
    blocks: orderedBlocks.map((block) => stripDebugFields(block)),
    debug: {
      pageNumber,
      pageWidth,
      pageHeight,
      isLayout: true,
      orderedLines: orderedLines.map((line) => {
        const region = regions.find((entry) => entry.lines.some((regionLine) => regionLine.debugLineId === line.debugLineId));
        return describeDebugLine(line, region?.kind || "main");
      }),
      regions: regions.map((region) => ({
        id: region.id,
        kind: region.kind,
        bbox: buildBBoxFromLines(region.lines),
        lineIds: region.lines.map((line) => line.debugLineId),
      })),
      blocks: orderedBlocks.map((block) => describeDebugBlock(block)),
    },
  };
}

/**
 * Segment a page into semantic-ish blocks.
 *
 * Input can be plain lines (`string[]`) or layout lines of shape:
 * `{ text: string, bbox?: {x0,y0,x1,y1,space?} }`.
 *
 * @param {object} input
 * @param {number} input.pageNumber
 * @param {Array<string|{text:string,bbox?:any}>} input.lines
 * @param {number} [input.pageWidth]
 * @param {number} [input.pageHeight]
 * @returns {import("./pageBlocks.js").PageBlock[]}
 */
export function segmentPageIntoBlocks({ pageNumber = 1, lines = [], pageWidth = 0, pageHeight = 0 } = {}) {
  return segmentPageInternal({ pageNumber, lines, pageWidth, pageHeight }).blocks;
}

export function inspectPageSegmentation({ pageNumber = 1, lines = [], pageWidth = 0, pageHeight = 0 } = {}) {
  return segmentPageInternal({ pageNumber, lines, pageWidth, pageHeight });
}

/**
 * Convenience wrapper for stored page text.
 * @param {string} pageText
 * @param {number} pageNumber
 */
export function segmentPlainTextPage(pageText, pageNumber = 1) {
  const lines = String(pageText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line));
  return segmentPageIntoBlocks({ pageNumber, lines });
}
