from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, auto


class TokenType(Enum):
    """Defines token categories produced by lexical analysis."""

    NUMBER = auto()
    OPERATOR = auto()
    FUNCTION = auto()
    VARIABLE = auto()
    EOF = auto()


@dataclass(frozen=True)
class Token:
    """Represents one lexical unit."""

    token_type: TokenType
    value: str

    def is_type(self, expected_type: TokenType) -> bool:
        """Returns whether the token has the expected type."""
        return self.token_type is expected_type

    def is_operator(self, operator: str) -> bool:
        """Returns whether the token is the specified operator."""
        return self.token_type is TokenType.OPERATOR and self.value == operator

    def __str__(self) -> str:
        return f"Token({self.token_type.name}, '{self.value}')"
