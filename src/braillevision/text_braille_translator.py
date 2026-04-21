"""
Plain text → Grade 1 Braille (UEB) translator.
Supports: lowercase/uppercase, digits, Turkish characters, punctuation,
          and a comprehensive mapping of university-level math/analysis symbols.
"""
from __future__ import annotations


class TextBrailleTranslator:
    """Translates plain text into Grade 1 Braille (UEB standard)."""

    # Capital indicator
    CAPITAL_INDICATOR = "⠠"
    # Number indicator
    NUMBER_INDICATOR = "⠼"

    LETTER_MAP: dict[str, str] = {
        "a": "⠁", "b": "⠃", "c": "⠉", "d": "⠙", "e": "⠑",
        "f": "⠋", "g": "⠛", "h": "⠓", "i": "⠊", "j": "⠚",
        "k": "⠅", "l": "⠇", "m": "⠍", "n": "⠝", "o": "⠕",
        "p": "⠏", "q": "⠟", "r": "⠗", "s": "⠎", "t": "⠞",
        "u": "⠥", "v": "⠧", "w": "⠺", "x": "⠭", "y": "⠽",
        "z": "⠵",
    }

    TURKISH_MAP: dict[str, str] = {
        "ç": "⠡", "ğ": "⠣", "ı": "⠔", "ö": "⠪", "ş": "⠩", "ü": "⠳",
        "i\u0307": "⠊",   # Python lowercases 'İ' to 'i̇'
        "â": "⠁", "î": "⠊", "û": "⠥",   # long vowels
        "é": "⠑", "è": "⠑", "ë": "⠑", "ê": "⠑",
    }

    DIGIT_MAP: dict[str, str] = {
        "1": "⠁", "2": "⠃", "3": "⠉", "4": "⠙", "5": "⠑",
        "6": "⠋", "7": "⠛", "8": "⠓", "9": "⠊", "0": "⠚",
    }

    PUNCTUATION_MAP: dict[str, str] = {
        # ── Standard punctuation ──────────────────────────────────
        ".": "⠲", ",": "⠂", "?": "⠦", "!": "⠖", ":": "⠒",
        ";": "⠆", "-": "⠤", "–": "⠤⠤", "—": "⠤⠤⠤",
        "\"": "⠐⠦", "\u201c": "⠦", "\u201d": "⠴",
        "\u2018": "⠦", "\u2019": "⠴", "'": "⠄",
        "(": "⠐⠣", ")": "⠐⠜", "[": "⠨⠣", "]": "⠨⠜",
        "{": "⠸⠣", "}": "⠸⠜",
        # ── Basic math operators ──────────────────────────────────
        "+": "⠬",
        "=": "⠨⠅",
        "<": "⠐⠅",
        ">": "⠈⠅",
        "*": "⠈⠡",    # multiplication asterisk
        "/": "⠌",     # division / fraction bar
        "^": "⠘",     # superscript indicator
        "_": "⠰",     # subscript indicator
        "|": "⠳",     # absolute value / norm
        "~": "⠈⠔",   # tilde / approximation
        "×": "⠈⠡",   # multiplication sign ×
        "÷": "⠌",     # division sign ÷
        "±": "⠬⠤",   # plus-minus ±
        "∓": "⠤⠬",   # minus-plus ∓
        # ── Comparison / equality ─────────────────────────────────
        "≤": "⠐⠅⠨", "≥": "⠈⠅⠨",
        "≠": "⠌⠅",   "≈": "⠈⠔",   "≡": "⠸⠅",
        "∼": "⠈⠔",   "≅": "⠸⠔",
        "≪": "⠐⠅⠐⠅", "≫": "⠈⠅⠈⠅",
        # ── Calculus / analysis ───────────────────────────────────
        "∞": "⠿",   # infinity
        "∑": "⠨⠎",  # summation
        "∏": "⠨⠏",  # product
        "∫": "⠮",   # integral
        "∬": "⠮⠮",  "∭": "⠮⠮⠮",  "∮": "⠮⠖",
        "∂": "⠨⠙",  # partial derivative
        "∇": "⠨⠝",  # nabla / del
        "∆": "⠨⠙",  # Laplacian delta
        "√": "⠜",   # square root
        "∛": "⠘⠉⠜", "∜": "⠘⠙⠜",
        "∝": "⠳⠏",  # proportional to
        "°": "⠘⠴",  # degree symbol
        "′": "⠄",   # prime (1st derivative)
        "″": "⠄⠄",  # double prime
        "‴": "⠄⠄⠄", # triple prime
        # ── Set theory ───────────────────────────────────────────
        "∅": "⠈⠚",  "∪": "⠨⠩",  "∩": "⠨⠫",
        "∈": "⠈⠑",  "∉": "⠈⠠⠑",
        "⊂": "⠘⠣",  "⊃": "⠘⠜",
        "⊆": "⠘⠣⠐", "⊇": "⠘⠜⠐",
        "\\": "⠸⠡",   # set difference
        # ── Logic ────────────────────────────────────────────────
        "∧": "⠈⠯",  "∨": "⠈⠿",  "¬": "⠈⠹",
        "∀": "⠈⠁",  "∃": "⠈⠑⠭", "∄": "⠈⠠⠑⠭",
        # ── Arrows ───────────────────────────────────────────────
        "→": "⠳⠕",  "←": "⠳⠣",  "↔": "⠳⠕⠣",
        "↑": "⠳⠥",  "↓": "⠳⠙",
        "⟹": "⠳⠕",  "⟺": "⠳⠪",
        "⇒": "⠳⠕",  "⇐": "⠳⠣",  "⇔": "⠳⠪",
        # ── Greek letters (lowercase) ─────────────────────────────
        "α": "⠁",  "β": "⠃",  "γ": "⠛",  "δ": "⠙",
        "ε": "⠑",  "ζ": "⠵",  "η": "⠓",  "θ": "⠹",
        "ι": "⠊",  "κ": "⠅",  "λ": "⠇",  "μ": "⠍",
        "ν": "⠝",  "ξ": "⠭",  "π": "⠨⠏", "ρ": "⠗",
        "σ": "⠎",  "τ": "⠞",  "φ": "⠋",  "χ": "⠡",
        "ψ": "⠽",  "ω": "⠺",
        # ── Greek letters (uppercase) ─────────────────────────────
        "Α": "⠁",  "Β": "⠃",  "Γ": "⠛",  "Δ": "⠙",
        "Ε": "⠑",  "Θ": "⠹",  "Λ": "⠇",  "Ξ": "⠭",
        "Π": "⠨⠏", "Σ": "⠨⠎", "Φ": "⠋",  "Ψ": "⠽",
        "Ω": "⠺",
        # ── Superscript digits ────────────────────────────────────
        "⁰": "⠘⠚", "¹": "⠘⠁", "²": "⠘⠃", "³": "⠘⠉",
        "⁴": "⠘⠙", "⁵": "⠘⠑", "⁶": "⠘⠋", "⁷": "⠘⠛",
        "⁸": "⠘⠓", "⁹": "⠘⠊",
        # ── Subscript digits ─────────────────────────────────────
        "₀": "⠰⠚", "₁": "⠰⠁", "₂": "⠰⠃", "₃": "⠰⠉",
        "₄": "⠰⠙", "₅": "⠰⠑", "₆": "⠰⠋", "₇": "⠰⠛",
        "₈": "⠰⠓", "₉": "⠰⠊",
        # ── Vulgar fractions ─────────────────────────────────────
        "½": "⠹⠁⠌⠃⠼", "⅓": "⠹⠁⠌⠉⠼", "¼": "⠹⠁⠌⠙⠼",
        "¾": "⠹⠉⠌⠙⠼", "⅔": "⠹⠃⠌⠉⠼",
        # ── Misc math / geometry ─────────────────────────────────
        "⊥": "⠸⠂",  # perpendicular
        "∥": "⠸⠇",  # parallel
        "∟": "⠸⠣",  # right angle
        # ── Web / code symbols ────────────────────────────────────
        "@": "⠈⠁", "#": "⠼", "%": "⠨⠴", "&": "⠠⠯",
        # ── OCR artifacts (ignore) ────────────────────────────────
        "¸": "", "¨": "", "˘": "",
        # ── Whitespace ────────────────────────────────────────────
        " ": " ", "\n": "\n", "\r": "", "\t": " ",
        "\v": "\n", "\f": "\n", "\x07": " ",
    }

    def translate(self, text: str) -> str:
        """
        Translates plain text into Grade 1 Braille (UEB standard).
        Handles capital indicators, number indicators, Turkish characters,
        and a comprehensive set of university-level math/analysis symbols.
        """
        import re

        # Tokenise: words (letters incl. Turkish), digit runs,
        # single whitespace chars, multi-byte Unicode symbols, and single ASCII punctuation.
        tokens = re.findall(
            r'[a-zA-ZçğışıöüÇĞIŞİÖÜ\u0370-\u03ff]+'   # Latin + Greek words
            r'|\d+'                                       # digit runs
            r'|[ \n\r\t\v\f]'                            # whitespace (one at a time)
            r'|[^\s\w]',                                  # any single non-word, non-space char
            text
        )

        result: list[str] = []
        in_number = False
        script_mode: str | None = None  # 'super' | 'sub' | None

        for token in tokens:
            # 1. Letters / Words (Latin, Turkish, Greek single chars caught by isalpha)
            if token[0].isalpha() or token[0] in "çğışıöüÇĞIŞİÖÜ":
                in_number = False
                is_all_caps = len(token) > 1 and token.isupper()

                if is_all_caps:
                    result.append(self.CAPITAL_INDICATOR * 2)
                    for char in token:
                        lower = char.lower()
                        composed = lower
                        if char == "İ":
                            braille = "⠊"
                        elif char == "I":
                            braille = "⠔"
                        elif lower in self.TURKISH_MAP:
                            braille = self.TURKISH_MAP[lower]
                        elif composed in self.TURKISH_MAP:
                            braille = self.TURKISH_MAP[composed]
                        else:
                            braille = self.LETTER_MAP.get(lower, lower)
                        result.append(braille)
                else:
                    for char in token:
                        lower = char.lower()
                        is_upper = char.isupper()
                        if char == "İ":
                            braille = "⠊"
                        elif char == "I":
                            braille = "⠔"
                        elif lower in self.TURKISH_MAP:
                            braille = self.TURKISH_MAP[lower]
                        elif char in self.PUNCTUATION_MAP:
                            # Greek uppercase (Σ, Π, Ω …) and misc
                            braille = self.PUNCTUATION_MAP[char]
                        elif lower in self.PUNCTUATION_MAP:
                            # Greek lowercase (α, β, γ …)
                            braille = self.PUNCTUATION_MAP[lower]
                        else:
                            braille = self.LETTER_MAP.get(lower, lower)

                        if script_mode:
                            result.append(braille)
                        elif is_upper:
                            result.append(self.CAPITAL_INDICATOR + braille)
                        else:
                            result.append(braille)

                script_mode = None  # reset after any letter token


            # 2. Digits
            elif token[0].isdigit():
                if script_mode:
                    # In superscript/subscript: suppress number indicator
                    for digit in token:
                        result.append(self.DIGIT_MAP.get(digit, digit))
                    script_mode = None
                else:
                    if not in_number:
                        result.append(self.NUMBER_INDICATOR)
                        in_number = True
                    for digit in token:
                        result.append(self.DIGIT_MAP.get(digit, digit))

            # 3. Punctuation / Symbol / Special
            else:
                in_number = False
                # Script mode switches
                if token == "^":
                    result.append("⠘")   # superscript indicator
                    script_mode = "super"
                elif token == "_":
                    result.append("⠰")   # subscript indicator
                    script_mode = "sub"
                elif token in self.PUNCTUATION_MAP:
                    result.append(self.PUNCTUATION_MAP[token])
                    script_mode = None
                else:
                    # Char-by-char fallback
                    for ch in token:
                        result.append(self.PUNCTUATION_MAP.get(ch, ch))
                    script_mode = None

        return "".join(result)

