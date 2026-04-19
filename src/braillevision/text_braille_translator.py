"""
Plain text → Grade 1 Braille (UEB) translator.
Supports: lowercase/uppercase, digits, Turkish characters, punctuation.
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
        "i̇": "⠊",  # Python lowercases 'İ' to 'i̇'
        "ı": "⠔",   # Keep 'ı' just in case

        "â": "⠁", "î": "⠊", "û": "⠥",  # long vowels
        "é": "⠑", "è": "⠑", "ë": "⠑", "ê": "⠑", # fallback variations of e
    }

    DIGIT_MAP: dict[str, str] = {
        "1": "⠁", "2": "⠃", "3": "⠉", "4": "⠙", "5": "⠑",
        "6": "⠋", "7": "⠛", "8": "⠓", "9": "⠊", "0": "⠚",
    }

    PUNCTUATION_MAP: dict[str, str] = {
        ".": "⠲", ",": "⠂", "?": "⠦", "!": "⠖", ":": "⠒",
        ";": "⠆", "-": "⠤", "–": "⠤⠤", "\"": "⠐⠦",
        "'": "⠄", "(": "⠐⠣", ")": "⠐⠜",
        "[": "⠨⠣", "]": "⠨⠜", "{": "⠸⠣", "}": "⠸⠜",
        "“": "⠦", "”": "⠴", "‘": "⠦", "’": "⠴",
        "+": "⠬", "=": "⠨⠅", "<": "⠐⠅", ">": "⠈⠅", "×": "⠈⠡",
        "∫": "⠮", "∂": "⠨⠙", "∅": "⠈⠚", "∪": "⠨⠩", "∩": "⠨⠫",
        "∈": "⠈⠑", "∉": "⠈⠠⠑", "⊂": "⠘⠣", "⊃": "⠘⠜",
        "⇔": "⠳⠪", "⇐": "⠳⠣", "⇒": "⠳⠕", "≡": "⠸⠅", "\\": "⠸⠡",
        "@": "⠈⠁", "#": "⠼", "%": "⠨⠴", "&": "⠠⠯",  # Add basic web symbols
        "¸": "", "¨": "", "˘": "",  # OCR ile parçalanmış hatalı harf şapkaları (ç, ü, ğ işaretleri) yok sayılır
        " ": " ",   # space stays as space
        "\n": "\n", # newline preserved
        "\r": "",   # carriage return ignored safely
        "\t": " ",
        "\v": "\n", # Vertical tab (Word Shift+Enter)
        "\f": "\n", # Form feed (Word Page Break)
        "\x07": " ", # Table cell separator in Word mapping to space
    }

    def translate(self, text: str) -> str:
        """
        Translates plain text into Grade 1 Braille string.
        Each word is separated by a space in Braille.
        """
        result: list[str] = []
        in_number = False  # track whether we're inside a digit sequence

        for char in text:
            if char.upper() != char.lower():  # it's a letter
                in_number = False
                lower = char.lower()
                is_upper = char.isupper()

                if char == "İ":
                    braille = "⠊"
                elif char == "I":
                    braille = "⠔"
                elif lower in self.TURKISH_MAP:
                    braille = self.TURKISH_MAP[lower]
                else:
                    braille = self.LETTER_MAP.get(lower, char)

                if is_upper:
                    result.append(self.CAPITAL_INDICATOR + braille)
                else:
                    result.append(braille)

            elif char.isdigit():
                if not in_number:
                    result.append(self.NUMBER_INDICATOR)
                    in_number = True
                result.append(self.DIGIT_MAP[char])

            elif char == " ":
                in_number = False
                result.append(" ")

            elif char == "\n":
                in_number = False
                result.append("\n")

            elif char in self.PUNCTUATION_MAP:
                in_number = False
                result.append(self.PUNCTUATION_MAP[char])

            else:
                # Unknown character: pass through or skip
                in_number = False
                result.append(char)

        return "".join(result)
