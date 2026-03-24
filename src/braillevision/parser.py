from __future__ import annotations

from typing import List

from .ast_nodes import (
    BinaryOpNode,
    ExpressionNode,
    FractionNode,
    FunctionNode,
    GroupedNode,
    NumberNode,
    RootNode,
    VariableNode,
)
from .token_model import Token, TokenType


class Parser:
    """Recursive descent parser for mathematical expressions."""

    def __init__(self, tokens: List[Token]) -> None:
        self.tokens = tokens
        self.current = 0

    def parse(self) -> ExpressionNode:
        """Parses all tokens into an AST."""
        expression = self._parse_equality()
        self._consume(TokenType.EOF, "Unexpected trailing tokens.")
        return expression

    def _parse_equality(self) -> ExpressionNode:
        node = self._parse_additive()

        while self._match_operator("="):
            operator = self._previous().value
            right = self._parse_additive()
            node = BinaryOpNode(operator, node, right)

        return node

    def _parse_additive(self) -> ExpressionNode:
        node = self._parse_multiplicative()

        while self._match_operator("+") or self._match_operator("-"):
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
        return self._parse_primary()

    def _parse_primary(self) -> ExpressionNode:
        if self._match(TokenType.NUMBER):
            return NumberNode(self._previous().value)

        if self._match(TokenType.FUNCTION):
            function_name = self._previous().value
            argument = self._parse_function_argument()

            if function_name == "sqrt":
                return RootNode(argument)
            return FunctionNode(function_name, argument)

        if self._match(TokenType.VARIABLE):
            return VariableNode(self._previous().value)

        if self._match_operator("("):
            inner = self._parse_equality()
            self._consume_operator(")", "Expected ')' after expression.")
            return self._mark_explicit_grouping(inner)

        raise ValueError(f"Expected number, function, variable, or parenthesized expression. Found token: {self._peek()}")

    def _parse_function_argument(self) -> ExpressionNode:
        if self._match_operator("("):
            inner = self._parse_equality()
            self._consume_operator(")", "Expected ')' after function argument.")
            return self._mark_explicit_grouping(inner)

        return self._parse_unary()

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
        raise ValueError(f"{message} Found token: {self._peek()}")

    def _consume_operator(self, operator: str, message: str) -> Token:
        if self._check_operator(operator):
            return self._advance()
        raise ValueError(f"{message} Found token: {self._peek()}")

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
