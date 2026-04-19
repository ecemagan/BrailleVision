import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from braillevision.lexer import Lexer
from braillevision.parser import Parser
from braillevision.ast_nodes import *

examples = [
    "int(u * diff(v, x), x) = u * v - int(v * diff(u, x), x)",
    "int(exp(-x^2), x, -inf, inf) = sqrt(pi)",
    "∫ ∫ (x^2 + y^2) = 0",
    "f'(g(x)) * g'(x) = d/dx(f(g(x)))",
    "diff(sin(x^2), x, 2) + cos(x) = 0",
    "lim(1 + 1/n)^n = e",
    "exp(pi * i) + 1 = 0",
    "arcsin(x) + arccos(x) = pi / 2",
    "sinh(x) = (exp(x) - exp(-x)) / 2",
    "(A ∪ B)^c ≡ A^c ∩ B^c",
    "x ∈ A ⇔ x ∉ A^c",
    "∅ ⊂ R ⇒ R ∪ ∅ = R",
    "det(A * B) = det(A) * det(B)",
    "abs(x) = sqrt(x^2)",
    "max(x, y) = (x + y + abs(x - y)) / 2",
    "fact(n) = n * fact(n - 1)"
]

for ex in examples:
    try:
        tokens = Lexer(ex).tokenize()
        Parser(tokens).parse()
        print(f"SUCCESS: {ex}")
    except Exception as e:
        print(f"FAILED: {ex} -> {e}")

