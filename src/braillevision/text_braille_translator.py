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
        "â": "⠁", "î": "⠊", "û": "⠥",  # long vowels
    }

    DIGIT_MAP: dict[str, str] = {
        "1": "⠁", "2": "⠃", "3": "⠉", "4": "⠙", "5": "⠑",
        "6": "⠋", "7": "⠛", "8": "⠓", "9": "⠊", "0": "⠚",
    }

    PUNCTUATION_MAP: dict[str, str] = {
        ".": "⠲", ",": "⠂", "?": "⠦", "!": "⠖", ":": "⠒",
        ";": "⠆", "-": "⠤", "–": "⠤⠤", "\"": "⠐⠦",
        "'": "⠄", "(": "⠐⠣", ")": "⠐⠜",
        " ": " ",   # space stays as space
        "\n": "\n", # newline preserved
        "\t": " ",
    }

    def translate(self, text: str) -> str:
        """
        Translates plain text into Grade 1 Braille string.
        Each word is separated by a space in Braille.
        """
        def translate_word(word: str, is_all_caps_word: bool) -> str:
            result: list[str] = []
            in_number = False

            for char in word:
                if char.upper() != char.lower():  # it's a letter
                    in_number = False
                    lower = char.lower()

                    # Check Turkish characters first
                    if lower in self.TURKISH_MAP:
                        braille = self.TURKISH_MAP[lower]
                    else:
                        braille = self.LETTER_MAP.get(lower, char)

                    if is_all_caps_word:
                        result.append(braille)
                    elif char.isupper():
                        result.append(self.CAPITAL_INDICATOR + braille)
                    else:
                        result.append(braille)

                elif char.isdigit():
                    if not in_number:
                        result.append(self.NUMBER_INDICATOR)
                        in_number = True
                    result.append(self.DIGIT_MAP[char])

                elif char in self.PUNCTUATION_MAP:
                    in_number = False
                    result.append(self.PUNCTUATION_MAP[char])

                else:
                    # Unknown character: pass through or skip
                    in_number = False
                    result.append(char)

            return (self.CAPITAL_INDICATOR * 2 if is_all_caps_word else "") + "".join(result)

        result: list[str] = []

        for segment in text.split(" "):
            if segment == "":
                result.append(" ")
                continue

            letters_only = "".join(char for char in segment if char.isalpha())
            is_all_caps_word = (
                len(letters_only) > 1
                and letters_only.upper() == letters_only
                and letters_only.lower() != letters_only
            )
            result.append(translate_word(segment, is_all_caps_word))

        return " ".join(result)
