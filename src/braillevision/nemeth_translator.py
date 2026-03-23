from __future__ import annotations

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


class NemethTranslator:
    """Translates AST nodes into Nemeth Braille symbols."""

    NUMERIC_INDICATOR = "⠼"
    FRACTION_OPEN = "⠹"
    FRACTION_LINE = "⠌"
    FRACTION_CLOSE = "⠼"
    RADICAL_OPEN = "⠜"
    RADICAL_CLOSE = "⠻"

    DIGIT_MAP = {
        "1": "⠁",
        "2": "⠃",
        "3": "⠉",
        "4": "⠙",
        "5": "⠑",
        "6": "⠋",
        "7": "⠛",
        "8": "⠓",
        "9": "⠊",
        "0": "⠚",
    }

    OPERATOR_MAP = {
        "+": "⠬",
        "-": "⠤",
        "*": "⠈⠡",
        "/": "⠌",
        "=": "⠨⠅",
        "^": "⠘",
    }

    FUNCTION_MAP = {
        "sin": "⠎⠔",
        "cos": "⠉⠕⠎",
        "tan": "⠞⠁⠝",
    }

    LETTER_MAP = {
        "a": "⠁",
        "b": "⠃",
        "c": "⠉",
        "d": "⠙",
        "e": "⠑",
        "f": "⠋",
        "g": "⠛",
        "h": "⠓",
        "i": "⠊",
        "j": "⠚",
        "k": "⠅",
        "l": "⠇",
        "m": "⠍",
        "n": "⠝",
        "o": "⠕",
        "p": "⠏",
        "q": "⠟",
        "r": "⠗",
        "s": "⠎",
        "t": "⠞",
        "u": "⠥",
        "v": "⠧",
        "w": "⠺",
        "x": "⠭",
        "y": "⠽",
        "z": "⠵",
    }

    def translate(self, node: ExpressionNode) -> str:
        """Translates one AST node into Nemeth Braille."""
        if isinstance(node, GroupedNode):
            return self._wrap_grouping(self.translate(node.inner))

        if isinstance(node, NumberNode):
            return self._translate_number(node.value)

        if isinstance(node, VariableNode):
            return self._translate_variable(node.name)

        if isinstance(node, FunctionNode):
            return self._translate_function(node.name, node.argument)

        if isinstance(node, RootNode):
            return f"{self.RADICAL_OPEN} {self.translate(node.radicand)} {self.RADICAL_CLOSE}"

        if isinstance(node, FractionNode):
            numerator = self.translate(node.numerator)
            denominator = self.translate(node.denominator)
            return f"{self.FRACTION_OPEN} {numerator} {self.FRACTION_LINE} {denominator} {self.FRACTION_CLOSE}"

        if isinstance(node, BinaryOpNode):
            left = self.translate(node.left)
            operator = self._translate_operator(node.operator)
            right = self.translate(node.right)
            content = f"{left} {operator} {right}"
            if node.is_explicit_grouping():
                return self._wrap_grouping(content)
            return content

        raise ValueError(f"Unsupported node type: {type(node).__name__}")

    def _translate_number(self, value: str) -> str:
        translated_digits = []
        for digit in value:
            mapped = self.DIGIT_MAP.get(digit)
            if mapped is None:
                raise ValueError(f"Unsupported number character: {digit}")
            translated_digits.append(mapped)
        return self.NUMERIC_INDICATOR + "".join(translated_digits)

    def _translate_variable(self, variable: str) -> str:
        translated_letters = []
        for character in variable:
            mapped = self.LETTER_MAP.get(character.lower())
            translated_letters.append(mapped if mapped is not None else character)
        return "".join(translated_letters)

    def _translate_operator(self, operator: str) -> str:
        mapped = self.OPERATOR_MAP.get(operator)
        if mapped is None:
            raise ValueError(f"Unsupported operator: {operator}")
        return mapped

    def _translate_function(self, function_name: str, argument: ExpressionNode) -> str:
        mapped = self.FUNCTION_MAP.get(function_name)
        if mapped is None:
            raise ValueError(f"Unsupported function: {function_name}")
        return f"{mapped} {self.translate(argument)}"

    @staticmethod
    def _wrap_grouping(content: str) -> str:
        return f"⠷ {content} ⠾"
