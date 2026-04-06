from __future__ import annotations

from .ast_nodes import (
    AbsoluteValueNode,
    BinaryOpNode,
    ConstantNode,
    ExpressionNode,
    FractionNode,
    FunctionNode,
    GroupedNode,
    NthRootNode,
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
    SUPERSCRIPT_INDICATOR = "⠘"
    SUBSCRIPT_INDICATOR = "⠰"
    ABS_OPEN = "⠳"
    ABS_CLOSE = "⠳"

    DIGIT_MAP = {
        "1": "⠁", "2": "⠃", "3": "⠉", "4": "⠙", "5": "⠑",
        "6": "⠋", "7": "⠛", "8": "⠓", "9": "⠊", "0": "⠚",
    }

    OPERATOR_MAP = {
        "+": "⠬",
        "-": "⠤",
        "*": "⠈⠡",
        "/": "⠌",
        "=": "⠨⠅",
        "<": "⠐⠅",
        ">": "⠈⠅",
        "≤": "⠐⠅⠨",
        "≥": "⠈⠅⠨",
        ",": "⠂",
    }

    FUNCTION_MAP = {
        # Trig
        "sin":    "⠎⠊⠝",
        "cos":    "⠉⠕⠎",
        "tan":    "⠞⠁⠝",
        "cot":    "⠉⠕⠞",
        "sec":    "⠎⠑⠉",
        "csc":    "⠉⠎⠉",

        # Inverse trig
        "arcsin": "⠁⠗⠉⠎⠊⠝",
        "arccos": "⠁⠗⠉⠉⠕⠎",
        "arctan": "⠁⠗⠉⠞⠁⠝",
        "asin":   "⠁⠗⠉⠎⠊⠝",
        "acos":   "⠁⠗⠉⠉⠕⠎",
        "atan":   "⠁⠗⠉⠞⠁⠝",

        # Hyperbolic
        "sinh":   "⠎⠊⠝⠓",
        "cosh":   "⠉⠕⠎⠓",
        "tanh":   "⠞⠁⠝⠓",

        # Log
        "log":    "⠇⠕⠛",
        "log2":   "⠇⠕⠛⠼⠃",
        "log10":  "⠇⠕⠛⠼⠁⠚",
        "ln":     "⠇⠝",

        # Other
        "exp":    "⠑⠭⠏",
        "abs":    "⠳",          # opening abs bar (will be wrapped)
        "ceil":   "⠈⠉⠑⠊⠇",
        "floor":  "⠈⠋⠇⠕⠕⠗",
        "max":    "⠍⠁⠭",
        "min":    "⠍⠊⠝",
        "lim":    "⠇⠊⠍",
        "sum":    "⠨⠎",
        "prod":   "⠨⠏",
        "gcd":    "⠛⠉⠙",
        "lcm":    "⠇⠉⠍",
        "det":    "⠙⠑⠞",
        "mod":    "⠍⠕⠙",
        "sign":   "⠎⠛⠝",
        "sgn":    "⠎⠛⠝",
        "factorial": "⠖",
        "fact":   "⠖",
    }

    CONSTANT_MAP = {
        "pi":       "⠨⠏",
        "e":        "⠑",
        "inf":      "⠿",
        "infinity": "⠿",
    }

    LETTER_MAP = {
        "a": "⠁", "b": "⠃", "c": "⠉", "d": "⠙", "e": "⠑",
        "f": "⠋", "g": "⠛", "h": "⠓", "i": "⠊", "j": "⠚",
        "k": "⠅", "l": "⠇", "m": "⠍", "n": "⠝", "o": "⠕",
        "p": "⠏", "q": "⠟", "r": "⠗", "s": "⠎", "t": "⠞",
        "u": "⠥", "v": "⠧", "w": "⠺", "x": "⠭", "y": "⠽",
        "z": "⠵",
    }

    def translate(self, node: ExpressionNode) -> str:
        """Translates one AST node into Nemeth Braille."""

        if isinstance(node, ConstantNode):
            mapped = self.CONSTANT_MAP.get(node.name.lower())
            return mapped if mapped else node.name

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

        if isinstance(node, NthRootNode):
            # Nemeth nth root: degree indicator before radical
            degree_str = self._translate_number(str(node.degree))
            return f"{self.SUPERSCRIPT_INDICATOR}{degree_str}{self.RADICAL_OPEN} {self.translate(node.radicand)} {self.RADICAL_CLOSE}"

        if isinstance(node, AbsoluteValueNode):
            return f"{self.ABS_OPEN}{self.translate(node.inner)}{self.ABS_CLOSE}"

        if isinstance(node, FractionNode):
            numerator = self.translate(node.numerator)
            denominator = self.translate(node.denominator)
            return f"{self.FRACTION_OPEN} {numerator} {self.FRACTION_LINE} {denominator} {self.FRACTION_CLOSE}"

        if isinstance(node, BinaryOpNode):
            if node.operator == "^":
                return self._translate_script(node.left, node.right, self.SUPERSCRIPT_INDICATOR)

            if node.operator == "_":
                return self._translate_script(node.left, node.right, self.SUBSCRIPT_INDICATOR)

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

        # Factorial / sign functions are postfix-style in some notations
        if function_name in {"factorial", "fact"}:
            return f"{self.translate(argument)}{mapped}"

        translated_argument = self.translate(argument)
        if isinstance(argument, GroupedNode):
            return f"{mapped}{translated_argument}"
        return f"{mapped} {translated_argument}"

    def _translate_script(self, base: ExpressionNode, script: ExpressionNode, indicator: str) -> str:
        """Translates Nemeth superscript or subscript notation."""
        return f"{self.translate(base)} {indicator} {self.translate(script)}"

    @staticmethod
    def _wrap_grouping(content: str) -> str:
        return f"⠷ {content} ⠾"
