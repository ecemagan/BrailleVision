# Nemeth Pipeline Validation Report

Generated: 2026-03-24T01:33:46.1943372

## Summary

- Total cases: 6
- Passed: 6
- Failed: 0

## Structured Results

| Case | Expression | Lexer | Parser | Nemeth | Result |
|---|---|---|---|---|---|
| G001 | sqrt((1+2)/(3+4)) | PASS | PASS | PASS | PASS |
| G002 | sin(x)^2 + cos(3/4) | PASS | PASS | PASS | PASS |
| G003 | 2(x+1)/tan(y) | PASS | PASS | PASS | PASS |
| G004 | 2 + 3 * 4 | PASS | PASS | PASS | PASS |
| G005 | (2 + 3) * 4 | PASS | PASS | PASS | PASS |
| G006 | sqrt(x) + 1/2 = 5 | PASS | PASS | PASS | PASS |

## Case Details

### G001 - PASS

Expression: `sqrt((1+2)/(3+4))`

Tokens: PASS

Expected:

```
[Token(FUNCTION, 'sqrt'), Token(OPERATOR, '('), Token(OPERATOR, '('), Token(NUMBER, '1'), Token(OPERATOR, '+'), Token(NUMBER, '2'), Token(OPERATOR, ')'), Token(OPERATOR, '/'), Token(OPERATOR, '('), Token(NUMBER, '3'), Token(OPERATOR, '+'), Token(NUMBER, '4'), Token(OPERATOR, ')'), Token(OPERATOR, ')'), Token(EOF, '')]
```

Actual:

```
[Token(FUNCTION, 'sqrt'), Token(OPERATOR, '('), Token(OPERATOR, '('), Token(NUMBER, '1'), Token(OPERATOR, '+'), Token(NUMBER, '2'), Token(OPERATOR, ')'), Token(OPERATOR, '/'), Token(OPERATOR, '('), Token(NUMBER, '3'), Token(OPERATOR, '+'), Token(NUMBER, '4'), Token(OPERATOR, ')'), Token(OPERATOR, ')'), Token(EOF, '')]
```

AST: PASS

Expected:

```
sqrt(((1 + 2) / (3 + 4)))
```

Actual:

```
sqrt(((1 + 2) / (3 + 4)))
```

Nemeth: PASS

Expected:

```
⠜ ⠷ ⠹ ⠷ ⠼⠁ ⠬ ⠼⠃ ⠾ ⠌ ⠷ ⠼⠉ ⠬ ⠼⠙ ⠾ ⠼ ⠾ ⠻
```

Actual:

```
⠜ ⠷ ⠹ ⠷ ⠼⠁ ⠬ ⠼⠃ ⠾ ⠌ ⠷ ⠼⠉ ⠬ ⠼⠙ ⠾ ⠼ ⠾ ⠻
```

### G002 - PASS

Expression: `sin(x)^2 + cos(3/4)`

Tokens: PASS

Expected:

```
[Token(FUNCTION, 'sin'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, ')'), Token(OPERATOR, '^'), Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(FUNCTION, 'cos'), Token(OPERATOR, '('), Token(NUMBER, '3'), Token(OPERATOR, '/'), Token(NUMBER, '4'), Token(OPERATOR, ')'), Token(EOF, '')]
```

Actual:

```
[Token(FUNCTION, 'sin'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, ')'), Token(OPERATOR, '^'), Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(FUNCTION, 'cos'), Token(OPERATOR, '('), Token(NUMBER, '3'), Token(OPERATOR, '/'), Token(NUMBER, '4'), Token(OPERATOR, ')'), Token(EOF, '')]
```

AST: PASS

Expected:

```
((sin(x) ^ 2) + cos((3 / 4)))
```

Actual:

```
((sin(x) ^ 2) + cos((3 / 4)))
```

Nemeth: PASS

Expected:

```
⠎⠔ ⠷ ⠭ ⠾ ⠘ ⠼⠃ ⠬ ⠉⠕⠎ ⠷ ⠹ ⠼⠉ ⠌ ⠼⠙ ⠼ ⠾
```

Actual:

```
⠎⠔ ⠷ ⠭ ⠾ ⠘ ⠼⠃ ⠬ ⠉⠕⠎ ⠷ ⠹ ⠼⠉ ⠌ ⠼⠙ ⠼ ⠾
```

### G003 - PASS

Expression: `2(x+1)/tan(y)`

Tokens: PASS

Expected:

```
[Token(NUMBER, '2'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, '+'), Token(NUMBER, '1'), Token(OPERATOR, ')'), Token(OPERATOR, '/'), Token(FUNCTION, 'tan'), Token(OPERATOR, '('), Token(VARIABLE, 'y'), Token(OPERATOR, ')'), Token(EOF, '')]
```

Actual:

```
[Token(NUMBER, '2'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, '+'), Token(NUMBER, '1'), Token(OPERATOR, ')'), Token(OPERATOR, '/'), Token(FUNCTION, 'tan'), Token(OPERATOR, '('), Token(VARIABLE, 'y'), Token(OPERATOR, ')'), Token(EOF, '')]
```

AST: PASS

Expected:

```
((2 * (x + 1)) / tan(y))
```

Actual:

```
((2 * (x + 1)) / tan(y))
```

Nemeth: PASS

Expected:

```
⠹ ⠼⠃ ⠈⠡ ⠷ ⠭ ⠬ ⠼⠁ ⠾ ⠌ ⠞⠁⠝ ⠷ ⠽ ⠾ ⠼
```

Actual:

```
⠹ ⠼⠃ ⠈⠡ ⠷ ⠭ ⠬ ⠼⠁ ⠾ ⠌ ⠞⠁⠝ ⠷ ⠽ ⠾ ⠼
```

### G004 - PASS

Expression: `2 + 3 * 4`

Tokens: PASS

Expected:

```
[Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(NUMBER, '3'), Token(OPERATOR, '*'), Token(NUMBER, '4'), Token(EOF, '')]
```

Actual:

```
[Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(NUMBER, '3'), Token(OPERATOR, '*'), Token(NUMBER, '4'), Token(EOF, '')]
```

AST: PASS

Expected:

```
(2 + (3 * 4))
```

Actual:

```
(2 + (3 * 4))
```

Nemeth: PASS

Expected:

```
⠼⠃ ⠬ ⠼⠉ ⠈⠡ ⠼⠙
```

Actual:

```
⠼⠃ ⠬ ⠼⠉ ⠈⠡ ⠼⠙
```

### G005 - PASS

Expression: `(2 + 3) * 4`

Tokens: PASS

Expected:

```
[Token(OPERATOR, '('), Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(NUMBER, '3'), Token(OPERATOR, ')'), Token(OPERATOR, '*'), Token(NUMBER, '4'), Token(EOF, '')]
```

Actual:

```
[Token(OPERATOR, '('), Token(NUMBER, '2'), Token(OPERATOR, '+'), Token(NUMBER, '3'), Token(OPERATOR, ')'), Token(OPERATOR, '*'), Token(NUMBER, '4'), Token(EOF, '')]
```

AST: PASS

Expected:

```
((2 + 3) * 4)
```

Actual:

```
((2 + 3) * 4)
```

Nemeth: PASS

Expected:

```
⠷ ⠼⠃ ⠬ ⠼⠉ ⠾ ⠈⠡ ⠼⠙
```

Actual:

```
⠷ ⠼⠃ ⠬ ⠼⠉ ⠾ ⠈⠡ ⠼⠙
```

### G006 - PASS

Expression: `sqrt(x) + 1/2 = 5`

Tokens: PASS

Expected:

```
[Token(FUNCTION, 'sqrt'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, ')'), Token(OPERATOR, '+'), Token(NUMBER, '1'), Token(OPERATOR, '/'), Token(NUMBER, '2'), Token(OPERATOR, '='), Token(NUMBER, '5'), Token(EOF, '')]
```

Actual:

```
[Token(FUNCTION, 'sqrt'), Token(OPERATOR, '('), Token(VARIABLE, 'x'), Token(OPERATOR, ')'), Token(OPERATOR, '+'), Token(NUMBER, '1'), Token(OPERATOR, '/'), Token(NUMBER, '2'), Token(OPERATOR, '='), Token(NUMBER, '5'), Token(EOF, '')]
```

AST: PASS

Expected:

```
((sqrt(x) + (1 / 2)) = 5)
```

Actual:

```
((sqrt(x) + (1 / 2)) = 5)
```

Nemeth: PASS

Expected:

```
⠜ ⠷ ⠭ ⠾ ⠻ ⠬ ⠹ ⠼⠁ ⠌ ⠼⠃ ⠼ ⠨⠅ ⠼⠑
```

Actual:

```
⠜ ⠷ ⠭ ⠾ ⠻ ⠬ ⠹ ⠼⠁ ⠌ ⠼⠃ ⠼ ⠨⠅ ⠼⠑
```

