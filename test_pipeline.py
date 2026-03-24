from __future__ import annotations

import re
import sys
import unittest
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from braillevision.ast_nodes import FractionNode, GroupedNode, RootNode
from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser


GOLDEN_FILE = Path("testdata") / "nemeth_golden.tsv"


@dataclass(frozen=True)
class GoldenCase:
    """Defines one deterministic golden comparison case."""

    case_id: str
    expression: str
    expected_tokens: str
    expected_ast: str
    expected_nemeth: str


def decode_unicode_escapes(value: str) -> str:
    """Decodes Unicode escape sequences in golden files."""

    def replace_match(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    return re.sub(r"\\u([0-9a-fA-F]{4})", replace_match, value)


def tokens_to_string(tokens: list) -> str:
    """Formats token lists in deterministic Java-compatible style."""
    return "[" + ", ".join(str(token) for token in tokens) + "]"


def load_golden_cases(file_path: Path) -> list[GoldenCase]:
    """Loads deterministic pipeline cases from TSV golden file."""
    lines = file_path.read_text(encoding="utf-8").splitlines()
    cases: list[GoldenCase] = []

    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        parts = stripped.split("\t")
        if len(parts) != 5:
            raise ValueError(f"Invalid golden case format at line {line_number}")

        case_id, expression, expected_tokens, expected_ast, expected_nemeth = parts
        cases.append(
            GoldenCase(
                case_id=case_id,
                expression=expression,
                expected_tokens=expected_tokens,
                expected_ast=expected_ast,
                expected_nemeth=decode_unicode_escapes(expected_nemeth),
            )
        )

    return cases


class PipelineTest(unittest.TestCase):
    """Validates lexical, syntactic, and Nemeth translation behavior."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.golden_cases = load_golden_cases(GOLDEN_FILE)
        cls.translator = NemethTranslator()

    def test_golden_file_comparisons(self) -> None:
        """Validates deterministic golden cases for lexer, parser, and translator."""
        for case in self.golden_cases:
            with self.subTest(case=case.case_id, expression=case.expression):
                tokens = Lexer(case.expression).tokenize()
                ast = Parser(tokens).parse()
                nemeth = self.translator.translate(ast)

                self.assertEqual(case.expected_tokens, tokens_to_string(tokens))
                self.assertEqual(case.expected_ast, str(ast))
                self.assertEqual(case.expected_nemeth, nemeth)

    def test_translation_is_deterministic(self) -> None:
        """Ensures repeated translation returns the same result."""
        expression = "sqrt((1+2)/(3+4))"
        tokens = Lexer(expression).tokenize()
        ast = Parser(tokens).parse()

        first = self.translator.translate(ast)
        second = self.translator.translate(ast)

        self.assertEqual(first, second)

    def test_fraction_inside_root_structure(self) -> None:
        """Validates nested AST structures for root and fraction."""
        expression = "sqrt((1+2)/(3+4))"
        ast = Parser(Lexer(expression).tokenize()).parse()

        self.assertIsInstance(ast, RootNode)
        self.assertIsInstance(ast.radicand, GroupedNode)
        self.assertIsInstance(ast.radicand.inner, FractionNode)

    def test_implicit_multiplication(self) -> None:
        """Validates implicit multiplication parsing for adjacency cases."""
        ast_1 = Parser(Lexer("4x").tokenize()).parse()
        ast_2 = Parser(Lexer("2(x+1)").tokenize()).parse()

        self.assertEqual("(4 * x)", str(ast_1))
        self.assertEqual("(2 * (x + 1))", str(ast_2))

    def test_explicit_grouping_rendering_only(self) -> None:
        """Ensures Braille grouping symbols appear only for explicit groups."""
        implicit = Parser(Lexer("2 + 3 * 4").tokenize()).parse()
        explicit = Parser(Lexer("(2 + 3) * 4").tokenize()).parse()

        implicit_nemeth = self.translator.translate(implicit)
        explicit_nemeth = self.translator.translate(explicit)

        self.assertNotIn("⠷", implicit_nemeth)
        self.assertNotIn("⠾", implicit_nemeth)
        self.assertIn("⠷", explicit_nemeth)
        self.assertIn("⠾", explicit_nemeth)

    def test_trigonometric_and_logarithmic_functions(self) -> None:
        """Validates tokenization and translation for trigonometric and logarithmic functions."""
        expression = "sin(x) + cos(y) + tan(z) + log(10)"
        tokens = Lexer(expression).tokenize()
        ast = Parser(tokens).parse()
        nemeth = self.translator.translate(ast)

        function_tokens = [token.value for token in tokens if token.token_type.name == "FUNCTION"]

        self.assertEqual(["sin", "cos", "tan", "log"], function_tokens)
        self.assertIn("⠎⠊⠝", nemeth)
        self.assertNotIn("⠎⠔", nemeth)
        self.assertIn("⠉⠕⠎", nemeth)
        self.assertIn("⠞⠁⠝", nemeth)
        self.assertIn("⠇⠕⠛", nemeth)
        self.assertIn("⠎⠊⠝⠷", nemeth)
        self.assertIn("⠉⠕⠎⠷", nemeth)
        self.assertIn("⠞⠁⠝⠷", nemeth)
        self.assertIn("⠇⠕⠛⠷", nemeth)

    def test_complex_exponent_and_subscript(self) -> None:
        """Validates complex exponent and subscript parsing with Nemeth script indicators."""
        expression = "x_1 + e^(x+1)"
        ast = Parser(Lexer(expression).tokenize()).parse()
        nemeth = self.translator.translate(ast)

        self.assertEqual("((x _ 1) + (e ^ (x + 1)))", str(ast))
        self.assertIn("⠰", nemeth)
        self.assertIn("⠘", nemeth)
        self.assertIn("⠷", nemeth)
        self.assertIn("⠾", nemeth)

    def test_required_complex_pipeline_expression(self) -> None:
        """Validates the required production expression with nested fraction inside square root."""
        expression = "sin(x) + sqrt(1/2) = y"
        ast = Parser(Lexer(expression).tokenize()).parse()
        nemeth = self.translator.translate(ast)

        self.assertEqual("((sin(x) + sqrt((1 / 2))) = y)", str(ast))
        self.assertIn("⠎⠊⠝", nemeth)
        self.assertIn("⠎⠊⠝⠷", nemeth)
        self.assertIn("⠜", nemeth)
        self.assertIn("⠹", nemeth)
        self.assertIn("⠨⠅", nemeth)


if __name__ == "__main__":
    unittest.main(verbosity=2)
