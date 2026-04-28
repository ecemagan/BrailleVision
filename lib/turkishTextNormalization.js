const WORD_WITH_MARKERS_REGEX =
  /([A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîûÉÈËÊéèëê:"˘¸¨]+|\s+|[^A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîûÉÈËÊéèëê:"˘¸¨\s]+)/gu;

const FORMULA_REPLACEMENTS = [
  [/(^|[^\p{L}]):nt(?=\()/gu, "$1int"],
  [/(^|[^\p{L}]):nf(?=\b|[\s)\],])/gu, "$1inf"],
  [/(^|[^\p{L}])l:m(?=\()/gu, "$1lim"],
  [/(^|[^\p{L}])s:nh(?=\()/gu, "$1sinh"],
  [/(^|[^\p{L}])arcs:n(?=\()/gu, "$1arcsin"],
  [/\bp:(?=\b|[\s)\],*+/=-])/gu, "pi"],
];

const EXACT_CORRUPTED_WORD_REPLACEMENTS = new Map([
  ['"usler', "üsler"],
  ['"ust', "üst"],
  ['"uzerine', "üzerine"],
  ['"uzerinde', "üzerinde"],
  ['"ozellikleri', "özellikleri"],
  ['"ozellikler', "özellikler"],
  ['"ogrenci', "öğrenci"],
  ['"ogretmen', "öğretmen"],
  ["ozellikleri", "özellikleri"],
  ["ozellikler", "özellikler"],
  ['"ornek', "örnek"],
  ['k"okler', "kökler"],
  ['k"ok', "kök"],
  ['b"oyle', "böyle"],
  ['k"umeleri', "kümeleri"],
  ['t"urkce', "türkçe"],
  ['s"ozetme', "sözetme"],
  ["i¸slemleri", "işlemleri"],
  ["i¸slem", "işlem"],
  ["i¸cin", "için"],
  ["tanımlanmı¸s", "tanımlanmış"],
  ["¸carpma", "çarpma"],
  ["¸carpım", "çarpım"],
  ["¸cözüm", "çözüm"],
  ["do˘gal", "doğal"],
  ["a¸sa˘gıda", "aşağıda"],
  ["a¸sa˘ıdaki", "aşağıdaki"],
  ["hi¸c", "hiç"],
  ["kısm:", "kısmi"],
  ["bel:rl:", "belirli"],
  ["ikinc:", "ikinci"],
  ["iler:", "ileri"],
  ["l:m:t", "limit"],
  ["l:m:t:", "limiti"],
  ["teoris:", "teorisi"],
  ["trigonometr:", "trigonometri"],
  [":ntegral", "integral"],
  [":ntegrasyon", "integrasyon"],
]);

const WHOLE_WORD_REPLACEMENTS = new Map([
  ["kısmi", "kısmi"],
  ["belirli", "belirli"],
  ["ikinci", "ikinci"],
  ["ileri", "ileri"],
  ["limit", "limit"],
  ["limiti", "limiti"],
  ["trigonometri", "trigonometri"],
  ["teorisi", "teorisi"],
  ["özellikleri", "özellikleri"],
  ["işlemleri", "işlemleri"],
  ["işlem", "işlem"],
  ["tanımlanmış", "tanımlanmış"],
  ["çarpma", "çarpma"],
  ["çarpım", "çarpım"],
  ["çözüm", "çözüm"],
  ["doğal", "doğal"],
  ["aşağıda", "aşağıda"],
  ["aşağıdaki", "aşağıdaki"],
  ["hiç", "hiç"],
  ["kümeleri", "kümeleri"],
  ["kökler", "kökler"],
  ["kök", "kök"],
  ["üsler", "üsler"],
  ["integrasyon", "integrasyon"],
  ["integral", "integral"],
  ["üzerine", "üzerine"],
  ["üzerinde", "üzerinde"],
  ["böyle", "böyle"],
  ["örnek", "örnek"],
  ["özellikler", "özellikler"],
  ["öğrenci", "öğrenci"],
  ["öğretmen", "öğretmen"],
  ["üst", "üst"],
  ["türkçe", "türkçe"],
  ["için", "için"],
]);

const TURKISH_WORDLIKE_HINTS = new Set([
  "hiperbolik",
  "trigonometri",
  "trigonometrik",
  "ters",
  "integral",
  "integrali",
  "integrasyon",
  "matematik",
  "fonksiyon",
  "fonksiyonu",
  "fonksiyonlar",
  "kesirli",
  "özdeşlik",
  "özdeşlikler",
  "özellik",
  "özellikler",
  "özellikleri",
  "tanımlı",
  "tanımlanmış",
  "işlem",
  "işlemler",
  "işlemleri",
  "sayılar",
  "sayılar",
  "sayı",
  "sayısı",
  "birim",
  "birimler",
  "birinci",
  "ikinci",
  "üçüncü",
  "dördüncü",
  "kısmi",
  "belirli",
  "limit",
  "limiti",
  "teorisi",
  "teorem",
  "teoremi",
  "sinir",
  "siniri",
]);

const DIRECT_MARKER_REPLACEMENTS = [
  [/"u/g, "ü"],
  [/"U/g, "Ü"],
  [/"o/g, "ö"],
  [/"O/g, "Ö"],
  [/u"/g, "ü"],
  [/U"/g, "Ü"],
  [/o"/g, "ö"],
  [/O"/g, "Ö"],
  [/¨u/g, "ü"],
  [/¨U/g, "Ü"],
  [/¨o/g, "ö"],
  [/¨O/g, "Ö"],
  [/u¨/g, "ü"],
  [/U¨/g, "Ü"],
  [/o¨/g, "ö"],
  [/O¨/g, "Ö"],
  [/"i/g, "i"],
  [/"I/g, "I"],
  [/¸c/g, "ç"],
  [/¸C/g, "Ç"],
  [/¸s/g, "ş"],
  [/¸S/g, "Ş"],
  [/c¸/g, "ç"],
  [/C¸/g, "Ç"],
  [/s¸/g, "ş"],
  [/S¸/g, "Ş"],
  [/˘g/g, "ğ"],
  [/˘G/g, "Ğ"],
  [/g˘/g, "ğ"],
  [/G˘/g, "Ğ"],
];

function normalizeUnicodeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/ƒ/gu, "f")
    .normalize("NFC");
}

function preserveCase(original, repairedLower) {
  if (!original) {
    return repairedLower;
  }

  if (original[0] === ":" && repairedLower) {
    return repairedLower;
  }

  const firstLetter = original.match(/\p{L}/u)?.[0] || "";

  if (firstLetter && original === original.toUpperCase()) {
    return repairedLower.toLocaleUpperCase("tr-TR");
  }

  if (!firstLetter) {
    return repairedLower;
  }

  const upperFirst = firstLetter.toLocaleUpperCase("tr-TR");

  if (firstLetter === upperFirst) {
    return `${repairedLower[0].toLocaleUpperCase("tr-TR")}${repairedLower.slice(1)}`;
  }

  return repairedLower;
}

function repairDictionaryWord(word) {
  const lower = word.toLocaleLowerCase("tr-TR");
  const exactMatch = EXACT_CORRUPTED_WORD_REPLACEMENTS.get(lower);

  if (exactMatch) {
    return preserveCase(word, exactMatch);
  }

  const repaired = WHOLE_WORD_REPLACEMENTS.get(lower);

  if (!repaired) {
    return null;
  }

  return preserveCase(word, repaired);
}

function looksLikeColonCorruptedWord(word) {
  if (!word || !word.includes(":")) {
    return false;
  }

  const stripped = word.replace(/:+$/u, "");
  const alphaOnly = stripped.replace(/:/g, "");

  if (alphaOnly.length < 4) {
    return false;
  }

  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/u.test(stripped)) {
    return false;
  }

  return /^[:A-Za-zÇĞİÖŞÜçğıöşü]+$/u.test(word);
}

function hasTurkishWordShape(word) {
  const lower = word.toLocaleLowerCase("tr-TR");
  const vowelCount = (lower.match(/[aeıioöuü]/g) || []).length;

  if (vowelCount < 2) {
    return false;
  }

  if (TURKISH_WORDLIKE_HINTS.has(lower)) {
    return true;
  }

  const suffixes = [
    "lik",
    "lık",
    "luk",
    "lük",
    "li",
    "lı",
    "lu",
    "lü",
    "si",
    "sı",
    "leri",
    "ları",
    "nin",
    "nın",
    "in",
    "ın",
    "de",
    "da",
    "den",
    "dan",
    "mi",
    "mı",
    "mu",
    "mü",
    "tir",
    "tır",
    "tur",
    "tür",
  ];

  for (const suffix of suffixes) {
    if (!lower.endsWith(suffix) || lower.length <= suffix.length + 2) {
      continue;
    }

    const stem = lower.slice(0, -suffix.length);
    if (TURKISH_WORDLIKE_HINTS.has(stem)) {
      return true;
    }
  }

  return false;
}

function preserveCandidateCase(original, candidate) {
  const trailingPunctuationMatch = original.match(/:+$/u);
  const trailingLength = trailingPunctuationMatch ? trailingPunctuationMatch[0].length : 0;
  const originalWord = trailingLength ? original.slice(0, -trailingLength) : original;
  const candidateMatch = candidate.match(/:+$/u);
  const candidateTrailingLength = candidateMatch ? candidateMatch[0].length : 0;
  const candidateWord = candidateTrailingLength ? candidate.slice(0, -candidateTrailingLength) : candidate;
  const suffix = candidateTrailingLength ? candidate.slice(-candidateTrailingLength) : "";

  return `${preserveCase(originalWord, candidateWord.toLocaleLowerCase("tr-TR"))}${suffix}`;
}

function generateColonRepairCandidates(word) {
  const trailingColonCount = (word.match(/:+$/u) || [""])[0].length;
  const candidates = new Set();

  for (let punctuationCount = 0; punctuationCount <= Math.min(trailingColonCount, 1); punctuationCount += 1) {
    const suffix = punctuationCount ? ":".repeat(punctuationCount) : "";
    const core = punctuationCount ? word.slice(0, -punctuationCount) : word;
    const colonCount = (core.match(/:/g) || []).length;

    if (!colonCount) {
      candidates.add(core + suffix);
      continue;
    }

    const allI = core.replace(/:/g, "i");
    candidates.add(allI + suffix);

    const allDotlessI = core.replace(/:/g, "ı");
    candidates.add(allDotlessI + suffix);

    if (colonCount <= 3) {
      const positions = [...core].reduce((indexes, char, index) => {
        if (char === ":") {
          indexes.push(index);
        }
        return indexes;
      }, []);

      const combinations = 1 << positions.length;
      for (let mask = 0; mask < combinations; mask += 1) {
        const chars = [...core];
        positions.forEach((position, bitIndex) => {
          chars[position] = mask & (1 << bitIndex) ? "ı" : "i";
        });
        candidates.add(chars.join("") + suffix);
      }
    }
  }

  return [...candidates];
}

function repairColonCorruptedWord(word) {
  if (!looksLikeColonCorruptedWord(word)) {
    return null;
  }

  let bestCandidate = null;
  let bestScore = 0;

  for (const candidate of generateColonRepairCandidates(word)) {
    const candidateWord = candidate.replace(/:+$/u, "");
    const exactRepair = repairDictionaryWord(candidateWord);

    if (exactRepair) {
      const suffix = candidate.slice(candidateWord.length);
      const repaired = `${exactRepair}${suffix}`;
      return {
        text: preserveCandidateCase(word, repaired),
        confidence: 0.99,
        changed: true,
      };
    }

    if (!hasTurkishWordShape(candidateWord)) {
      continue;
    }

    const score = candidate.includes(":") ? 0.88 : 0.93;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return null;
  }

  return {
    text: preserveCandidateCase(word, bestCandidate),
    confidence: bestScore,
    changed: bestCandidate !== word,
  };
}

function applyFormulaReplacements(line) {
  let next = String(line || "");
  let changed = false;

  for (const [pattern, replacement] of FORMULA_REPLACEMENTS) {
    const before = next;
    next = next.replace(pattern, replacement);
    if (before !== next) {
      changed = true;
    }
  }

  return {
    text: next,
    changed,
  };
}

function repairWordToken(token) {
  const original = String(token || "");
  const directDictionaryRepair = repairDictionaryWord(original);

  if (directDictionaryRepair) {
    return {
      text: directDictionaryRepair,
      confidence: 0.99,
      changed: directDictionaryRepair !== original,
    };
  }

  const colonRepair = repairColonCorruptedWord(original);

  if (colonRepair) {
    return colonRepair;
  }

  if (!/[":˘¸¨]/.test(original)) {
    return {
      text: original,
      confidence: 0,
      changed: false,
    };
  }

  let repaired = original;
  let changes = 0;

  for (const [pattern, replacement] of DIRECT_MARKER_REPLACEMENTS) {
    const before = repaired;
    repaired = repaired.replace(pattern, replacement);
    if (before !== repaired) {
      changes += 1;
    }
  }

  if (/["˘¸¨]/.test(repaired)) {
    return {
      text: original,
      confidence: 0.2,
      changed: false,
    };
  }

  const colonCandidate = repaired.includes(":") ? repaired.replace(/:/g, "i") : repaired;
  const dictionaryRepair = repairDictionaryWord(colonCandidate) || repairDictionaryWord(repaired);

  if (dictionaryRepair) {
    repaired = dictionaryRepair;
  }

  return {
    text: repaired,
    confidence: changes > 0 || repaired !== original ? 0.98 : 0.55,
    changed: repaired !== original,
  };
}

export function applyCorruptionPatternMapper(line) {
  const mapped = applyFormulaReplacements(line);

  return {
    text: mapped.text,
    confidence: mapped.changed ? 0.99 : 0,
    changed: mapped.changed,
  };
}

export function repairCorruptedTurkishLine(line) {
  const normalizedLine = normalizeUnicodeText(line);
  const mapped = applyCorruptionPatternMapper(normalizedLine);
  const segments = mapped.text.match(WORD_WITH_MARKERS_REGEX) || [];
  let changed = mapped.changed;
  let confidence = mapped.confidence;

  const repairedText = segments
    .map((segment) => {
      if (/^\s+$/.test(segment)) {
        return segment;
      }

      if (!/[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîûÉÈËÊéèëê"˘¸¨]/u.test(segment)) {
        return segment;
      }

      const repaired = repairWordToken(segment);

      if (repaired.changed) {
        changed = true;
        confidence = Math.max(confidence, repaired.confidence);
      }

      return repaired.confidence >= 0.85 ? repaired.text : segment;
    })
    .join("");

  return {
    text: repairedText,
    confidence,
    changed,
  };
}

export function normalizeTurkish(text) {
  const normalizedText = normalizeUnicodeText(text);
  const lines = normalizedText.split("\n");

  return {
    text: lines.map((line) => repairCorruptedTurkishLine(line).text).join("\n"),
    lines: lines.map((line) => repairCorruptedTurkishLine(line).text),
  };
}

function collapseParagraphLines(lines) {
  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
        current = [];
      }
      paragraphs.push("");
      continue;
    }

    current.push(line.trim());
  }

  if (current.length) {
    paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
  }

  return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function detectTextStructureMode(text, { sourceType = "ocr" } = {}) {
  if (sourceType === "pdf") {
    return "line-preserved";
  }

  const lines = normalizeUnicodeText(text).split("\n");
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

  if (nonEmptyLines.length <= 1) {
    return "paragraph";
  }

  const shortLineCount = nonEmptyLines.filter((line) => line.length <= 60).length;
  const formulaLikeCount = nonEmptyLines.filter((line) => /[=∫√π∞≤≥⇔⇒⊂∈]/.test(line)).length;

  return shortLineCount / nonEmptyLines.length >= 0.55 || formulaLikeCount > 0 ? "line-preserved" : "paragraph";
}

export function normalizeTurkishExtractedText(text, options = {}) {
  const sourceType = options.sourceType || "ocr";
  const mode = options.mode || detectTextStructureMode(text, { sourceType });
  const normalized = normalizeTurkish(text);

  if (mode === "line-preserved") {
    return normalized.text;
  }

  return collapseParagraphLines(normalized.lines);
}
