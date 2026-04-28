export const PAGE_BREAK_MARKER = "[[BRAILLEVISION_PAGE_BREAK]]";

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function splitStoredTextForExport(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  if (!normalized.includes(PAGE_BREAK_MARKER)) {
    return [normalized];
  }

  return normalized
    .split(PAGE_BREAK_MARKER)
    .map((page) => normalizeText(page))
    .filter(Boolean);
}
