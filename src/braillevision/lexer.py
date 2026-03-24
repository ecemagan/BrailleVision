from __future__ import annotations

from typing import List

from .token_model import Token, TokenType


class Lexer:
    """Lexical analyzer for mathematical expressions."""

    FUNCTION_NAMES = frozenset({"sin", "cos", "tan", "log", "sqrt"})

    def __init__(self, source: str | None) -> None:
        self.source = source or ""
        self.position = 0

    def tokenize(self) -> List[Token]:
        """Converts source text into tokens."""
        tokens: List[Token] = []

        while not self._is_at_end():
            current = self._peek()

            if current.isspace():
                self._advance()
                continue

            if current.isdigit():
                tokens.append(self._read_number())
                continue

            if current.isalpha():
                tokens.append(self._read_identifier())
                continue

            if self._is_operator(current):
                tokens.append(Token(TokenType.OPERATOR, current))
                self._advance()
                continue

            raise ValueError(f"Invalid character at index {self.position}: '{current}'")

        tokens.append(Token(TokenType.EOF, ""))
        return tokens

    def _read_number(self) -> Token:
        start = self.position
        while not self._is_at_end() and self._peek().isdigit():
            self._advance()
        return Token(TokenType.NUMBER, self.source[start:self.position])

    def _read_identifier(self) -> Token:
        start = self.position
        while not self._is_at_end() and self._peek().isalnum():
            self._advance()

        lexeme = self.source[start:self.position]
        lower = lexeme.lower()
        if lower in self.FUNCTION_NAMES:
            return Token(TokenType.FUNCTION, lower)
        return Token(TokenType.VARIABLE, lexeme)

    @staticmethod
    def _is_operator(character: str) -> bool:
        return character in {"+", "-", "*", "/", "=", "^", "_", "(", ")"}

    def _peek(self) -> str:
        return self.source[self.position]

    def _advance(self) -> None:
        self.position += 1

    def _is_at_end(self) -> bool:
        return self.position >= len(self.source)
