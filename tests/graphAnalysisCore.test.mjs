import test from "node:test";
import assert from "node:assert/strict";

import { postProcessGraphAnalysisPayload } from "../lib/graphAnalysisCore.mjs";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertStructuredNaturalDescription(description, { equationText, firstSentence }) {
  const movementIndex = Math.max(
    description.indexOf("As x increases"),
    description.indexOf("As y changes"),
    description.indexOf("It curves around"),
  );
  const yAxisIndex = description.indexOf("y-axis");
  const xAxisIndex = description.indexOf("x-axis");
  const exampleIndex = description.indexOf("Example points");
  const equationIndex = equationText ? description.lastIndexOf(equationText) : description.lastIndexOf("equation");
  const coordinateMatches = description.match(/\([-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?\)/g) || [];

  assert.match(description, new RegExp(`^${escapeRegex(firstSentence)}`));
  assert.ok(movementIndex > 0, "expected a movement sentence after the opening sentence");
  assert.ok(yAxisIndex > movementIndex, "expected a y-axis explanation after movement");
  assert.ok(xAxisIndex > yAxisIndex, "expected an x-axis explanation after the y-axis explanation");
  assert.ok(exampleIndex > xAxisIndex, "expected example points after the axis explanations");
  assert.ok(equationIndex > exampleIndex, "expected the equation sentence at the end");
  assert.ok(coordinateMatches.length >= 2, "expected at least two explicit coordinates");
}

function assertStructuredBrailleDescription(description, { equationText, firstLine }) {
  const lines = description.split("\n").filter(Boolean);
  const coordinateMatches = description.match(/\([-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?\)/g) || [];

  assert.match(lines[0] || "", new RegExp(`^${escapeRegex(firstLine)}`));
  assert.ok(lines.length >= 5, "expected at least five Braille-friendly lines");
  assert.ok(lines.some((line) => /As x increases|As y changes|When x increases|It curves/.test(line)), "expected a behavior line");
  assert.ok(lines.some((line) => /x-axis|y-axis|does not cross|lies on/.test(line)), "expected intercept lines");
  assert.ok(lines.some((line) => /^Example points|^One example point/.test(line)), "expected an example-point line");
  assert.ok((lines[lines.length - 1] || "").includes(equationText), "expected the final line to contain the equation");
  assert.ok(/^Equation:|^Exact equation/.test(lines[lines.length - 1] || ""), "expected the equation on the last line");
  assert.ok(coordinateMatches.length >= 2, "expected at least two explicit coordinates");
}

test("classifies a positive-slope line and generates structured descriptions", () => {
  const result = postProcessGraphAnalysisPayload({
    graph_type: "line",
    confidence: 0.92,
    equation_text: "y = x + 2",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "1 unit per tick",
    },
    shape_summary: "straight line rising from left to right",
    key_features: {},
  });

  assert.equal(result.graph_type, "line");
  assert.equal(result.key_features.slope, 1);
  assert.deepEqual(result.key_features.y_intercepts, [{ x: 0, y: 2, approx: false }]);
  assert.deepEqual(result.key_features.x_intercepts, [{ x: -2, y: 0, approx: false }]);
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = x + 2",
    firstSentence: "This graph shows a straight line rising from left to right.",
  });
  assert.match(result.natural_description, /meaning when x is zero, y is 2\./);
  assert.match(result.natural_description, /meaning when y is zero, x is -2\./);
  assert.match(result.natural_description, /Example points include \(-2, 0\), \(0, 2\), and \(2, 4\)\./);
  assert.match(result.natural_description, /\n\n/);
  assertStructuredBrailleDescription(result.braille_friendly_description, {
    equationText: "y = x + 2",
    firstLine: "Straight line rising from left to right.",
  });
  assert.match(result.braille_friendly_description, /\n/);
  assert.match(result.braille_friendly_description, /Equation: y = x \+ 2\.$/);
});

test("classifies a negative-slope line and explains the direction in plain language", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "y = -2x + 4",
    shape_summary: "straight line falling from left to right",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "line");
  assert.equal(result.key_features.slope, -2);
  assert.deepEqual(result.key_features.x_intercepts, [{ x: 2, y: 0, approx: false }]);
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = -2x + 4",
    firstSentence: "This graph shows a straight line falling from left to right.",
  });
  assert.match(result.natural_description, /As x increases, y decreases at a constant rate\./);
  assert.match(result.natural_description, /For every increase of 1 in x, y decreases by 2\./);
});

test("classifies a horizontal line and explains the missing x-axis crossing", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "y = 3",
    shape_summary: "horizontal line",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: false,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "horizontal_line");
  assert.deepEqual(result.key_features.y_intercepts, [{ x: 0, y: 3, approx: false }]);
  assert.equal(result.key_features.x_intercepts.length, 0);
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = 3",
    firstSentence: "This graph shows a horizontal line where y stays constant.",
  });
  assert.match(result.natural_description, /It does not cross the x-axis, so there is no point on the graph where y becomes zero\./);
});

test("classifies a vertical line and explains the missing y-axis crossing", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "x = -1",
    shape_summary: "vertical line",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "vertical_line");
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "x = -1",
    firstSentence: "This graph shows a vertical line where x stays constant.",
  });
  assert.match(result.natural_description, /It does not cross the y-axis, so there is no point on the graph where x is zero\./);
  assertStructuredBrailleDescription(result.braille_friendly_description, {
    equationText: "x = -1",
    firstLine: "Vertical line.",
  });
});

test("classifies an upward parabola and includes movement, intercepts, and example points", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "y = x^2 - 4",
    shape_summary: "U-shaped parabola",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "parabola");
  assert.deepEqual(result.key_features.vertex, { x: 0, y: -4, approx: false });
  assert.equal(result.key_features.opens, "up");
  assert.deepEqual(result.key_features.x_intercepts, [
    { x: -2, y: 0, approx: false },
    { x: 2, y: 0, approx: false },
  ]);
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = x^2 - 4",
    firstSentence: "This graph shows a U-shaped parabola opening upward.",
  });
  assert.match(result.natural_description, /falls to its lowest point at \(0, -4\) and then rises again\./);
  assertStructuredBrailleDescription(result.braille_friendly_description, {
    equationText: "y = x^2 - 4",
    firstLine: "U-shaped parabola.",
  });
});

test("classifies a downward parabola in vertex form and derives mirrored example points", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "y = -(x - 1)^2 + 3",
    shape_summary: "inverted U-shaped parabola",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "parabola");
  assert.deepEqual(result.key_features.vertex, { x: 1, y: 3, approx: false });
  assert.equal(result.key_features.opens, "down");
  assert.equal(result.key_features.axis_of_symmetry, "x = 1");
  assert.match(result.natural_description, /Example points include \(0, 2\), \(1, 3\), and \(2, 2\)\./);
});

test("classifies an absolute value graph with a corner-focused description", () => {
  const result = postProcessGraphAnalysisPayload({
    equation_text: "y = |x| - 2",
    shape_summary: "V-shaped graph",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.equal(result.graph_type, "absolute_value");
  assert.deepEqual(result.key_features.vertex, { x: 0, y: -2, approx: false });
  assert.equal(result.key_features.opens, "up");
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = |x| - 2",
    firstSentence: "This graph shows a V-shaped absolute value graph opening upward.",
  });
  assert.match(result.natural_description, /corner at \(0, -2\)/i);
});

test("replaces short technical descriptions with the structured accessibility format", () => {
  const result = postProcessGraphAnalysisPayload({
    graph_type: "line",
    equation_text: "y = x + 2",
    natural_description: "y = x + 2. Slope 1. Intercepts listed.",
    braille_friendly_description: "Equation: y = x + 2.",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {},
  });

  assert.doesNotMatch(result.natural_description, /^y = x \+ 2/);
  assertStructuredNaturalDescription(result.natural_description, {
    equationText: "y = x + 2",
    firstSentence: "This graph shows a straight line rising from left to right.",
  });
  assertStructuredBrailleDescription(result.braille_friendly_description, {
    equationText: "y = x + 2",
    firstLine: "Straight line rising from left to right.",
  });
});

test("records an uncertainty when the equation conflicts with the shape", () => {
  const result = postProcessGraphAnalysisPayload({
    graph_type: "parabola",
    equation_text: "y = x + 2",
    shape_summary: "U-shaped parabola",
    axes: {
      has_x_axis: true,
      has_y_axis: true,
      origin_visible: true,
      scale_notes: "",
    },
    key_features: {
      vertex: { x: 0, y: -4, approx: false },
      opens: "up",
    },
  });

  assert.equal(result.graph_type, "parabola");
  assert.ok(result.uncertainties.some((note) => note.includes("equation suggests line")));
});
