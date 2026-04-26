const TOKEN_TYPE = {
  NUMBER: "NUMBER",
  OPERATOR: "OPERATOR",
  FUNCTION: "FUNCTION",
  VARIABLE: "VARIABLE",
  EOF: "EOF",
};

const FUNCTION_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "log",
  "log2",
  "log10",
  "ln",
  "sqrt",
  "cbrt",
  "abs",
  "ceil",
  "floor",
  "exp",
  "arcsin",
  "arccos",
  "arctan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "lim",
  "sum",
  "prod",
  "max",
  "min",
  "det",
  "mod",
  "factorial",
  "fact",
  "pi",
  "inf",
  "infinity",
  "gcd",
  "lcm",
  "sign",
  "sgn",
]);

const CONSTANTS = new Set(["pi", "inf", "infinity", "e"]);

const LETTER_MAP = {
  a: "⠁",
  b: "⠃",
  c: "⠉",
  d: "⠙",
  e: "⠑",
  f: "⠋",
  g: "⠛",
  h: "⠓",
  i: "⠊",
  j: "⠚",
  k: "⠅",
  l: "⠇",
  m: "⠍",
  n: "⠝",
  o: "⠕",
  p: "⠏",
  q: "⠟",
  r: "⠗",
  s: "⠎",
  t: "⠞",
  u: "⠥",
  v: "⠧",
  w: "⠺",
  x: "⠭",
  y: "⠽",
  z: "⠵",
};

const TURKISH_MAP = {
  // Lowercase Turkish
  ç: "⠡",
  ğ: "⠣",
  ı: "⠔",   // dotless-i → ⠔ (was incorrectly ⠊)
  ö: "⠪",
  ş: "⠩",
  ü: "⠳",
  â: "⠁",
  î: "⠊",
  û: "⠥",
  // İ (U+0130) lowercases to 'i\u0307' (i + combining dot above)
  "i\u0307": "⠊",
  // Uppercase Turkish — braille cell (capital prefix added by translateWord)
  "İ": "⠊",  // U+0130 capital I-with-dot
  "I": "⠔",  // U+0049 undotted capital I (Turkish)
  "Ç": "⠡",
  "Ğ": "⠣",
  "Ö": "⠪",
  "Ş": "⠩",
  "Ü": "⠳",
};

const DIGIT_MAP = {
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
};

const PUNCTUATION_MAP = {
  // ── Standard punctuation ─────────────────────────────────────────
  ".": "⠲",  ",": "⠂",  "?": "⠦",  "!": "⠖",  ":": "⠒",
  ";": "⠆",  "-": "⠤",  "–": "⠤⠤",  "—": "⠤⠤⠤",
  "\"": "⠐⠦",  "\u201c": "⠦",  "\u201d": "⠴",
  "\u2018": "⠦",  "\u2019": "⠴",  "'": "⠄",
  "(": "⠐⠣",  ")": "⠐⠜",
  "[": "⠨⠣",  "]": "⠨⠜",
  "{": "⠸⠣",  "}": "⠸⠜",
  // ── Basic math operators ─────────────────────────────────────────
  "^": "⠘",     // superscript indicator
  "_": "⠰",     // subscript indicator
  "|": "⠳",     // absolute value
  "~": "⠈⠔",   // tilde / approx
  "×": "⠈⠡",   // × multiplication
  "÷": "⠌",     // ÷ division
  "±": "⠬⠤",   // ± plus-minus
  "∓": "⠤⠬",   // ∓ minus-plus
  // ── Comparison / equality ────────────────────────────────────────
  "≤": "⠐⠅⠨",  "≥": "⠈⠅⠨",
  "≠": "⠌⠅",   "≈": "⠈⠔",   "≡": "⠸⠅",
  "∼": "⠈⠔",   "≅": "⠸⠔",
  "≪": "⠐⠅⠐⠅", "≫": "⠈⠅⠈⠅",
  // ── Calculus / analysis ──────────────────────────────────────────
  "∞": "⠿",     // infinity
  "∑": "⠨⠎",   // summation
  "∏": "⠨⠏",   // product
  "∫": "⠮",    // integral
  "∬": "⠮⠮",   "∭": "⠮⠮⠮",  "∮": "⠮⠖",
  "∂": "⠨⠙",   // partial derivative
  "∇": "⠨⠝",   // nabla
  "∆": "⠨⠙",   // Laplacian
  "√": "⠜",    // square root
  "∛": "⠘⠉⠜",  "∜": "⠘⠙⠜",
  "∝": "⠳⠏",   // proportional to
  "°": "⠘⠴",   // degree
  "′": "⠄",    // prime
  "″": "⠄⠄",   // double prime
  "‴": "⠄⠄⠄",  // triple prime
  // ── Set theory ───────────────────────────────────────────────────
  "∅": "⠈⠚",  "∪": "⠨⠩",  "∩": "⠨⠫",
  "∈": "⠈⠑",  "∉": "⠈⠠⠑",
  "⊂": "⠘⠣",  "⊃": "⠘⠜",
  "⊆": "⠘⠣⠐", "⊇": "⠘⠜⠐",
  "∖": "⠸⠡",   // set difference ∖
  // ── Logic ────────────────────────────────────────────────────────
  "∧": "⠈⠯",  "∨": "⠈⠿",  "¬": "⠈⠹",
  "∀": "⠈⠁",  "∃": "⠈⠑⠭", "∄": "⠈⠠⠑⠭",
  // ── Arrows ───────────────────────────────────────────────────────
  "→": "⠳⠕",  "←": "⠳⠣",  "↔": "⠳⠕⠣",
  "↑": "⠳⠥",  "↓": "⠳⠙",
  "⟹": "⠳⠕",  "⟺": "⠳⠪",
  "⇒": "⠳⠕",  "⇐": "⠳⠣",  "⇔": "⠳⠪",
  // ── Greek (lowercase) ────────────────────────────────────────────
  "α": "⠁",  "β": "⠃",  "γ": "⠛",  "δ": "⠙",
  "ε": "⠑",  "ζ": "⠵",  "η": "⠓",  "θ": "⠹",
  "ι": "⠊",  "κ": "⠅",  "λ": "⠇",  "μ": "⠍",
  "ν": "⠝",  "ξ": "⠭",  "π": "⠨⠏", "ρ": "⠗",
  "σ": "⠎",  "τ": "⠞",  "φ": "⠋",  "χ": "⠡",
  "ψ": "⠽",  "ω": "⠺",
  // ── Greek (uppercase) ────────────────────────────────────────────
  "Α": "⠁",  "Β": "⠃",  "Γ": "⠛",  "Δ": "⠙",
  "Ε": "⠑",  "Θ": "⠹",  "Λ": "⠇",  "Ξ": "⠭",
  "Π": "⠨⠏", "Σ": "⠨⠎", "Φ": "⠋",  "Ψ": "⠽",
  "Ω": "⠺",
  // ── Superscript digits ────────────────────────────────────────────
  "⁰": "⠘⠚", "¹": "⠘⠁", "²": "⠘⠃", "³": "⠘⠉",
  "⁴": "⠘⠙", "⁵": "⠘⠑", "⁶": "⠘⠋", "⁷": "⠘⠛",
  "⁸": "⠘⠓", "⁹": "⠘⠊",
  // ── Subscript digits ─────────────────────────────────────────────
  "₀": "⠰⠚", "₁": "⠰⠁", "₂": "⠰⠃", "₃": "⠰⠉",
  "₄": "⠰⠙", "₅": "⠰⠑", "₆": "⠰⠋", "₇": "⠰⠛",
  "₈": "⠰⠓", "₉": "⠰⠊",
  // ── Vulgar fractions ─────────────────────────────────────────────
  "½": "⠹⠁⠌⠃⠼", "⅓": "⠹⠁⠌⠉⠼", "¼": "⠹⠁⠌⠙⠼",
  "¾": "⠹⠉⠌⠙⠼",  "⅔": "⠹⠃⠌⠉⠼",
  // ── Misc ─────────────────────────────────────────────────────────
  "⊥": "⠸⠂",  "∥": "⠸⠇",  "∟": "⠸⠣",
  // ── Whitespace ───────────────────────────────────────────────────
  " ": " ",  "\n": "\n",  "\t": " ",
  "\r": "",   "\v": "\n",  "\f": "\n",
};

const SYMBOL_MAP = {
  "+": "⠬",  "=": "⠨⠅",
  "/": "⠌",  "*": "⠈⠡",
  "<": "⠐⠅", ">": "⠈⠅",
  "@": "⠈⠁", "#": "⠼",
  "&": "⠠⠯", "%": "⠨⠴",
  "_": "⠰",  // subscript indicator (standard)
  // any symbol not in PUNCTUATION_MAP comes here as last resort
};

const OPERATOR_MAP = {
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
};

const FUNCTION_MAP = {
  sin: "⠎⠊⠝",
  cos: "⠉⠕⠎",
  tan: "⠞⠁⠝",
  cot: "⠉⠕⠞",
  sec: "⠎⠑⠉",
  csc: "⠉⠎⠉",
  arcsin: "⠁⠗⠉⠎⠊⠝",
  arccos: "⠁⠗⠉⠉⠕⠎",
  arctan: "⠁⠗⠉⠞⠁⠝",
  asin: "⠁⠗⠉⠎⠊⠝",
  acos: "⠁⠗⠉⠉⠕⠎",
  atan: "⠁⠗⠉⠞⠁⠝",
  sinh: "⠎⠊⠝⠓",
  cosh: "⠉⠕⠎⠓",
  tanh: "⠞⠁⠝⠓",
  log: "⠇⠕⠛",
  log2: "⠇⠕⠛⠼⠃",
  log10: "⠇⠕⠛⠼⠁⠚",
  ln: "⠇⠝",
  exp: "⠑⠭⠏",
  abs: "⠳",
  ceil: "⠈⠉⠑⠊⠇",
  floor: "⠈⠋⠇⠕⠕⠗",
  max: "⠍⠁⠭",
  min: "⠍⠊⠝",
  lim: "⠇⠊⠍",
  sum: "⠨⠎",
  prod: "⠨⠏",
  gcd: "⠛⠉⠙",
  lcm: "⠇⠉⠍",
  det: "⠙⠑⠞",
  mod: "⠍⠕⠙",
  sign: "⠎⠛⠝",
  sgn: "⠎⠛⠝",
  factorial: "⠖",
  fact: "⠖",
};

const CONSTANT_MAP = {
  pi: "⠨⠏",
  e: "⠑",
  inf: "⠿",
  infinity: "⠿",
};

function createToken(tokenType, value) {
  return {
    tokenType,
    value,
    isOperator(operator) {
      return this.tokenType === TOKEN_TYPE.OPERATOR && this.value === operator;
    },
  };
}

function createNumberNode(value) {
  return { type: "NumberNode", value };
}

function createVariableNode(name) {
  return { type: "VariableNode", name };
}

function createBinaryOpNode(operator, left, right, explicitGrouping = false) {
  return { type: "BinaryOpNode", operator, left, right, explicitGrouping };
}

function createFractionNode(numerator, denominator) {
  return { type: "FractionNode", numerator, denominator };
}

function createRootNode(radicand) {
  return { type: "RootNode", radicand };
}

function createFunctionNode(name, argument) {
  return { type: "FunctionNode", name, argument };
}

function createGroupedNode(inner) {
  return { type: "GroupedNode", inner };
}

function createNthRootNode(degree, radicand) {
  return { type: "NthRootNode", degree, radicand };
}

function createAbsoluteValueNode(inner) {
  return { type: "AbsoluteValueNode", inner };
}

function createConstantNode(name) {
  return { type: "ConstantNode", name };
}

function tokenizeMath(sourceText) {
  const source = sourceText ?? "";
  const tokens = [];
  let position = 0;

  function peek() {
    return source[position];
  }

  function advance() {
    position += 1;
  }

  function isAtEnd() {
    return position >= source.length;
  }

  function isOperator(character) {
    return ["+", "-", "*", "/", "=", "^", "_", "(", ")", ".", "·", ":", ",", "|", "~", "≤", "≥", "<", ">"].includes(character);
  }

  function readNumber() {
    const start = position;
    while (!isAtEnd() && /\d/.test(peek())) {
      advance();
    }
    return createToken(TOKEN_TYPE.NUMBER, source.slice(start, position));
  }

  function readIdentifier() {
    const start = position;
    while (!isAtEnd() && /[a-zA-Z0-9]/.test(peek())) {
      advance();
    }
    const lexeme = source.slice(start, position);
    const lower = lexeme.toLowerCase();
    if (FUNCTION_NAMES.has(lower)) {
      return createToken(TOKEN_TYPE.FUNCTION, lower);
    }
    return createToken(TOKEN_TYPE.VARIABLE, lexeme);
  }

  while (!isAtEnd()) {
    const current = peek();

    if (/\s/.test(current)) {
      advance();
      continue;
    }

    if (/\d/.test(current)) {
      tokens.push(readNumber());
      continue;
    }

    if (/[a-zA-Z]/.test(current)) {
      tokens.push(readIdentifier());
      continue;
    }

    if (isOperator(current)) {
      let operatorValue = current;
      if (operatorValue === "." || operatorValue === "·") {
        operatorValue = "*";
      } else if (operatorValue === ":") {
        operatorValue = "/";
      }
      tokens.push(createToken(TOKEN_TYPE.OPERATOR, operatorValue));
      advance();
      continue;
    }

    throw new Error(`Invalid character at index ${position}: '${current}'`);
  }

  tokens.push(createToken(TOKEN_TYPE.EOF, ""));
  return tokens;
}

class MathParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  parse() {
    const expression = this.parseEquality();
    this.consume(TOKEN_TYPE.EOF, "Unexpected trailing tokens.");
    return expression;
  }

  parseEquality() {
    let node = this.parseAdditive();
    while (this.matchOperator("=")) {
      node = createBinaryOpNode(this.previous().value, node, this.parseAdditive());
    }
    return node;
  }

  parseAdditive() {
    let node = this.parseMultiplicative();
    while (this.matchOperator("+") || this.matchOperator("-")) {
      node = createBinaryOpNode(this.previous().value, node, this.parseMultiplicative());
    }
    return node;
  }

  parseMultiplicative() {
    let node = this.parsePower();

    while (true) {
      if (this.matchOperator("*")) {
        node = createBinaryOpNode("*", node, this.parsePower());
      } else if (this.matchOperator("/")) {
        node = createFractionNode(node, this.parsePower());
      } else if (this.isImplicitMultiplicationAhead()) {
        node = createBinaryOpNode("*", node, this.parsePower());
      } else {
        break;
      }
    }

    return node;
  }

  parsePower() {
    let node = this.parseUnary();

    while (true) {
      if (this.matchOperator("^")) {
        node = createBinaryOpNode("^", node, this.parsePower());
        continue;
      }

      if (this.matchOperator("_")) {
        node = createBinaryOpNode("_", node, this.parseUnary());
        continue;
      }

      break;
    }

    return node;
  }

  parseUnary() {
    if (this.matchOperator("-")) {
      return createBinaryOpNode("-", createNumberNode("0"), this.parseUnary());
    }

    if (this.matchOperator("+")) {
      return this.parseUnary();
    }

    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match(TOKEN_TYPE.NUMBER)) {
      return createNumberNode(this.previous().value);
    }

    if (this.match(TOKEN_TYPE.FUNCTION)) {
      const functionName = this.previous().value;

      if (CONSTANTS.has(functionName)) {
        return createConstantNode(functionName);
      }

      if (functionName === "cbrt") {
        return createNthRootNode(3, this.parseFunctionArgument());
      }

      if (functionName === "sqrt") {
        return createRootNode(this.parseFunctionArgument());
      }

      if (functionName === "abs") {
        return createAbsoluteValueNode(this.parseFunctionArgument());
      }

      return createFunctionNode(functionName, this.parseFunctionArgument());
    }

    if (this.match(TOKEN_TYPE.VARIABLE)) {
      return createVariableNode(this.previous().value);
    }

    if (this.matchOperator("|")) {
      const inner = this.parseEquality();
      this.consumeOperator("|", "Mutlak değer ('|') kapatılmamış.");
      return createAbsoluteValueNode(inner);
    }

    if (this.matchOperator("(")) {
      const inner = this.parseEquality();
      this.consumeOperator(")", "İfadeden sonra ')' parantezi bekleniyor.");
      return this.markExplicitGrouping(inner);
    }

    const val = this.peek().value ? this.peek().value : "Cümlenin/İfadenin sonu (EOF)";
    throw new Error(`Eksik veya geçersiz matematiksel sembol. Beklenen: sayı, fonksiyon, değişken veya parantez. Alınan: '${val}' (Girdi düz yazı ise 'Translate text' kullanın)`);
  }

  parseFunctionArgument() {
    if (this.matchOperator("(")) {
      const inner = this.parseEquality();
      this.consumeOperator(")", "Fonksiyon argümanından sonra ')' parantezi bekleniyor.");
      return this.markExplicitGrouping(inner);
    }

    return this.parseUnary();
  }

  markExplicitGrouping(node) {
    if (node.type === "BinaryOpNode") {
      return createBinaryOpNode(node.operator, node.left, node.right, true);
    }
    return createGroupedNode(node);
  }

  isImplicitMultiplicationAhead() {
    const nextToken = this.peek();
    return (
      [TOKEN_TYPE.NUMBER, TOKEN_TYPE.FUNCTION, TOKEN_TYPE.VARIABLE].includes(nextToken.tokenType) ||
      nextToken.isOperator("(")
    );
  }

  match(tokenType) {
    if (this.check(tokenType)) {
      this.advance();
      return true;
    }
    return false;
  }

  matchOperator(operator) {
    if (this.checkOperator(operator)) {
      this.advance();
      return true;
    }
    return false;
  }

  consume(tokenType, message) {
    if (this.check(tokenType)) {
      return this.advance();
    }
    const val = this.peek().value ? this.peek().value : "Cümlenin/İfadenin sonu (EOF)";
    throw new Error(`${message} Bulunan: ${val}`);
  }

  consumeOperator(operator, message) {
    if (this.checkOperator(operator)) {
      return this.advance();
    }
    const val = this.peek().value ? this.peek().value : "Cümlenin/İfadenin sonu (EOF)";
    throw new Error(`${message} Bulunan: ${val}`);
  }


  check(tokenType) {
    return this.peek().tokenType === tokenType;
  }

  checkOperator(operator) {
    return this.peek().isOperator(operator);
  }

  advance() {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.previous();
  }

  isAtEnd() {
    return this.peek().tokenType === TOKEN_TYPE.EOF;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }
}

function translateNumber(value) {
  return `⠼${value
    .split("")
    .map((digit) => {
      if (!(digit in DIGIT_MAP)) {
        throw new Error(`Unsupported number character: ${digit}`);
      }
      return DIGIT_MAP[digit];
    })
    .join("")}`;
}

function translateVariable(variable) {
  return variable
    .split("")
    .map((character) => LETTER_MAP[character.toLowerCase()] ?? character)
    .join("");
}

function translateOperator(operator) {
  const mapped = OPERATOR_MAP[operator];
  if (!mapped) {
    throw new Error(`Unsupported operator: ${operator}`);
  }
  return mapped;
}

function wrapGrouping(content) {
  return `⠷ ${content} ⠾`;
}

function translateFunction(functionName, argument) {
  const mapped = FUNCTION_MAP[functionName];
  if (!mapped) {
    throw new Error(`Unsupported function: ${functionName}`);
  }

  if (functionName === "factorial" || functionName === "fact") {
    return `${translateMathNode(argument)}${mapped}`;
  }

  const translatedArgument = translateMathNode(argument);
  if (argument.type === "GroupedNode") {
    return `${mapped}${translatedArgument}`;
  }
  return `${mapped} ${translatedArgument}`;
}

function translateScript(base, script, indicator) {
  return `${translateMathNode(base)} ${indicator} ${translateMathNode(script)}`;
}

function translateMathNode(node) {
  switch (node.type) {
    case "ConstantNode":
      return CONSTANT_MAP[node.name.toLowerCase()] ?? node.name;
    case "GroupedNode":
      return wrapGrouping(translateMathNode(node.inner));
    case "NumberNode":
      return translateNumber(node.value);
    case "VariableNode":
      return translateVariable(node.name);
    case "FunctionNode":
      return translateFunction(node.name, node.argument);
    case "RootNode":
      return `⠜ ${translateMathNode(node.radicand)} ⠻`;
    case "NthRootNode":
      return `⠘${translateNumber(String(node.degree))}⠜ ${translateMathNode(node.radicand)} ⠻`;
    case "AbsoluteValueNode":
      return `⠳${translateMathNode(node.inner)}⠳`;
    case "FractionNode":
      return `⠹ ${translateMathNode(node.numerator)} ⠌ ${translateMathNode(node.denominator)} ⠼`;
    case "BinaryOpNode":
      if (node.operator === "^") {
        return translateScript(node.left, node.right, "⠘");
      }
      if (node.operator === "_") {
        return translateScript(node.left, node.right, "⠰");
      }
      {
        const content = `${translateMathNode(node.left)} ${translateOperator(node.operator)} ${translateMathNode(node.right)}`;
        return node.explicitGrouping ? wrapGrouping(content) : content;
      }
    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}

function translatePlainText(text) {
  const translateWord = (word, isAllCapsWord) => {
    const result = [];
    let inNumber = false;
    let scriptMode = null; // 'super' | 'sub' | null

    for (let ci = 0; ci < word.length; ci++) {
      const char = word[ci];

      // ── Script mode switches (^ and _) ──────────────────────────
      if (char === '^') {
        result.push('\u2818');       // superscript indicator
        scriptMode = 'super';
        inNumber = false;
        continue;
      }
      if (char === '_') {
        result.push('\u2830');       // subscript indicator
        scriptMode = 'sub';
        inNumber = false;
        continue;
      }

      // ── Letter ──────────────────────────────────────────────────
      if (char.toUpperCase() !== char.toLowerCase()) {
        inNumber = false;
        const lower = char.toLowerCase();
        const composed = lower.normalize ? lower.normalize('NFC') : lower;

        let braille =
          PUNCTUATION_MAP[char] ??   // Greek uppercase (Σ, Π, Ω …)
          TURKISH_MAP[char] ??       // Turkish uppercase (İ, I, Ç …)
          TURKISH_MAP[lower] ??      // Turkish lowercase (ç, ğ, ı …)
          TURKISH_MAP[composed] ??   // composed NFC form
          PUNCTUATION_MAP[lower] ??  // Greek lowercase (α, β, γ …)
          LETTER_MAP[lower] ??       // standard Latin
          char;

        if (scriptMode || isAllCapsWord) {
          result.push(braille);
          if (scriptMode) scriptMode = null;
          continue;
        }
        result.push(char === char.toUpperCase() ? `\u2820${braille}` : braille);
        continue;
      }

      // ── Digit ───────────────────────────────────────────────────
      if (/\d/.test(char)) {
        if (scriptMode) {
          // Superscript/subscript: no number indicator
          result.push(DIGIT_MAP[char]);
        } else {
          if (!inNumber) {
            result.push('\u283c');
            inNumber = true;
          }
          result.push(DIGIT_MAP[char]);
        }
        continue;
      }

      inNumber = false;
      scriptMode = null; // any other char exits script mode

      // ── Punctuation / symbol ────────────────────────────────────
      if (char in PUNCTUATION_MAP) {
        result.push(PUNCTUATION_MAP[char]);
      } else if (char in SYMBOL_MAP) {
        result.push(SYMBOL_MAP[char]);
      } else {
        result.push(char);
      }
    }

    return `${isAllCapsWord ? '\u2820\u2820' : ''}${result.join('')}`;
  };

  return text
    .split(/(\s+)/)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment)) {
        return segment;
      }
      const lettersOnly = segment.replace(/[^\p{L}]/gu, '');
      const isAllCapsWord = lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase() && lettersOnly !== lettersOnly.toLowerCase();
      return translateWord(segment, isAllCapsWord);
    })
    .join('');
}



function looksMathLike(line) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  // If the line is mostly prose (many words), treat as plain text even with some symbols
  const wordCount = trimmed.split(/\s+/).length;
  const letterRatio = (trimmed.match(/[a-zA-ZçğışıöüÇĞIŞİÖÜ]/g) || []).length / trimmed.length;
  if (wordCount >= 4 && letterRatio > 0.4) {
    return false;
  }

  if (/(sqrt|cbrt|log2|log10|log|ln|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|abs|ceil|floor|exp|lim|sum|prod|gcd|lcm|mod|fact|factorial)\s*\(?/i.test(trimmed)) {
    return true;
  }

  // Only trigger for = or ^ if it looks like a real math expression (not prose)
  if (/[=^_<>≤≥|]/.test(trimmed) && wordCount <= 3) {
    return true;
  }

  if (/\d\s*[+\-*/:·.]\s*\d/.test(trimmed)) {
    return true;
  }

  if (/[a-zA-Z]\s*[+\-*/=^_]\s*[a-zA-Z0-9]/.test(trimmed) && wordCount <= 3) {
    return true;
  }

  if (/^\(?\s*[a-zA-Z0-9]+\s*\/\s*[a-zA-Z0-9]+\s*\)?$/.test(trimmed)) {
    return true;
  }

  return false;
}

function convertLine(line) {
  if (!looksMathLike(line)) {
    return translatePlainText(line);
  }

  try {
    const tokens = tokenizeMath(line);
    const ast = new MathParser(tokens).parse();
    return translateMathNode(ast);
  } catch {
    // Fall back to plain text if a line only looked mathematical but did not parse cleanly.
    return translatePlainText(line);
  }
}

// This converter now supports plain text and math-like lines without needing a separate backend.
export function convertToBraille(text) {
  if (!text?.trim()) {
    return "";
  }

  return text
    .split("\n")
    .map((line) => convertLine(line))
    .join("\n");
}
