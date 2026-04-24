import { repairCorruptedTurkishLine } from "./turkishTextNormalization.js";

function normalizeItemText(value) {
  return String(value || "").replace(/\s+/g, " ");
}

function normalizeMathText(value) {
  return String(value || "")
    .replace(/\bxSc\b/g, "x→c")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemPosition(item) {
  const transform = Array.isArray(item?.transform) ? item.transform : [];

  return {
    x: Number(transform[4] || 0),
    y: Number(transform[5] || 0),
    width: Number(item?.width || 0),
    height: Number(item?.height || 0),
  };
}

function sortByReadingOrder(left, right) {
  if (Math.abs(right.y - left.y) > 0.5) {
    return right.y - left.y;
  }

  return left.x - right.x;
}

function buildLineFromItems(items) {
  const orderedItems = [...items].sort((left, right) => left.x - right.x);
  let line = "";
  let previousRight = null;

  for (const item of orderedItems) {
    const rawText = normalizeItemText(item.str);

    if (!rawText) {
      continue;
    }

    if (/^\s+$/.test(rawText)) {
      if (line && !line.endsWith(" ")) {
        line += " ";
      }
      previousRight = item.x + item.width;
      continue;
    }

    const compactText = rawText.trim();

    if (!compactText) {
      previousRight = item.x + item.width;
      continue;
    }

    if (!line) {
      line = compactText;
      previousRight = item.x + item.width;
      continue;
    }

    const gap = previousRight === null ? 0 : item.x - previousRight;
    const needsSpace =
      gap > Math.max(item.height * 0.2, 2.4) &&
      !line.endsWith(" ") &&
      !/^[,.;:!?)}\]»]/.test(compactText) &&
      !/[({\[«]$/.test(line);

    if (needsSpace) {
      line += " ";
    }

    line += compactText;
    previousRight = item.x + item.width;
  }

  return normalizeMathText(repairCorruptedTurkishLine(line.trim()).text);
}

function getLineBounds(line) {
  const xs = line.items.map((item) => item.x);
  const rights = line.items.map((item) => item.x + item.width);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...rights),
  };
}

function looksLikeMathText(text) {
  const value = String(text || "").trim();

  if (!value) {
    return false;
  }

  return (
    /[=≠≤≥∞∫√→←↔⇔∈∉^/_]/u.test(value) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt)\b/iu.test(value) ||
    /[A-Za-z]\([A-Za-z0-9]\)/u.test(value) ||
    /^x→c$/u.test(value)
  );
}

function shouldMergeMathLines(previousLine, nextLine) {
  if (!previousLine || !nextLine) {
    return false;
  }

  const verticalGap = previousLine.y - nextLine.y;
  const maxGap = Math.max(previousLine.height, nextLine.height) * 2.2;

  if (verticalGap <= 0 || verticalGap > maxGap) {
    return false;
  }

  const previousBounds = getLineBounds(previousLine);
  const nextBounds = getLineBounds(nextLine);
  const overlap = Math.min(previousBounds.maxX, nextBounds.maxX) - Math.max(previousBounds.minX, nextBounds.minX);
  const minWidth = Math.min(previousBounds.maxX - previousBounds.minX, nextBounds.maxX - nextBounds.minX);

  if (overlap <= 0 || overlap < minWidth * 0.18) {
    return false;
  }

  const previousWidth = previousBounds.maxX - previousBounds.minX;
  const nextWidth = nextBounds.maxX - nextBounds.minX;
  const previousIsMinorFragment = previousWidth <= 150 || previousLine.text.length <= 18 || !/\s/.test(previousLine.text);
  const nextIsMinorFragment = nextWidth <= 150 || nextLine.text.length <= 18 || !/\s/.test(nextLine.text);

  if (!previousIsMinorFragment && !nextIsMinorFragment) {
    return false;
  }

  return looksLikeMathText(previousLine.text) || looksLikeMathText(nextLine.text);
}

function joinClusterTexts(items) {
  return normalizeMathText(
    items
      .sort((left, right) => left.x - right.x)
      .map((item) => item.str)
      .join(" "),
  );
}

function buildMathBlockText(lines) {
  if (!lines.length) {
    return "";
  }

  const baselineLine =
    lines.find((line) => /=|≠|≤|≥/.test(line.text)) ||
    [...lines].sort((left, right) => {
      const leftBounds = getLineBounds(left);
      const rightBounds = getLineBounds(right);
      return rightBounds.maxX - rightBounds.minX - (leftBounds.maxX - leftBounds.minX);
    })[0];

  const allItems = lines.flatMap((line) =>
    line.items.map((item) => ({
      ...item,
      role:
        item.y > baselineLine.y + Math.max(item.height * 0.35, 2)
          ? "upper"
          : item.y < baselineLine.y - Math.max(item.height * 0.35, 2)
            ? "lower"
            : "base",
    })),
  );

  const clusters = [];

  allItems
    .sort((left, right) => left.x - right.x)
    .forEach((item) => {
      const lastCluster = clusters[clusters.length - 1];
      const itemRight = item.x + item.width;

      if (!lastCluster || item.x > lastCluster.maxX + Math.max(item.height * 0.6, 10)) {
        clusters.push({
          minX: item.x,
          maxX: itemRight,
          items: [item],
        });
        return;
      }

      lastCluster.items.push(item);
      lastCluster.maxX = Math.max(lastCluster.maxX, itemRight);
    });

  const parts = clusters
    .map((cluster) => {
      const baseItems = cluster.items.filter((item) => item.role === "base");
      const upperItems = cluster.items.filter((item) => item.role === "upper");
      const lowerItems = cluster.items.filter((item) => item.role === "lower");
      const baseText = joinClusterTexts(baseItems);
      const upperText = joinClusterTexts(upperItems);
      const lowerText = joinClusterTexts(lowerItems);

      if (baseText.toLowerCase() === "lim" && lowerText) {
        return `lim ${lowerText}`;
      }

      if (upperText && lowerText && !baseText) {
        return `${upperText}/${lowerText}`;
      }

      if (upperText && lowerText && baseText) {
        return `${baseText} ${upperText}/${lowerText}`;
      }

      return [baseText, upperText, lowerText].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  return normalizeMathText(parts.join(" ").replace(/\s+,/g, ",").trim());
}

function buildOrderedLines(items = []) {
  const positionedItems = items
    .filter((item) => item && typeof item === "object" && "str" in item)
    .map((item) => ({
      ...item,
      ...getItemPosition(item),
      str: normalizeItemText(item.str),
    }))
    .filter((item) => item.str.length > 0)
    .sort(sortByReadingOrder);

  if (!positionedItems.length) {
    return [];
  }

  const lines = [];

  for (const item of positionedItems) {
    const targetLine = lines.find((line) => Math.abs(line.y - item.y) <= Math.max(item.height * 0.45, 3));

    if (targetLine) {
      const previousCount = targetLine.items.length;
      targetLine.items.push(item);
      targetLine.y = (targetLine.y * previousCount + item.y) / (previousCount + 1);
      targetLine.height = Math.max(targetLine.height, item.height);
      continue;
    }

    lines.push({
      y: item.y,
      height: item.height,
      items: [item],
    });
  }

  return lines
    .map((line) => ({
      ...line,
      text: buildLineFromItems(line.items),
      x: Math.min(...line.items.map((item) => item.x)),
    }))
    .filter((line) => line.text)
    .sort((left, right) => {
      if (Math.abs(right.y - left.y) > 0.5) {
        return right.y - left.y;
      }

      return left.x - right.x;
    });
}

function mergeLineBBoxes(lines) {
  const items = (lines || []).flatMap((line) => line.items || []);
  if (!items.length) {
    return undefined;
  }

  const x0 = Math.min(...items.map((item) => item.x));
  const x1 = Math.max(...items.map((item) => item.x + item.width));
  const y0 = Math.min(...items.map((item) => item.y - item.height));
  const y1 = Math.max(...items.map((item) => item.y + item.height));

  return { x0, y0, x1, y1, space: "pdf" };
}

export function reconstructPdfPageLines(items = []) {
  const orderedLines = buildOrderedLines(items);

  if (!orderedLines.length) {
    return [];
  }

  const pageLines = [];
  let previousY = null;
  let previousHeight = null;
  let index = 0;

  while (index < orderedLines.length) {
    const line = orderedLines[index];

    if (previousY !== null && previousHeight !== null) {
      const verticalGap = previousY - line.y;
      const blankLineThreshold = Math.max(previousHeight * 2.1, 28);

      if (verticalGap > blankLineThreshold) {
        pageLines.push({ text: "", kind: "empty" });
      }
    }

    const mathGroup = [line];
    let lookahead = index + 1;

    while (lookahead < orderedLines.length && shouldMergeMathLines(mathGroup[mathGroup.length - 1], orderedLines[lookahead])) {
      mathGroup.push(orderedLines[lookahead]);
      lookahead += 1;
    }

    if (mathGroup.length > 1) {
      const mergedText = buildMathBlockText(mathGroup);
      pageLines.push({
        text: mergedText,
        kind: looksLikeMathText(mergedText) ? "math" : "text",
        bbox: mergeLineBBoxes(mathGroup),
      });

      const lastLine = mathGroup[mathGroup.length - 1];
      previousY = lastLine.y;
      previousHeight = lastLine.height || previousHeight;
      index = lookahead;
      continue;
    }

    pageLines.push({
      text: line.text,
      kind: looksLikeMathText(line.text) ? "math" : "text",
      bbox: mergeLineBBoxes([line]),
    });

    previousY = line.y;
    previousHeight = line.height || previousHeight;
    index += 1;
  }

  return pageLines;
}

export function reconstructPdfPageText(items = []) {
  return reconstructPdfPageLines(items)
    .map((line) => line.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getLastNonEmptyLineIndex(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (String(lines[index] || "").trim()) {
      return index;
    }
  }

  return -1;
}

function getFirstNonEmptyLineIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (String(lines[index] || "").trim()) {
      return index;
    }
  }

  return -1;
}

function normalizePageText(value) {
  return String(value || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function repairPdfPageBreaks(pageTexts = []) {
  const repairedPages = pageTexts.map((pageText) => String(pageText || ""));

  for (let index = 0; index < repairedPages.length - 1; index += 1) {
    const currentLines = repairedPages[index].split("\n");
    const nextLines = repairedPages[index + 1].split("\n");
    const currentLineIndex = getLastNonEmptyLineIndex(currentLines);
    const nextLineIndex = getFirstNonEmptyLineIndex(nextLines);

    if (currentLineIndex === -1 || nextLineIndex === -1) {
      continue;
    }

    const currentLine = String(currentLines[currentLineIndex] || "").trimEnd();
    const nextLine = String(nextLines[nextLineIndex] || "").trimStart();
    const currentEndsWithBrokenWord = /[\p{L}]{2,}-$/u.test(currentLine);
    const nextStartsWithWord = /^([\p{L}]+)/u.exec(nextLine);

    if (!currentEndsWithBrokenWord || !nextStartsWithWord) {
      continue;
    }

    const [, continuedWordPart] = nextStartsWithWord;
    currentLines[currentLineIndex] = currentLine.replace(/-$/u, "") + continuedWordPart;
    nextLines[nextLineIndex] = nextLine.slice(continuedWordPart.length).trimStart();

    repairedPages[index] = normalizePageText(currentLines.join("\n"));
    repairedPages[index + 1] = normalizePageText(nextLines.join("\n"));
  }

  return repairedPages;
}
