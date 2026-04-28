function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .normalize("NFC");
}

const TURKISH_STOP_WORDS = new Set([
  "ve",
  "ile",
  "bir",
  "bu",
  "şu",
  "için",
  "olarak",
  "daha",
  "gibi",
  "ama",
  "fakat",
  "çünkü",
  "de",
  "da",
  "çok",
  "sonra",
  "önce",
  "üzerinde",
  "işlem",
  "işlemleri",
  "özellikleri",
  "küme",
  "kökler",
  "üsler",
  "belirli",
  "kısmi",
]);

const ENGLISH_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "your",
  "when",
  "then",
  "line",
  "graph",
  "page",
  "braille",
  "text",
  "document",
  "section",
  "steps",
  "list",
]);

const TURKISH_CHARACTER_REGEX = /[çğıöşüÇĞİÖŞÜ]/g;
const TURKISH_FUNCTION_HINTS = /\b(aşağıda|işlem|özellik|küme|örnek|çarpma|tanımlanmış|belirli|kısmi)\b/giu;
const ENGLISH_FUNCTION_HINTS = /\b(example|section|function|equation|properties|defined|graph|line|page)\b/giu;

function tokenize(text) {
  return normalizeText(text)
    .toLocaleLowerCase("tr-TR")
    .match(/\p{L}+/gu) || [];
}

function countMatches(tokens, dictionary) {
  return tokens.reduce((count, token) => count + (dictionary.has(token) ? 1 : 0), 0);
}

function scoreText(text) {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const turkishChars = (normalized.match(TURKISH_CHARACTER_REGEX) || []).length;
  const turkishWords = countMatches(tokens, TURKISH_STOP_WORDS);
  const englishWords = countMatches(tokens, ENGLISH_STOP_WORDS);
  const turkishHints = (normalized.match(TURKISH_FUNCTION_HINTS) || []).length;
  const englishHints = (normalized.match(ENGLISH_FUNCTION_HINTS) || []).length;

  const turkishScore = turkishChars * 3 + turkishWords * 2 + turkishHints * 2;
  const englishScore = englishWords * 2 + englishHints * 2;

  return {
    tokens,
    turkishScore,
    englishScore,
    tokenCount: tokens.length,
  };
}

function resolveLanguageFromScores({ turkishScore, englishScore, tokenCount }) {
  if (tokenCount === 0) {
    return { language: "unknown", confidence: 0 };
  }

  if (turkishScore === 0 && englishScore === 0) {
    return { language: "unknown", confidence: 0.2 };
  }

  const dominant = Math.max(turkishScore, englishScore);
  const difference = Math.abs(turkishScore - englishScore);

  if (turkishScore > 0 && englishScore > 0 && difference <= Math.max(2, dominant * 0.35)) {
    return {
      language: "mixed",
      confidence: Math.min(0.92, 0.52 + dominant / Math.max(tokenCount * 2, 1)),
    };
  }

  if (turkishScore > englishScore) {
    return {
      language: "tr",
      confidence: Math.min(0.99, 0.58 + difference / Math.max(tokenCount + 2, 4)),
    };
  }

  return {
    language: "en",
    confidence: Math.min(0.99, 0.58 + difference / Math.max(tokenCount + 2, 4)),
  };
}

export function detectLanguage(text) {
  const scores = scoreText(text);
  return {
    ...resolveLanguageFromScores(scores),
    tokenCount: scores.tokenCount,
  };
}

export function detectLanguageByBlocks(blocks = []) {
  const details = blocks.map((block, index) => ({
    index,
    text: String(block?.text || ""),
    ...detectLanguage(block?.text || ""),
  }));

  const languages = new Set(details.map((detail) => detail.language).filter((language) => language && language !== "unknown"));

  if (languages.size > 1) {
    return {
      language: "mixed",
      confidence: 0.9,
      blocks: details,
    };
  }

  const mostConfident = details
    .filter((detail) => detail.language !== "unknown")
    .sort((left, right) => right.confidence - left.confidence)[0];

  return {
    language: mostConfident?.language || "unknown",
    confidence: mostConfident?.confidence || 0,
    blocks: details,
  };
}
