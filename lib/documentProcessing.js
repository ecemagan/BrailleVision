import { analyzeBrailleReadability } from "@/lib/brailleAssistant";
import { detectLanguage, detectLanguageByBlocks } from "@/lib/languageDetection";
import { paginateTextByStructure, formatTextByStructure } from "@/lib/structureDetection";
import { normalizeTurkishExtractedText } from "@/lib/turkishTextNormalization";

function aggregateMode(modes = []) {
  const uniqueModes = [...new Set(modes.filter(Boolean))];

  if (uniqueModes.length <= 1) {
    return uniqueModes[0] || "plain_prose";
  }

  if (uniqueModes.every((mode) => mode === "plain_prose" || mode === "paragraph_preserved")) {
    return "paragraph_preserved";
  }

  return "mixed_structured";
}

function aggregateLanguage(languages = []) {
  const unique = [...new Set(languages.filter(Boolean))];

  if (unique.length <= 1) {
    return unique[0] || "unknown";
  }

  if (unique.includes("tr") && unique.includes("en")) {
    return "mixed";
  }

  return unique[0] || "unknown";
}

function normalizeAndStructure(text, { sourceType = "manual", conversionMode = "text", useImprovedText = true } = {}) {
  const normalizedCharacters = normalizeTurkishExtractedText(text, {
    sourceType,
  });

  const structured = formatTextByStructure(normalizedCharacters, { sourceType });
  const readability = analyzeBrailleReadability(structured.text, sourceType, conversionMode);
  const finalText = useImprovedText ? readability.improvedText : structured.text;
  const finalStructure = formatTextByStructure(finalText, { sourceType });
  const blockLanguage = detectLanguageByBlocks(finalStructure.blocks);

  return {
    text: finalStructure.text,
    structureMode: finalStructure.mode,
    blocks: finalStructure.blocks,
    readability,
    language: blockLanguage.language === "unknown" ? detectLanguage(finalStructure.text).language : blockLanguage.language,
    languageConfidence:
      blockLanguage.language === "unknown"
        ? detectLanguage(finalStructure.text).confidence
        : blockLanguage.confidence,
    languageBlocks: blockLanguage.blocks,
  };
}

export function processDocumentInput({
  originalText = "",
  sourceType = "manual",
  pageTexts = [],
  conversionMode = "text",
  useImprovedText = true,
} = {}) {
  if (pageTexts.length > 0) {
    const processedPages = pageTexts
      .map((pageText) =>
        normalizeAndStructure(pageText, {
          sourceType,
          conversionMode,
          useImprovedText,
        }),
      )
      .filter((page) => page.text);

    const combinedText = processedPages.map((page) => page.text).join("\n\n").trim();
    const overallLanguage = detectLanguage(combinedText);

    return {
      text: combinedText,
      pages: processedPages.map((page, index) => ({
        pageNumber: index + 1,
        originalText: page.text,
        structureMode: page.structureMode,
        language: page.language,
        languageConfidence: page.languageConfidence,
      })),
      structureMode: aggregateMode(processedPages.map((page) => page.structureMode)),
      language: overallLanguage.language === "unknown" ? aggregateLanguage(processedPages.map((page) => page.language)) : overallLanguage.language,
      languageConfidence: overallLanguage.confidence,
      readability: analyzeBrailleReadability(combinedText, sourceType, conversionMode),
    };
  }

  const processed = normalizeAndStructure(originalText, {
    sourceType,
    conversionMode,
    useImprovedText,
  });

  return {
    text: processed.text,
    pages: paginateTextByStructure(processed.text, {
      mode: processed.structureMode,
    }).map((pageText, index) => ({
      pageNumber: index + 1,
      originalText: pageText,
      structureMode: formatTextByStructure(pageText, { sourceType }).mode,
      language: detectLanguage(pageText).language,
      languageConfidence: detectLanguage(pageText).confidence,
    })),
    structureMode: processed.structureMode,
    language: processed.language,
    languageConfidence: processed.languageConfidence,
    readability: processed.readability,
  };
}
