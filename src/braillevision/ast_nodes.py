from __future__ import annotations

from abc import ABC
from dataclasses import dataclass, replace


class ExpressionNode(ABC):
    """Abstract base type for all expression nodes."""

    def is_explicit_grouping(self) -> bool:
        """Indicates whether grouping was explicit in source text."""
        return False


@dataclass(frozen=True)
class NumberNode(ExpressionNode):
    """Represents a numeric literal."""

    value: str

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class VariableNode(ExpressionNode):
    """Represents a variable identifier."""

    name: str

    def __str__(self) -> str:
        return self.name


@dataclass(frozen=True)
class BinaryOpNode(ExpressionNode):
    """Represents a binary operation."""

    operator: str
    left: ExpressionNode
    right: ExpressionNode
    explicit_grouping: bool = False

    def is_explicit_grouping(self) -> bool:
        return self.explicit_grouping

    def as_explicit_grouping(self) -> BinaryOpNode:
        """Returns a copy marked as explicitly grouped."""
        if self.explicit_grouping:
            return self
        return replace(self, explicit_grouping=True)

    def __str__(self) -> str:
        return f"({self.left} {self.operator} {self.right})"


@dataclass(frozen=True)
class FractionNode(ExpressionNode):
    """Represents a fraction expression."""

    numerator: ExpressionNode
    denominator: ExpressionNode

    def __str__(self) -> str:
        return f"({self.numerator} / {self.denominator})"


@dataclass(frozen=True)
class RootNode(ExpressionNode):
    """Represents a square root expression."""

    radicand: ExpressionNode

    def __str__(self) -> str:
        return f"sqrt({self.radicand})"


@dataclass(frozen=True)
class FunctionNode(ExpressionNode):
    """Represents a unary function expression."""

    name: str
    argument: ExpressionNode

    def __str__(self) -> str:
        return f"{self.name}({self.argument})"


@dataclass(frozen=True)
class GroupedNode(ExpressionNode):
    """Represents explicit parenthesized grouping."""

    inner: ExpressionNode

    def is_explicit_grouping(self) -> bool:
        return True

    def __str__(self) -> str:
        return str(self.inner)
