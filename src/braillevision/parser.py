from __future__ import annotations

from typing import List

from .ast_nodes import (
    AbsoluteValueNode,
    BinaryOpNode,
    ConstantNode,
    DerivativeNode,
    ExpressionNode,
    FractionNode,
    FunctionNode,
    GroupedNode,
    IntegralNode,
    NthRootNode,
    NumberNode,
    RootNode,
    VariableNode,
)
from .token_model import Token, TokenType

# Functions that take exactly two comma-separated arguments
TWO_ARG_FUNCTIONS = frozenset({"log", "log2", "log10", "gcd", "lcm", "max", "min"})

# Named constants (treated as zero-arg functions/keywords)
CONSTANTS = frozenset({"pi", "inf", "infinity", "e"})

# Calculus functions
INTEGRAL_FUNCTIONS = frozenset({"int", "integral"})
DERIVATIVE_FUNCTIONS = frozenset({"diff", "deriv", "derivative", "partial"})


class Parser:
    """Recursive descent parser for mathematical expressions."""

    def __init__(self, tokens: List[Token]) -> None:
        self.tokens = tokens
        self.current = 0

    def parse(self) -> ExpressionNode:
        """Parses all tokens into an AST."""
        expression = self._parse_comma_sequence()
        self._consume(TokenType.EOF, "Unexpected trailing tokens.")
        return expression

    def _parse_comma_sequence(self) -> ExpressionNode:
        node = self._parse_equality()
        while self._match_operator(","):
            right = self._parse_equality()
            node = BinaryOpNode(",", node, right)
        return node

    def _parse_equality(self) -> ExpressionNode:
        node = self._parse_additive()

        while (self._match_operator("=") or self._match_operator("<") or 
               self._match_operator(">") or self._match_operator("≤") or 
               self._match_operator("≥") or self._match_operator("⇔") or 
               self._match_operator("⇐") or self._match_operator("⇒") or 
               self._match_operator("≡") or self._match_operator("∈") or 
               self._match_operator("∉") or self._match_operator("⊂") or 
               self._match_operator("⊃")):
            operator = self._previous().value
            right = self._parse_additive()
            node = BinaryOpNode(operator, node, right)

        return node

    def _parse_additive(self) -> ExpressionNode:
        node = self._parse_multiplicative()

        while (self._match_operator("+") or self._match_operator("-") or 
               self._match_operator("∪") or self._match_operator("∩") or 
               self._match_operator("\\") or self._match_operator("&")):
            operator = self._previous().value
            right = self._parse_multiplicative()
            node = BinaryOpNode(operator, node, right)

        return node

    def _parse_multiplicative(self) -> ExpressionNode:
        node = self._parse_power()

        while True:
            if self._match_operator("*"):
                right = self._parse_power()
                node = BinaryOpNode("*", node, right)
            elif self._match_operator("/"):
                denominator = self._parse_power()
                node = FractionNode(node, denominator)
            elif self._is_implicit_multiplication_ahead():
                right = self._parse_power()
                node = BinaryOpNode("*", node, right)
            else:
                break

        return node

    def _parse_power(self) -> ExpressionNode:
        node = self._parse_unary()

        while True:
            if self._match_operator("^"):
                right = self._parse_power()
                node = BinaryOpNode("^", node, right)
                continue

            if self._match_operator("_"):
                right = self._parse_unary()
                node = BinaryOpNode("_", node, right)
                continue

            break

        return node

    def _parse_unary(self) -> ExpressionNode:
        if self._match_operator("-"):
            return BinaryOpNode("-", NumberNode("0"), self._parse_unary())
        if self._match_operator("+"):
            return self._parse_unary()
        return self._parse_primary()

    def _parse_primary(self) -> ExpressionNode:
        if self._match(TokenType.NUMBER):
            return NumberNode(self._previous().value)

        if self._match(TokenType.FUNCTION):
            function_name = self._previous().value

            # Named constants – no argument needed
            if function_name in CONSTANTS:
                return ConstantNode(function_name)

            # Integral: int(integrand, var) or int(integrand, var, lower, upper)
            if function_name in INTEGRAL_FUNCTIONS:
                return self._parse_integral(function_name == "partial")

            # Derivative: diff(expr, var) or diff(expr, var, order)
            if function_name in DERIVATIVE_FUNCTIONS:
                return self._parse_derivative(function_name == "partial")

            # cbrt → NthRootNode(degree=3)
            if function_name == "cbrt":
                argument = self._parse_function_argument()
                return NthRootNode(3, argument)

            # sqrt → RootNode
            if function_name == "sqrt":
                argument = self._parse_function_argument()
                return RootNode(argument)

            # abs → AbsoluteValueNode  (abs(...) style)
            if function_name == "abs":
                argument = self._parse_function_argument()
                return AbsoluteValueNode(argument)

            # General single-argument function
            argument = self._parse_function_argument()
            return FunctionNode(function_name, argument)

        if self._match(TokenType.VARIABLE):
            name = self._previous().value
            if name == "∅":
                return ConstantNode(name)
            node: ExpressionNode = VariableNode(name)
            # Handle prime notation: f'(x), f''(x) ...
            if self._peek().is_operator("'") or self._peek().is_operator("''") or self._peek().is_operator("'''"):
                prime_tok = self._advance()
                order = len(prime_tok.value)  # number of quotes
                deriv_node = DerivativeNode(node, "x", order=order, prime=True)
                return deriv_node
            return node

        # Absolute value: |expr|
        if self._match_operator("|"): 
            inner = self._parse_equality()
            self._consume_operator("|", "Expected closing '|' for absolute value.")
            return AbsoluteValueNode(inner)

        if self._match_operator("("):
            inner = self._parse_comma_sequence()
            self._consume_operator(")", "İfadeden sonra ')' parantezi bekleniyor.")
            return self._mark_explicit_grouping(inner)

        if self._match_operator("∫"):
            return ConstantNode("∫")
        if self._match_operator("∂"):
            return ConstantNode("∂")

        raise ValueError(f"Eksik veya geçersiz matematiksel sembol. Beklenen: sayı, fonksiyon, değişken veya parantez. Alınan: '{self._peek().value}' (İletilen metin sadece düz yazı ise, lütfen 'Translate text' seçeneğini kullanın)")

    def _parse_function_argument(self) -> ExpressionNode:
        if self._match_operator("("):
            inner = self._parse_comma_sequence()
            self._consume_operator(")", "Fonksiyon argümanından sonra ')' parantezi bekleniyor.")
            return self._mark_explicit_grouping(inner)

        return self._parse_unary()

    def _parse_integral(self, is_partial: bool = False) -> ExpressionNode:
        """Parse int(integrand, var) or int(integrand, var, lower, upper)."""
        if not self._check_operator("("):
            return ConstantNode("∫")
        self._consume_operator("(", "Expected '(' after 'int'.")
        integrand = self._parse_equality()
        self._consume_operator(",", "Expected ',' after integrand in int().")
        var_tok = self._consume(TokenType.VARIABLE, "Expected variable after ',' in int().")
        variable = var_tok.value

        # Check for limits: int(f, x, lower, upper)
        lower = None
        upper = None
        if self._match_operator(","):
            lower = self._parse_equality()
            self._consume_operator(",", "Expected ',' between lower and upper bounds.")
            upper = self._parse_equality()

        self._consume_operator(")", "Expected ')' to close int().")
        return IntegralNode(integrand, variable, lower, upper)

    def _parse_derivative(self, is_partial: bool = False) -> ExpressionNode:
        """Parse diff(expr, var) or diff(expr, var, order)."""
        if not self._check_operator("("):
            return ConstantNode("∂") if is_partial else VariableNode(self._previous().value)
        self._consume_operator("(", "Expected '(' after 'diff'.")
        expression = self._parse_equality()
        self._consume_operator(",", "Expected ',' after expression in diff().")
        var_tok = self._consume(TokenType.VARIABLE, "Expected variable after ',' in diff().")
        variable = var_tok.value

        order = 1
        if self._match_operator(","):
            order_node = self._parse_equality()
            # Try to get integer order from NumberNode
            from .ast_nodes import NumberNode as _NNode
            if isinstance(order_node, _NNode):
                order = int(order_node.value)

        self._consume_operator(")", "Expected ')' to close diff().")
        return DerivativeNode(expression, variable, order=order, prime=False)

    @staticmethod
    def _mark_explicit_grouping(node: ExpressionNode) -> ExpressionNode:
        if isinstance(node, BinaryOpNode):
            return node.as_explicit_grouping()
        return GroupedNode(node)

    def _is_implicit_multiplication_ahead(self) -> bool:
        next_token = self._peek()
        return (
            next_token.token_type in {TokenType.NUMBER, TokenType.FUNCTION, TokenType.VARIABLE}
            or next_token.is_operator("(")
            or next_token.is_operator("∫")
            or next_token.is_operator("∂")
            or next_token.is_operator("|")
        )

    def _match(self, token_type: TokenType) -> bool:
        if self._check(token_type):
            self._advance()
            return True
        return False

    def _match_operator(self, operator: str) -> bool:
        if self._check_operator(operator):
            self._advance()
            return True
        return False

    def _consume(self, token_type: TokenType, message: str) -> Token:
        if self._check(token_type):
            return self._advance()
        val = self._peek().value if self._peek().value else "Cümlenin/İfadenin sonu (EOF)"
        raise ValueError(f"{message} Bulunan: {val}")

    def _consume_operator(self, operator: str, message: str) -> Token:
        if self._check_operator(operator):
            return self._advance()
        val = self._peek().value if self._peek().value else "Cümlenin/İfadenin sonu (EOF)"
        raise ValueError(f"{message} Bulunan: {val}")

    def _check(self, token_type: TokenType) -> bool:
        return self._peek().token_type is token_type

    def _check_operator(self, operator: str) -> bool:
        return self._peek().is_operator(operator)

    def _advance(self) -> Token:
        if not self._is_at_end():
            self.current += 1
        return self._previous()

    def _is_at_end(self) -> bool:
        return self._peek().token_type is TokenType.EOF

    def _peek(self) -> Token:
        return self.tokens[self.current]

    def _previous(self) -> Token:
        return self.tokens[self.current - 1]
