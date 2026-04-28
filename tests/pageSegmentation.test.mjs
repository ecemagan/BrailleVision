import test from "node:test";
import assert from "node:assert/strict";

import {
  inspectPageSegmentation,
  normalizeNthRoots,
  normalizeRootRadicands,
  segmentPlainTextPage,
} from "../lib/pageSegmentation.js";
import { segmentPageIntoBlocks, sortLayoutLinesByReadingOrder } from "../lib/pageSegmentation.js";

test("segments headings and paragraphs into separate blocks", () => {
  const pageText = [
    "CHAPTER 2 LIMITS",
    "",
    "The limit of f(x) as x approaches c is L.",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "chapter_header");
  assert.equal(blocks[1].type, "paragraph");
});

test("groups multi-line math derivations as one equation_group with children", () => {
  const pageText = [
    "x^2 + 2x + 1 = (x+1)^2",
    "= x^2 + 2x + 1",
    "= (x+1)(x+1)",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "equation_group");
  assert.ok(Array.isArray(blocks[0].children));
  assert.equal(blocks[0].children.length, 3);
  assert.equal(blocks[0].children[0].originalContent, "x^2 + 2x + 1 = (x+1)^2");
});

test("does not absorb surrounding prose into equation_group", () => {
  const pageText = [
    "x^2 + 2x + 1 = (x+1)^2",
    "= x^2 + 2x + 1",
    "Therefore the identity holds for all real x.",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "equation_group");
  assert.equal(blocks[1].type, "paragraph");
});

test("equation_group stops before short explanatory prose lines", () => {
  const layoutLines = [
    { text: "x^2 - 1 = (x-1)(x+1)", bbox: { x0: 120, y0: 740, x1: 310, y1: 754, space: "pdf" } },
    { text: "= (x-1)(x+1)", bbox: { x0: 140, y0: 722, x1: 280, y1: 736, space: "pdf" } },
    { text: "by factoring", bbox: { x0: 160, y0: 704, x1: 240, y1: 718, space: "pdf" } },
    { text: "Now divide by x - 1.", bbox: { x0: 80, y0: 670, x1: 250, y1: 684, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["equation_group", "paragraph", "paragraph"]);
  assert.equal(blocks[0].children?.length, 2);
  assert.equal(blocks[1].originalContent, "by factoring");
});

test("keeps explanatory prose paragraphs out of equation_group even when math follows", () => {
  const pageText = [
    "In words, the Sum Rule says the limit of a sum is the sum of the limits.",
    "lim x→c (f(x) + g(x)) = L + M",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
});

test("detects Example blocks from keyword headings", () => {
  const pageText = [
    "Example 2.1: Find the derivative.",
    "Compute f'(x) = 3x^2.",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "example");
});

test("detects Worked Example headings as example blocks", () => {
  const pageText = [
    "Worked Example 3 Find the tangent line.",
    "Use f'(x) = 2x to compute the slope.",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "example");
});

test("example blocks split before trailing generic prose when body resets to the main margin", () => {
  const layoutLines = [
    { text: "Worked Example 3 Find the tangent line.", bbox: { x0: 80, y0: 740, x1: 360, y1: 754, space: "pdf" } },
    { text: "Use f'(x) = 2x to compute the slope.", bbox: { x0: 104, y0: 722, x1: 330, y1: 736, space: "pdf" } },
    { text: "f'(2) = 4", bbox: { x0: 126, y0: 704, x1: 210, y1: 718, space: "pdf" } },
    { text: "This paragraph returns to the general discussion.", bbox: { x0: 80, y0: 686, x1: 370, y1: 700, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["example", "paragraph"]);
  assert.match(blocks[0].originalContent, /Worked Example 3/);
  assert.equal(blocks[1].originalContent, "This paragraph returns to the general discussion.");
});

test("example blocks keep nearby prose and math together when the flow has not reset", () => {
  const layoutLines = [
    { text: "Example 3 Evaluate the limit.", bbox: { x0: 80, y0: 760, x1: 280, y1: 774, space: "pdf" } },
    { text: "We factor the numerator first.", bbox: { x0: 96, y0: 742, x1: 300, y1: 756, space: "pdf" } },
    { text: "x^2 - 1 = (x-1)(x+1)", bbox: { x0: 120, y0: 718, x1: 300, y1: 732, space: "pdf" } },
    { text: "Then cancel the common factor.", bbox: { x0: 104, y0: 696, x1: 320, y1: 710, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "example");
  assert.match(blocks[0].originalContent, /Then cancel the common factor/);
});

test("example parsing keeps prompt and inline-labeled items inside one structured example block", () => {
  const pageText = [
    "EXAMPLE 5 Use the observations limxSc k = k and limxSc x = c (Example 3) and",
    "the fundamental rules of limits to find the following limits.",
    "(a) lim",
    "xSc",
    "(x3 + 4x2 - 3) (b) lim",
    "xSc",
    "(x4 + x2 - 1)/(x2 + 5)",
    "(c) limxS-2",
    "√4x2 - 3",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "example");
  assert.equal(blocks[0].number, "5");

  const children = blocks[0].children || [];
  const promptChildren = children.filter((child) => child.type === "example_prompt");
  assert.equal(promptChildren.length, 1);
  assert.equal(children[0]?.type, "example_prompt");
  assert.match(promptChildren[0]?.text || "", /Use the observations/u);
  assert.match(promptChildren[0]?.text || "", /the fundamental rules of limits/u);
  const items = children.filter((child) => child.type === "example_item");
  assert.equal(items.length, 3);
  assert.equal(items[0]?.label, "(a)");
  assert.match(items[0]?.text || "", /lim x→c \(x3 \+ 4x2 - 3\)/u);
  assert.equal(items[1]?.label, "(b)");
  assert.match(items[1]?.text || "", /lim x→c \(x4 \+ x2 - 1\)\/\(x2 \+ 5\)/u);
  assert.equal(items[2]?.label, "(c)");
  assert.match(items[2]?.text || "", /lim x→-2 √\(4x2 - 3\)|lim x→-2 √\(4x\^2 - 3\)/u);
  assert.match(items[2]?.content || "", /\(c\) lim x→-2 √\(4x2 - 3\)|\(c\) lim x→-2 √\(4x\^2 - 3\)/u);
  assert.match(items[2]?.originalText || "", /\(c\) lim x→-2 √\(4x2 - 3\)|\(c\) lim x→-2 √\(4x\^2 - 3\)/u);
  assert.match(items[2]?.normalizedContent || "", /\(c\) lim x→-2 √\(4x2 - 3\)|\(c\) lim x→-2 √\(4x\^2 - 3\)/u);
  assert.doesNotMatch(items[2]?.text || "", /√4x\^?2 - 3 x→-2/u);
  assert.doesNotMatch(items[2]?.content || "", /√4x\^?2 - 3 x→-2/u);
  assert.doesNotMatch(items[2]?.originalText || "", /√4x\^?2 - 3 x→-2/u);
  assert.doesNotMatch(items[2]?.normalizedContent || "", /√4x\^?2 - 3 x→-2/u);
  assert.doesNotMatch(items[0]?.text || "", /\(b\)/u);
  assert.doesNotMatch(items[1]?.text || "", /\(c\)/u);
  assert.ok(!blocks.some((block) => ["lim", "xSc", "(x3 + 4x2 - 3)"].includes(block.originalContent)));
});

test("normalizeRootRadicands wraps simple square-root radicands with trailing +/- terms", () => {
  assert.equal(normalizeRootRadicands("lim x→-2 √4x^2 - 3"), "lim x→-2 √(4x^2 - 3)");
  assert.equal(normalizeRootRadicands("lim x→c √x"), "lim x→c √x");
  assert.equal(normalizeRootRadicands("lim x→c √(x^2 + 1)"), "lim x→c √(x^2 + 1)");
});

test("normalizeNthRoots converts explicit root indexes without changing ordinary square roots", () => {
  assert.equal(
    normalizeNthRoots("lim x→c √ n f(x) = √ n L = L^(1/n)"),
    "lim x→c ⁿ√f(x) = ⁿ√L = L^(1/n)",
  );
  assert.equal(normalizeNthRoots("√n f(x)"), "ⁿ√f(x)");
  assert.equal(normalizeNthRoots("√nL"), "ⁿ√L");
  assert.equal(normalizeNthRoots("lim x→-2 √(4x^2 - 3)"), "lim x→-2 √(4x^2 - 3)");
  assert.equal(normalizeNthRoots("lim x→c √x"), "lim x→c √x");
});

test("theorem blocks preserve theorem intro, equation groups, and numbered rule items as children", () => {
  const layoutLines = [
    { text: "Theorem 2.6 Limit Laws", bbox: { x0: 80, y0: 760, x1: 280, y1: 774, space: "pdf" } },
    { text: "Suppose that lim x→c f(x) = L and lim x→c g(x) = M.", bbox: { x0: 96, y0: 742, x1: 420, y1: 756, space: "pdf" } },
    { text: "lim x→c f(x) = L", bbox: { x0: 120, y0: 716, x1: 260, y1: 730, space: "pdf" } },
    { text: "lim x→c g(x) = M", bbox: { x0: 120, y0: 698, x1: 260, y1: 712, space: "pdf" } },
    { text: "1. Sum Rule", bbox: { x0: 108, y0: 670, x1: 210, y1: 684, space: "pdf" } },
    { text: "2. Difference Rule", bbox: { x0: 108, y0: 652, x1: 250, y1: 666, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "theorem");
  assert.equal(blocks[0].title, "Theorem 2.6 Limit Laws");
  assert.deepEqual(blocks[0].children?.map((child) => child.type), ["theorem_intro", "equation_group", "rule_list"]);
  assert.equal(blocks[0].children?.[1]?.children?.length, 1);
  assert.match(blocks[0].children?.[1]?.originalContent || "", /lim x→c f\(x\) = L and lim x→c g\(x\) = M/u);
  assert.equal(blocks[0].children?.[2]?.children?.length, 2);
  assert.equal(blocks[0].children?.[2]?.children?.[0]?.number, "1");
  assert.equal(blocks[0].children?.[2]?.children?.[0]?.title, "Sum Rule");
  assert.equal(blocks[0].children?.[2]?.children?.[1]?.number, "2");
});

test("plain-text theorem blocks also keep theorem children instead of flattening", () => {
  const pageText = [
    "Theorem 2.6 Limit Laws If L and M are real numbers.",
    "lim x→c f(x) = L",
    "lim x→c g(x) = M",
    "1. Sum Rule",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "theorem");
  assert.equal(blocks[0].title, "Theorem 2.6 Limit Laws");
  assert.deepEqual(blocks[0].children?.map((child) => child.type), ["theorem_intro", "equation_group", "rule_list"]);
  assert.equal(blocks[0].children?.[0]?.originalContent, "If L and M are real numbers.");
  assert.equal(blocks[0].children?.[2]?.children?.[0]?.title, "Sum Rule");
});

test("theorem parsing keeps intro, theorem equations, rule list, and note together without top-level fragments", () => {
  const pageText = [
    "THEOREM 1—Limit Laws If L, M, c, and k are real numbers and",
    "lim",
    "xSc",
    "ƒ(x) = L and lim",
    "xSc",
    "g(x) = M, then",
    "1. Sum Rule: lim",
    "xSc",
    "(ƒ(x) + g(x)) = L + M",
    "2. Difference Rule: lim",
    "xSc",
    "(ƒ(x) - g(x)) = L - M",
    "(If n is even, we assume that lim",
    "xSc",
    "ƒ(x) = L > 0.)",
    "In words, the Sum Rule says that the limit of a sum is the sum of the limits.",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "theorem");
  assert.equal(blocks[0].title, "THEOREM 1—Limit Laws");
  assert.ok(blocks[0].children?.some((child) => child.type === "theorem_intro"));
  assert.ok(blocks[0].children?.some((child) => child.type === "equation_group"));
  assert.ok(blocks[0].children?.some((child) => child.type === "rule_list"));
  assert.ok(blocks[0].children?.some((child) => child.type === "theorem_note"));
  const ruleList = blocks[0].children?.find((child) => child.type === "rule_list");
  assert.equal(ruleList?.children?.length, 2);
  assert.equal(ruleList?.children?.[0]?.title, "Sum Rule");
  assert.equal(ruleList?.children?.[1]?.title, "Difference Rule");
  assert.ok(!blocks.some((block) => ["lim", "xSc"].includes(block.originalContent)));
});

test("theorem parsing splits inline first rule markers out of theorem equations", () => {
  const pageText = [
    "THEOREM 1—Limit Laws If L, M, c, and k are real numbers and",
    "lim",
    "xSc",
    "f(x) = L and lim",
    "xSc",
    "g(x) = M, then 1. Sum Rule: lim",
    "xSc",
    "(f(x) + g(x)) = L + M",
    "2. Difference Rule: lim",
    "xSc",
    "(f(x) - g(x)) = L - M",
    "3. Constant Multiple Rule: lim",
    "xSc",
    "(k · f(x)) = k · L",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "theorem");

  const equationGroup = blocks[0].children?.find((child) => child.type === "equation_group");
  assert.ok(equationGroup);
  assert.match(equationGroup.originalContent, /lim x→c f\(x\) = L and lim x→c g\(x\) = M, then/u);
  assert.doesNotMatch(equationGroup.originalContent, /1\. Sum Rule/u);

  const ruleList = blocks[0].children?.find((child) => child.type === "rule_list");
  assert.ok(ruleList);
  assert.equal(ruleList.children?.length, 3);
  assert.equal(ruleList.children?.[0]?.number, "1");
  assert.equal(ruleList.children?.[0]?.title, "Sum Rule");
  assert.match(ruleList.children?.[0]?.text || "", /\(f\(x\) \+ g\(x\)\) = L \+ M/u);
  assert.equal(ruleList.children?.[1]?.number, "2");
  assert.equal(ruleList.children?.[1]?.title, "Difference Rule");
  assert.equal(ruleList.children?.[2]?.number, "3");
  assert.equal(ruleList.children?.[2]?.title, "Constant Multiple Rule");
});

test("theorem parsing keeps root-rule notes separate and preserves lim x→c ordering in structured math", () => {
  const pageText = [
    "THEOREM 1—Limit Laws If L, M, c, and k are real numbers and",
    "lim",
    "xSc",
    "f(x) = L and lim",
    "xSc",
    "g(x) = M, then",
    "7. Root Rule: lim",
    "xSc",
    "√n f(x) = √n L = L^(1/n), n a positive integer",
    "(If n is even, we assume that lim",
    "xSc",
    "f(x) = L > 0.)",
  ].join("\n");

  const blocks = segmentPlainTextPage(pageText, 1);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "theorem");

  const ruleList = blocks[0].children?.find((child) => child.type === "rule_list");
  assert.ok(ruleList);
  const ruleSeven = ruleList.children?.find((child) => child.number === "7");
  assert.ok(ruleSeven);
  assert.match(ruleSeven.text || "", /lim x→c/u);
  assert.match(ruleSeven.text || "", /ⁿ√f\(x\) = ⁿ√L = L\^\(1\/n\)/u);
  assert.doesNotMatch(ruleSeven.text || "", /\(If n is even/u);
  assert.doesNotMatch(ruleSeven.content || "", /\(If n is even/u);
  assert.doesNotMatch(ruleSeven.originalText || "", /\(If n is even/u);
  assert.doesNotMatch(ruleSeven.normalizedContent || "", /\(If n is even/u);

  const theoremNote = blocks[0].children?.find((child) => child.type === "theorem_note");
  assert.ok(theoremNote);
  assert.match(theoremNote.text || "", /lim x→c f\(x\) = L > 0/u);
});

test("sortLayoutLinesByReadingOrder sorts top-to-bottom then left-to-right", () => {
  const lines = [
    { text: "B", bbox: { x0: 300, y0: 730, x1: 360, y1: 744, space: "pdf" } },
    { text: "A", bbox: { x0: 60, y0: 730, x1: 120, y1: 744, space: "pdf" } },
    { text: "C", bbox: { x0: 60, y0: 690, x1: 120, y1: 704, space: "pdf" } },
  ];

  const sorted = sortLayoutLinesByReadingOrder(lines);
  assert.deepEqual(sorted.map((line) => line.text), ["A", "B", "C"]);
});

test("keeps sidebar_note lines separate from main flow using bbox width + side anchoring", () => {
  const layoutLines = [
    { text: "Main paragraph line one.", bbox: { x0: 60, y0: 740, x1: 360, y1: 754, space: "pdf" } },
    { text: "Main paragraph line two.", bbox: { x0: 60, y0: 720, x1: 360, y1: 734, space: "pdf" } },
    { text: "Note: side remark.", bbox: { x0: 420, y0: 735, x1: 520, y1: 749, space: "pdf" } },
    { text: "Continues.", bbox: { x0: 420, y0: 717, x1: 500, y1: 731, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 600, pageHeight: 800 });
  const types = blocks.map((block) => block.type);
  assert.ok(types.includes("paragraph"));
  assert.ok(types.includes("sidebar_note"));
});

test("preserves a solitary short right-margin note as sidebar_note when layout evidence is strong", () => {
  const layoutLines = [
    { text: "Main explanation begins here and develops the idea.", bbox: { x0: 80, y0: 740, x1: 390, y1: 754, space: "pdf" } },
    { text: "Use radians here", bbox: { x0: 455, y0: 710, x1: 555, y1: 724, space: "pdf" } },
    { text: "The main discussion continues below.", bbox: { x0: 80, y0: 680, x1: 320, y1: 694, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "sidebar_note", "paragraph"]);
  assert.equal(blocks[1].originalContent, "Use radians here");
});

test("keeps centered narrow equation groups in main flow instead of misclassifying them as sidebars", () => {
  const layoutLines = [
    { text: "Evaluate the following limit.", bbox: { x0: 70, y0: 740, x1: 370, y1: 754, space: "pdf" } },
    { text: "lim x→0 sin x / x = 1", bbox: { x0: 150, y0: 700, x1: 300, y1: 716, space: "pdf" } },
    { text: "= 1 by the squeeze theorem", bbox: { x0: 170, y0: 680, x1: 320, y1: 696, space: "pdf" } },
    { text: "Note: compare this with Example 4.", bbox: { x0: 430, y0: 705, x1: 555, y1: 719, space: "pdf" } },
    { text: "The limit exists.", bbox: { x0: 70, y0: 630, x1: 350, y1: 644, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "equation_group", "sidebar_note", "paragraph"]);
});

test("interleaves sidebar notes into block order based on page position in mixed-content layouts", () => {
  const layoutLines = [
    { text: "Main discussion starts here.", bbox: { x0: 70, y0: 742, x1: 360, y1: 756, space: "pdf" } },
    { text: "This paragraph continues on the same topic.", bbox: { x0: 70, y0: 724, x1: 390, y1: 738, space: "pdf" } },
    { text: "Remark: this shortcut only works for polynomials.", bbox: { x0: 430, y0: 690, x1: 560, y1: 704, space: "pdf" } },
    { text: "Use direct substitution first.", bbox: { x0: 430, y0: 672, x1: 548, y1: 686, space: "pdf" } },
    { text: "A new paragraph resumes below the remark.", bbox: { x0: 70, y0: 630, x1: 390, y1: 644, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "sidebar_note", "paragraph"]);
});

test("detects graph/table placeholders from caption-like lines", () => {
  const layoutLines = [
    { text: "Figure 2.1: Velocity vs time.", bbox: { x0: 80, y0: 300, x1: 360, y1: 314, space: "pdf" } },
    { text: "Table 1: Values.", bbox: { x0: 80, y0: 260, x1: 220, y1: 274, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 600, pageHeight: 800 });
  assert.equal(blocks[0].type, "graph_placeholder");
  assert.ok(blocks[0].children?.some((child) => child.type === "figure_caption"));
  assert.equal(blocks[1].type, "table_placeholder");
  assert.ok(blocks[1].children?.some((child) => child.type === "figure_caption"));
});

test("keeps figure captions separated from surrounding prose and keeps caption continuations attached", () => {
  const layoutLines = [
    { text: "We summarize the graph behavior below.", bbox: { x0: 80, y0: 360, x1: 380, y1: 374, space: "pdf" } },
    { text: "Figure 2.1: Derivative sign chart.", bbox: { x0: 110, y0: 320, x1: 330, y1: 334, space: "pdf" } },
    { text: "The curve rises, then levels off near x = 0.", bbox: { x0: 126, y0: 302, x1: 360, y1: 316, space: "pdf" } },
    { text: "The discussion then returns to the proof.", bbox: { x0: 80, y0: 250, x1: 380, y1: 264, space: "pdf" } },
  ];

  const blocks = segmentPageIntoBlocks({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "graph_placeholder", "paragraph"]);
  assert.match(blocks[1].originalContent, /Derivative sign chart\.\nThe curve rises/);
});

test("returns per-page debug metadata for inspection views", () => {
  const layoutLines = [
    { text: "Example 2.4 Evaluate the integral.", bbox: { x0: 80, y0: 740, x1: 360, y1: 754, space: "pdf" } },
    { text: "∫ x^2 dx = x^3 / 3 + C", bbox: { x0: 140, y0: 700, x1: 330, y1: 714, space: "pdf" } },
  ];

  const result = inspectPageSegmentation({ pageNumber: 1, lines: layoutLines, pageWidth: 620, pageHeight: 800 });
  assert.equal(result.blocks.length, 2);
  assert.equal(result.debug.pageNumber, 1);
  assert.equal(result.debug.orderedLines.length, 2);
  assert.equal(result.debug.blocks[0].type, "example");
  assert.ok(result.debug.blocks[0].sourceLineIds.length >= 1);
});
