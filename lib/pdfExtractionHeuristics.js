function tokenizeText(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function getSingleCharRatio(tokens = []) {
  return tokens.length
    ? tokens.filter((token) => token.length === 1).length / tokens.length
    : 0;
}

function countMatches(value, pattern) {
  return (String(value || "").match(pattern) || []).length;
}

function getRawItemText(items = []) {
  return items.map((item) => String(item?.str || "")).join(" ");
}

export function looksMathHeavyPdfPage(text, items = []) {
  const normalized = String(text || "").trim();
  const rawItemText = getRawItemText(items);

  return (
    /[=≠≤≥∞∫√±×÷→←↔⇔∈∉]/u.test(rawItemText) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt)\b/iu.test(rawItemText) ||
    /\b[fgh]\(x\)\b/u.test(rawItemText) ||
    /[=≠≤≥∞∫√±×÷→←↔⇔∈∉]/u.test(normalized) ||
    /\b(?:lim|sin|cos|tan|log|ln|sqrt)\b/iu.test(normalized)
  );
}

export function scorePdfMathTextQuality(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    return -100;
  }

  const tokens = tokenizeText(normalized);
  const singleCharRatio = getSingleCharRatio(tokens);
  let score = 0;

  if (/\blim\s+[A-Za-z]→[+\-−]?(?:\d+|[A-Za-z0-9∞]+)/u.test(normalized)) {
    score += 10;
  }

  if (/\b[fgh]\(x\)\b/u.test(normalized)) {
    score += 6;
  }

  if (/[=≠≤≥]/u.test(normalized)) {
    score += 4;
  }

  if (/(\d+\.\s+[A-Za-z][^:\n]{1,60}:)/u.test(normalized)) {
    score += 4;
  }

  if ((normalized.match(/\(/g) || []).length === (normalized.match(/\)/g) || []).length) {
    score += 2;
  }

  if ((normalized.match(/\blim\b/giu) || []).length > 1 && !/\n/.test(normalized)) {
    score -= 8;
  }

  if (((normalized.match(/\b[A-Za-z][A-Za-z\s-]{1,40}Rule:/gu) || []).length > 1) && !/\n/.test(normalized)) {
    score -= 14;
  }

  if (((normalized.match(/\b\d+\.\s+[A-Za-z][^:\n]{1,40}:/gu) || []).length > 1) && !/\n/.test(normalized)) {
    score -= 10;
  }

  if (/(?:\b[A-Za-z]\b\s+){4,}/u.test(normalized)) {
    score -= 10;
  }

  if (/\b(?:x\s+){3,}/u.test(normalized)) {
    score -= 10;
  }

  if (/\b([A-Za-z])\s*S\s*c\b/u.test(normalized) || /\bxSc\b/u.test(normalized)) {
    score -= 12;
  }

  if (/Sum Rule:\s+Difference Rule:|Difference Rule:\s+Constant Multiple Rule:/u.test(normalized)) {
    score -= 8;
  }

  if (/\b(?:lim\s+){2,}lim\b/iu.test(normalized)) {
    score -= 12;
  }

  if (singleCharRatio >= 0.35 && tokens.length >= 8) {
    score -= 8;
  }

  return score;
}

export function hasSevereMathOcrCorruption(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    return false;
  }

  const tokens = tokenizeText(normalized);
  const singleCharRatio = getSingleCharRatio(tokens);
  const ruleHeadingCount = countMatches(normalized, /\b\d+\.\s+[A-Za-z][^:\n]{1,40}:/gu);
  const collapsedRuleHeadingCount = countMatches(normalized, /\b[A-Za-z][A-Za-z\s-]{1,40}Rule:/gu);
  const repeatedLimitCount = countMatches(normalized, /\blim\b/giu);
  const repeatedSingleLetterRuns = /(?:\b[A-Za-z#]\b\s+){6,}\b[A-Za-z#]\b/u.test(normalized);
  const hasKnownGarbagePattern = [
    /\b([A-Za-z])\s*S\s*c\b/u,
    /\bxSc\b/u,
    /\b(?:lim\s+){2,}lim\b/iu,
    /\b(?:x\s+){3,}x\b/u,
    /\b(?:S\s+){3,}S\b/u,
    /\b(?:c\s+){3,}c\b/u,
    /Sum Rule:\s+Difference Rule:/u,
    /Difference Rule:\s+Constant Multiple Rule:/u,
  ].some((pattern) => pattern.test(normalized));

  if (hasKnownGarbagePattern) {
    return true;
  }

  if (!/\n/.test(normalized) && collapsedRuleHeadingCount >= 3 && repeatedLimitCount >= 3) {
    return true;
  }

  if (singleCharRatio >= 0.48 && tokens.length >= 18 && repeatedSingleLetterRuns) {
    return true;
  }

  if (scorePdfMathTextQuality(normalized) <= -24 && (ruleHeadingCount >= 2 || repeatedLimitCount >= 3)) {
    return true;
  }

  return false;
}

export function selectBestPdfMathCandidate(textLayerText, ocrText) {
  const normalizedTextLayer = String(textLayerText || "").trim();
  const normalizedOcr = String(ocrText || "").trim();

  if (!normalizedOcr) {
    return normalizedTextLayer;
  }

  if (!normalizedTextLayer) {
    return normalizedOcr;
  }

  const textLayerScore = scorePdfMathTextQuality(normalizedTextLayer);
  const ocrScore = scorePdfMathTextQuality(normalizedOcr);
  const textLayerLooksBroken = hasSevereMathOcrCorruption(normalizedTextLayer);
  const ocrLooksBroken = hasSevereMathOcrCorruption(normalizedOcr);

  if (ocrLooksBroken && !textLayerLooksBroken) {
    return normalizedTextLayer;
  }

  if (textLayerLooksBroken && !ocrLooksBroken) {
    return normalizedOcr;
  }

  if (ocrScore >= textLayerScore + 4) {
    return normalizedOcr;
  }

  return normalizedTextLayer;
}

export function shouldPreferOcrForPdfTextLayer(text, items = []) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    return true;
  }

  const tokens = tokenizeText(normalized);
  const singleCharRatio = getSingleCharRatio(tokens);
  const suspiciousPatterns = [
    /\bxSc\b/u,
    /\blim(?:\s+lim)+\b/iu,
    /\bS\s+c\b/u,
    /\(\s*x\s*\)\s+\w+\s+[A-Z]\b/u,
    /\b(?:x\s+){3,}/u,
  ];
  const itemYs = [...new Set(items.map((item) => Math.round(Number(item?.transform?.[5] || 0))))];
  const looksMathHeavy = looksMathHeavyPdfPage(normalized, items);

  if (suspiciousPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (looksMathHeavy && singleCharRatio >= 0.35 && tokens.length >= 8) {
    return true;
  }

  if (looksMathHeavy && itemYs.length >= 3) {
    return true;
  }

  return false;
}
