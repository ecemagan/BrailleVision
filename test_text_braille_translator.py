from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from braillevision.text_braille_translator import TextBrailleTranslator


class TextBrailleTranslatorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.translator = TextBrailleTranslator()

    def test_plain_sentence_translation_is_deterministic(self) -> None:
        text = "Merhaba dunya."
        expected = "⠠⠍⠑⠗⠓⠁⠃⠁ ⠙⠥⠝⠽⠁⠲"

        self.assertEqual(expected, self.translator.translate(text))
        self.assertEqual(expected, self.translator.translate(text))

    def test_turkish_characters_are_mapped_consistently(self) -> None:
        text = "cagri çığ öşü ı"
        expected = "⠉⠁⠛⠗⠊ ⠡⠔⠣ ⠪⠩⠳ ⠔"

        self.assertEqual(expected, self.translator.translate(text))

    def test_capitals_and_numbers_are_preserved(self) -> None:
        text = "TÜRKÇE 2025"
        expected = "⠠⠠⠞⠳⠗⠅⠡⠑ ⠼⠃⠚⠃⠑"

        self.assertEqual(expected, self.translator.translate(text))

    def test_line_breaks_are_preserved(self) -> None:
        text = "Bir satir.\nIkinci satir."
        expected = "⠠⠃⠊⠗ ⠎⠁⠞⠊⠗⠲\n⠠⠔⠅⠊⠝⠉⠊ ⠎⠁⠞⠊⠗⠲"

        self.assertEqual(expected, self.translator.translate(text))

    def test_unicode_minus_is_translated_like_standard_minus(self) -> None:
        text = "x→−2"
        expected = "⠭⠳⠕⠤⠼⠃"

        self.assertEqual(expected, self.translator.translate(text))


if __name__ == "__main__":
    unittest.main(verbosity=2)
