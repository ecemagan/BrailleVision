import { PAGE_BREAK_MARKER } from "@/lib/documentReview";

const SOURCE_LABELS = {
  manual: "Manual / TXT",
  pdf: "PDF",
  image: "Image OCR",
  camera: "Camera OCR",
  graph: "Graph Reader",
  "word-addin": "Word Add-in",
};

const MODE_LABELS = {
  text: "Text",
  nemeth: "Nemeth",
  ocr: "OCR",
  "graph-description": "Graph Description",
};

export function getSourceLabel(sourceType) {
  return SOURCE_LABELS[sourceType] || SOURCE_LABELS.manual;
}

export function getModeLabel(conversionMode) {
  return MODE_LABELS[conversionMode] || MODE_LABELS.text;
}

export function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-ğüşöçıİ]/gi, "")
    .slice(0, 24);
}

export function normalizeTags(tags = []) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 10);
}

export function buildSearchableDocumentText(document) {
  return [
    document.file_name,
    String(document.original_text || "").split(PAGE_BREAK_MARKER).join(" "),
    String(document.braille_text || "").split(PAGE_BREAK_MARKER).join(" "),
    document.source_type,
    document.conversion_mode,
    ...(document.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function saveDocumentRecord({
  supabase,
  userId,
  fileName,
  originalText,
  brailleText,
  sourceType = "manual",
  conversionMode = "text",
  tags = [],
}) {
  if (!supabase || !userId) {
    throw new Error("A signed-in user is required to save document history.");
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      file_name: fileName,
      original_text: originalText,
      braille_text: brailleText,
      source_type: sourceType,
      conversion_mode: conversionMode,
      tags: normalizeTags(tags),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
