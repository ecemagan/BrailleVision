import { splitStoredTextForExport } from "./exportStructure.js";

export const BRF_CELLS_PER_LINE = 40;
export const BRF_LINES_PER_PAGE = 25;

export const UNICODE_TO_NABCC = {
  "\u2800": " ",
  "\u2801": "a", "\u2802": "1", "\u2803": "b", "\u2804": "'", "\u2805": "k",
  "\u2806": "2", "\u2807": "l", "\u2808": "@", "\u2809": "c", "\u280a": "i",
  "\u280b": "f", "\u280c": "/", "\u280d": "m", "\u280e": "s", "\u280f": "p",
  "\u2810": "\"", "\u2811": "e", "\u2812": "3", "\u2813": "h", "\u2814": "9",
  "\u2815": "o", "\u2816": "6", "\u2817": "r", "\u2818": "^", "\u2819": "d",
  "\u281a": "j", "\u281b": "g", "\u281c": ">", "\u281d": "n", "\u281e": "t",
  "\u281f": "q", "\u2820": ",", "\u2821": "*", "\u2822": "5", "\u2823": "<",
  "\u2824": "-", "\u2825": "u", "\u2826": "8", "\u2827": "v", "\u2828": ".",
  "\u2829": "%", "\u282a": "[", "\u282b": "$", "\u282c": "+", "\u282d": "x",
  "\u282e": "!", "\u282f": "&", "\u2830": ";", "\u2831": ":", "\u2832": "4",
  "\u2833": "\\", "\u2834": "0", "\u2835": "z", "\u2836": "7", "\u2837": "(",
  "\u2838": "_", "\u2839": "?", "\u283a": "w", "\u283b": "]", "\u283c": "#",
  "\u283d": "y", "\u283e": ")", "\u283f": "=",
};

export function convertUnicodeBrailleToBrf(unicodeBraille) {
  let ascii = "";

  for (const ch of String(unicodeBraille || "")) {
    if (ch === "\n") {
      ascii += "\n";
      continue;
    }

    if (ch === " ") {
      ascii += " ";
      continue;
    }

    ascii += UNICODE_TO_NABCC[ch] ?? ch;
  }

  const wrapped = [];

  for (const line of ascii.split("\n")) {
    if (!line) {
      wrapped.push("");
      continue;
    }

    for (let index = 0; index < line.length; index += BRF_CELLS_PER_LINE) {
      wrapped.push(line.slice(index, index + BRF_CELLS_PER_LINE));
    }
  }

  const pages = [];

  for (let index = 0; index < wrapped.length; index += BRF_LINES_PER_PAGE) {
    pages.push(wrapped.slice(index, index + BRF_LINES_PER_PAGE).join("\n"));
  }

  return pages.join("\n\f\n");
}

export function buildBrfContentFromPages(pages) {
  return (pages || []).filter(Boolean).map((page) => convertUnicodeBrailleToBrf(page)).join("\n\f\n");
}

export function buildBrfContentForDocument(document) {
  return buildBrfContentFromPages(splitStoredTextForExport(document?.braille_text || ""));
}

export function buildBrfContentForDocuments(documents) {
  return (documents || []).filter(Boolean).map((document) => buildBrfContentForDocument(document)).filter(Boolean).join("\n\f\n");
}
