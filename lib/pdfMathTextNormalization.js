function normalizePdfMathSymbols(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/ƒ/gu, "f")
    .replace(/∕/gu, "/")
    .replace(/[–—]/gu, "−")
    .replace(/\b([A-Za-z])\s*S\s*c\b/gu, "$1→c")
    .replace(/\b([A-Za-z])Sc\b/gu, "$1→c")
    .replace(/\b([A-Za-z])\s*->\s*([^\s]+)/gu, "$1→$2")
    .replace(/\s*→\s*/gu, "→")
    .replace(/\s*≠\s*/gu, " ≠ ")
    .replace(/\s*≤\s*/gu, " ≤ ")
    .replace(/\s*≥\s*/gu, " ≥ ")
    .replace(/\s*=\s*/gu, " = ")
    .replace(/\s*\/\s*/gu, "/")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeStandaloneLimitSubscriptLine(line) {
  const normalized = normalizePdfMathSymbols(line).trim();

  return /^[A-Za-z]\s*→\s*[+\-−]?(?:\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9]*|∞)$/.test(normalized);
}

function looksLikeMathContinuationLine(line) {
  const normalized = normalizePdfMathSymbols(line).trim();

  if (!normalized) {
    return false;
  }

  return (
    /[=≠≤≥∞∫√→^/_()]/u.test(normalized) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt)\b/iu.test(normalized) ||
    /\b[fgh]\(x\)\b/u.test(normalized)
  );
}

function looksLikeRuleHeading(line) {
  const normalized = String(line || "").trim();

  return /^(\d+\.\s+)?[A-Za-z][A-Za-z\s-]{1,80}:\s*$/u.test(normalized);
}

function joinMathSegments(...segments) {
  return normalizePdfMathSymbols(segments.filter(Boolean).join(" "));
}

export function normalizePdfMathOcrText(text) {
  const normalized = normalizePdfMathSymbols(text);

  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split("\n")
    .map((line) => normalizePdfMathSymbols(line))
    .filter((line, index, allLines) => line || (index > 0 && allLines[index - 1]));

  const mergedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];

    if (!current) {
      if (mergedLines[mergedLines.length - 1] !== "") {
        mergedLines.push("");
      }
      continue;
    }

    const next = lines[index + 1] || "";
    const afterNext = lines[index + 2] || "";

    if (looksLikeRuleHeading(current) && looksLikeMathContinuationLine(next)) {
      if (/\blim\b/u.test(next) && looksLikeStandaloneLimitSubscriptLine(afterNext)) {
        const formulaTail = lines[index + 3] || "";

        if (looksLikeMathContinuationLine(formulaTail)) {
          mergedLines.push(joinMathSegments(current, next, afterNext, formulaTail));
          index += 3;
          continue;
        }

        mergedLines.push(joinMathSegments(current, next, afterNext));
        index += 2;
        continue;
      }

      mergedLines.push(joinMathSegments(current, next));
      index += 1;
      continue;
    }

    if (/\blim\b/u.test(current) && looksLikeStandaloneLimitSubscriptLine(next)) {
      if (looksLikeMathContinuationLine(afterNext)) {
        const formulaTail = lines[index + 3] || "";

        if (looksLikeMathContinuationLine(formulaTail)) {
          mergedLines.push(joinMathSegments(current, next, afterNext, formulaTail));
          index += 3;
          continue;
        }

        mergedLines.push(joinMathSegments(current, next, afterNext));
        index += 2;
        continue;
      }

      mergedLines.push(joinMathSegments(current, next));
      index += 1;
      continue;
    }

    if (/\blim\s+[A-Za-z]→[+\-−]?(?:\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9]*|∞)\b/u.test(current) && looksLikeMathContinuationLine(next)) {
      mergedLines.push(joinMathSegments(current, next));
      index += 1;
      continue;
    }

    mergedLines.push(current);
  }

  return mergedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
