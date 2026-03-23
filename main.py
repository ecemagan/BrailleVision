from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser


OUTPUT_FILE = Path("output.txt")


def configure_utf8_console() -> None:
    """Configures UTF-8 output for console rendering."""
    if os.name == "nt":
        try:
            subprocess.run(["cmd", "/c", "chcp 65001 > nul"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def write_output_file(braille: str) -> None:
    """Writes the translated Nemeth string to UTF-8 output file."""
    OUTPUT_FILE.write_text(braille + os.linesep, encoding="utf-8")


def run_pipeline(expression: str) -> tuple[str, str, str, str]:
    """Runs lexical analysis, parsing, and Nemeth translation."""
    tokens = Lexer(expression).tokenize()
    ast = Parser(tokens).parse()
    braille = NemethTranslator().translate(ast)
    return expression, f"[{', '.join(str(token) for token in tokens)}]", str(ast), braille


def main() -> None:
    """Executes the end-to-end translation pipeline."""
    configure_utf8_console()

    expression = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "sqrt(x) + 1/2 = 5"
    source, token_text, ast_text, braille = run_pipeline(expression)

    print(f"Input: {source}")
    print(f"Tokens: {token_text}")
    print(f"AST: {ast_text}")
    print(f"Nemeth: {braille}")

    write_output_file(braille)
    print(f"Output file: {OUTPUT_FILE.resolve()}")


if __name__ == "__main__":
    main()
