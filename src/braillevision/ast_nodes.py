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


@dataclass(frozen=True)
class NthRootNode(ExpressionNode):
    """Represents an nth root (e.g. cbrt = cube root)."""

    degree: int
    radicand: ExpressionNode

    def __str__(self) -> str:
        return f"root({self.degree}, {self.radicand})"


@dataclass(frozen=True)
class AbsoluteValueNode(ExpressionNode):
    """Represents |expression|."""

    inner: ExpressionNode

    def __str__(self) -> str:
        return f"|{self.inner}|"


@dataclass(frozen=True)
class ConstantNode(ExpressionNode):
    """Represents a named constant like pi, e, inf."""

    name: str

    def __str__(self) -> str:
        return self.name


@dataclass(frozen=True)
class IntegralNode(ExpressionNode):
    """Represents an integral expression: ∫ integrand d(variable).
    lower and upper are None for indefinite integrals.
    """

    integrand: ExpressionNode
    variable: str
    lower: ExpressionNode | None = None
    upper: ExpressionNode | None = None

    def __str__(self) -> str:
        limits = f"_{self.lower}^{self.upper}" if self.lower is not None else ""
        return f"∫{limits} {self.integrand} d{self.variable}"


@dataclass(frozen=True)
class DerivativeNode(ExpressionNode):
    """Represents a derivative expression: d^n f / d variable^n.
    order=1 is first derivative, order=2 is second derivative, etc.
    prime=True means f'(x) notation.
    """

    expression: ExpressionNode
    variable: str
    order: int = 1
    prime: bool = False

    def __str__(self) -> str:
        if self.prime:
            marks = "'" * self.order
            return f"f{marks}({self.variable})"
        sup = f"^{self.order}" if self.order > 1 else ""
        return f"d{sup}/d{self.variable}{sup} ({self.expression})"
