function normalizeArrow(value) {
  return String(value || "").replace(/->/g, "→");
}

export function formatLimitExpressionForDisplay(line) {
  const normalized = normalizeArrow(String(line || ""));
  const match = normalized.match(/^(.*?\blim)\s+([A-Za-z0-9]+→[A-Za-z0-9+\-−∞]+)\s+(.+)$/u);

  if (!match) {
    return null;
  }

  const [, prefixWithLim, subscript, remainder] = match;
  const limIndex = prefixWithLim.lastIndexOf("lim");

  if (limIndex === -1) {
    return null;
  }

  const indent = " ".repeat(limIndex);

  return [
    `${prefixWithLim} ${remainder}`.trimEnd(),
    `${indent}${subscript}`,
  ];
}

export function formatOriginalLineForDisplay(line) {
  return formatLimitExpressionForDisplay(line) || [String(line || "")];
}
