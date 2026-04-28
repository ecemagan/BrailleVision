const GRAPH_TYPES = new Set([
  "line",
  "parabola",
  "absolute_value",
  "vertical_line",
  "horizontal_line",
  "circle",
  "polynomial",
  "piecewise",
  "unknown",
]);

const VISUAL_ONLY_PHRASES = [
  /\bas seen\b/gi,
  /\byou can see\b/gi,
  /\bshown\b/gi,
  /\bvisible\b/gi,
  /\blooks like\b/gi,
  /\bappears to show\b/gi,
  /\bblue line\b/gi,
  /\bred line\b/gi,
  /\bgreen line\b/gi,
  /\bblack line\b/gi,
];

const HIGH_CONFIDENCE = 0.92;
const MEDIUM_CONFIDENCE = 0.68;
const LOW_CONFIDENCE = 0.38;

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSentence(value) {
  let next = cleanText(value);

  for (const pattern of VISUAL_ONLY_PHRASES) {
    next = next.replace(pattern, "");
  }

  next = next.replace(/\s+,/g, ",").replace(/\s+\./g, ".").trim();

  if (!next) {
    return "";
  }

  return next.endsWith(".") ? next : `${next}.`;
}

function cleanStructuredDescription(value, compact = false) {
  const rawText = String(value ?? "").replace(/\r\n?/g, "\n");

  if (!rawText.trim()) {
    return "";
  }

  const separator = compact ? /\n+/ : /\n\s*\n+/;
  const blocks = rawText
    .split(separator)
    .map((block) =>
      block
        .split("\n")
        .map(cleanSentence)
        .filter(Boolean)
        .join(compact ? "\n" : " "),
    )
    .filter(Boolean);

  return blocks.join(compact ? "\n" : "\n\n");
}

function normalizeCoordinate(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  return Math.abs(value) < 1e-9 ? 0 : value;
}

function createPoint(x, y, approx = false, label = "") {
  const point = {
    x: normalizeCoordinate(x),
    y: normalizeCoordinate(y),
    approx: Boolean(approx),
  };
  const cleanLabel = cleanText(label);

  if (cleanLabel) {
    point.label = cleanLabel;
  }

  return point;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }

  return value.toFixed(3).replace(/0+$/g, "").replace(/\.$/g, "");
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[−–—]/g, "-").replace(/,/g, ".").trim();

  if (!/^[-+]?\d*\.?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseApproxFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function parsePointString(value) {
  const match = cleanText(value).match(/^\(?\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)?$/);

  if (!match) {
    return null;
  }

  return {
    ...createPoint(Number(match[1]), Number(match[2]), false),
  };
}

function normalizePoint(value, fallback = {}) {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === "string") {
    return parsePointString(value);
  }

  if (Array.isArray(value) && value.length >= 2) {
    const x = parseNumber(value[0]);
    const y = parseNumber(value[1]);

    if (x === null || y === null) {
      return null;
    }

    return {
      ...createPoint(x, y, false, value[2]),
    };
  }

  if (typeof value !== "object") {
    return null;
  }

  const x = parseNumber(value.x ?? fallback.x);
  const y = parseNumber(value.y ?? fallback.y);

  if (x === null || y === null) {
    return null;
  }

  return createPoint(x, y, parseApproxFlag(value.approx), value.label);
}

function normalizePointList(values, fallback = {}) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();

  return values
    .map((value) => normalizePoint(value, fallback))
    .filter(Boolean)
    .filter((point) => {
      const key = `${formatNumber(point.x)}:${formatNumber(point.y)}:${point.label || ""}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.x - right.x || left.y - right.y);
}

function normalizeLegacyIntercept(value, axis) {
  const point = normalizePoint(value);

  if (point) {
    return [point];
  }

  const numericValue = parseNumber(value);

  if (numericValue === null) {
    return [];
  }

  return [
    axis === "x" ? createPoint(numericValue, 0) : createPoint(0, numericValue),
  ];
}

function normalizeConfidence(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  const text = cleanText(value).toLowerCase();

  if (text === "high") {
    return HIGH_CONFIDENCE;
  }

  if (text === "medium") {
    return MEDIUM_CONFIDENCE;
  }

  if (text === "low") {
    return LOW_CONFIDENCE;
  }

  const numericValue = parseNumber(text);
  return numericValue === null ? MEDIUM_CONFIDENCE : Math.max(0, Math.min(1, numericValue));
}

function normalizeGraphType(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    line_graph: "line",
    straight_line: "line",
    linear: "line",
    linear_graph: "line",
    line: "line",
    parabola_graph: "parabola",
    quadratic: "parabola",
    quadratic_graph: "parabola",
    parabola: "parabola",
    absolute_value_graph: "absolute_value",
    absolute_value: "absolute_value",
    abs_graph: "absolute_value",
    v_shape: "absolute_value",
    vertical: "vertical_line",
    vertical_line: "vertical_line",
    horizontal: "horizontal_line",
    horizontal_line: "horizontal_line",
    circle_graph: "circle",
    circle: "circle",
    polynomial_graph: "polynomial",
    polynomial: "polynomial",
    piecewise_graph: "piecewise",
    segmented_graph: "piecewise",
    piecewise: "piecewise",
    unknown: "unknown",
    unclear: "unknown",
    coordinate_plane_graph: "unknown",
    function_graph: "unknown",
  };

  const graphType = aliases[normalized] || normalized;
  return GRAPH_TYPES.has(graphType) ? graphType : "unknown";
}

function normalizeEquationText(value) {
  const text = cleanText(value).replace(/[−–—]/g, "-");
  return text || null;
}

function normalizeAxisDirection(value) {
  const text = cleanText(value).toLowerCase();

  if (["up", "down", "left", "right"].includes(text)) {
    return text;
  }

  return null;
}

function normalizeAxes(rawAxes = {}, rawPayload = {}) {
  const hasXAxis = rawAxes.has_x_axis ?? rawPayload.has_x_axis ?? rawPayload.coordinate_plane_present ?? true;
  const hasYAxis = rawAxes.has_y_axis ?? rawPayload.has_y_axis ?? rawPayload.coordinate_plane_present ?? true;
  const originVisible = rawAxes.origin_visible ?? rawPayload.origin_visible ?? false;

  return {
    has_x_axis: Boolean(hasXAxis),
    has_y_axis: Boolean(hasYAxis),
    origin_visible: Boolean(originVisible),
    scale_notes: cleanText(rawAxes.scale_notes ?? rawPayload.scale_notes),
  };
}

function normalizeIntervals(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniqueStrings(values);
}

function normalizeKeyFeatures(rawKeyFeatures = {}, rawPayload = {}) {
  const xIntercepts = normalizePointList(
    rawKeyFeatures.x_intercepts ?? rawPayload.x_intercepts,
    { y: 0 },
  );
  const yIntercepts = normalizePointList(
    rawKeyFeatures.y_intercepts ?? rawPayload.y_intercepts,
    { x: 0 },
  );
  const vertex = normalizePoint(rawKeyFeatures.vertex ?? rawPayload.vertex);
  const maximumPoint = normalizePoint(rawKeyFeatures.maximum_point ?? rawPayload.maximum_point);
  const minimumPoint = normalizePoint(rawKeyFeatures.minimum_point ?? rawPayload.minimum_point);
  const center = normalizePoint(rawKeyFeatures.center ?? rawPayload.center);
  const notablePoints = normalizePointList(rawKeyFeatures.notable_points ?? rawPayload.notable_points);
  const slope = parseNumber(rawKeyFeatures.slope ?? rawPayload.slope);
  const radius = parseNumber(rawKeyFeatures.radius ?? rawPayload.radius);

  const legacyXIntercepts =
    xIntercepts.length > 0
      ? xIntercepts
      : normalizeLegacyIntercept(rawPayload.x_intercept_text ?? rawPayload.xInterceptText ?? rawPayload.x_intercept, "x");
  const legacyYIntercepts =
    yIntercepts.length > 0
      ? yIntercepts
      : normalizeLegacyIntercept(rawPayload.y_intercept_text ?? rawPayload.yInterceptText ?? rawPayload.y_intercept, "y");

  return {
    x_intercepts: legacyXIntercepts,
    y_intercepts: legacyYIntercepts,
    slope,
    increasing_intervals: normalizeIntervals(rawKeyFeatures.increasing_intervals ?? rawPayload.increasing_intervals),
    decreasing_intervals: normalizeIntervals(rawKeyFeatures.decreasing_intervals ?? rawPayload.decreasing_intervals),
    vertex,
    opens: normalizeAxisDirection(rawKeyFeatures.opens ?? rawPayload.opens),
    axis_of_symmetry: cleanText(rawKeyFeatures.axis_of_symmetry ?? rawPayload.axis_of_symmetry) || null,
    maximum_point: maximumPoint,
    minimum_point: minimumPoint,
    center,
    radius,
    notable_points: notablePoints,
  };
}

function pointToText(point) {
  if (!point) {
    return "";
  }

  const prefix = point.approx ? "approximately " : "";
  return `${prefix}(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
}

function listPoints(points) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return pointToText(points[0]);
  }

  if (points.length === 2) {
    return `${pointToText(points[0])} and ${pointToText(points[1])}`;
  }

  return `${points.slice(0, -1).map(pointToText).join(", ")}, and ${pointToText(points[points.length - 1])}`;
}

function buildSlopeMeaning(slope) {
  if (slope === null) {
    return "";
  }

  if (Math.abs(slope) < 1e-9) {
    return "The slope is 0, so y does not change as x changes.";
  }

  if (slope > 0) {
    return `For every increase of 1 in x, y increases by ${formatNumber(Math.abs(slope))}.`;
  }

  return `For every increase of 1 in x, y decreases by ${formatNumber(Math.abs(slope))}.`;
}

function buildCompactSlopeMeaning(slope) {
  if (slope === null) {
    return "";
  }

  if (Math.abs(slope) < 1e-9) {
    return "When x changes y stays the same.";
  }

  if (slope > 0) {
    return `When x increases by 1 y increases by ${formatNumber(Math.abs(slope))}.`;
  }

  return `When x increases by 1 y decreases by ${formatNumber(Math.abs(slope))}.`;
}

function inferTypeFromShapeSummary(shapeSummary) {
  const normalized = cleanText(shapeSummary).toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("vertical")) {
    return "vertical_line";
  }

  if (normalized.includes("horizontal")) {
    return "horizontal_line";
  }

  if (normalized.includes("straight")) {
    return "line";
  }

  if (normalized.includes("u-shaped") || normalized.includes("inverted u")) {
    return "parabola";
  }

  if (normalized.includes("v-shaped")) {
    return "absolute_value";
  }

  if (normalized.includes("circle")) {
    return "circle";
  }

  if (normalized.includes("piecewise") || normalized.includes("segment")) {
    return "piecewise";
  }

  if (normalized.includes("polynomial") || normalized.includes("turning point")) {
    return "polynomial";
  }

  return "unknown";
}

function parseLineEquation(equationText) {
  const equation = cleanText(equationText).replace(/\s+/g, "");

  const verticalMatch = equation.match(/^x=([-+]?\d*\.?\d+)$/i);

  if (verticalMatch) {
    const x = Number(verticalMatch[1]);
    return {
      type: "vertical_line",
      x,
    };
  }

  const constantMatch = equation.match(/^(?:y|f\(x\))=([-+]?\d*\.?\d+)$/i);

  if (constantMatch) {
    const y = Number(constantMatch[1]);
    return {
      type: "horizontal_line",
      y,
    };
  }

  const lineMatch = equation.match(/^(?:y|f\(x\))=([+-]?)(\d*\.?\d*)x(?:(\+|-)(\d*\.?\d+))?$/i);

  if (!lineMatch) {
    return null;
  }

  const sign = lineMatch[1] === "-" ? -1 : 1;
  const coefficientText = lineMatch[2];
  const coefficient = coefficientText ? Number(coefficientText) : 1;
  const slope = sign * coefficient;
  const intercept = lineMatch[3]
    ? (lineMatch[3] === "-" ? -1 : 1) * Number(lineMatch[4])
    : 0;

  return {
    type: Math.abs(slope) < 1e-9 ? "horizontal_line" : "line",
    slope,
    y_intercepts: [createPoint(0, intercept)],
    x_intercepts:
      Math.abs(slope) < 1e-9
        ? []
        : [createPoint(-intercept / slope, 0)],
  };
}

function parseQuadraticEquation(equationText) {
  const equation = cleanText(equationText)
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/²/g, "^2");

  if (!/^(?:y|f\(x\))=/.test(equation) || (!/x\^2/.test(equation) && !/\)\^2/.test(equation)) || /y\^2/.test(equation)) {
    return null;
  }

  const vertexFormMatch = equation.match(
    /^(?:y|f\(x\))=([+-]?\d*\.?\d*)?\(x([+-]\d*\.?\d+)\)\^2([+-]\d*\.?\d+)?$/i,
  );

  if (vertexFormMatch) {
    const aText = vertexFormMatch[1];
    const a = aText === "-" ? -1 : aText === "" || aText === "+" || aText == null ? 1 : Number(aText);
    const h = -Number(vertexFormMatch[2]);
    const k = vertexFormMatch[3] ? Number(vertexFormMatch[3]) : 0;

    return {
      type: "parabola",
      vertex: createPoint(h, k),
      opens: a >= 0 ? "up" : "down",
      axis_of_symmetry: `x = ${formatNumber(h)}`,
      y_intercepts: [createPoint(0, a * (0 - h) ** 2 + k)],
    };
  }

  const normalized = equation.replace(/-/g, "+-");
  const rhs = normalized.split("=")[1];
  const terms = rhs.split("+").filter(Boolean);
  let a = 0;
  let b = 0;
  let c = 0;

  for (const term of terms) {
    if (term.includes("x^2")) {
      const coefficientText = term.replace("x^2", "");
      a = coefficientText === "" ? 1 : coefficientText === "-" ? -1 : Number(coefficientText);
    } else if (term.includes("x")) {
      const coefficientText = term.replace("x", "");
      b = coefficientText === "" ? 1 : coefficientText === "-" ? -1 : Number(coefficientText);
    } else {
      c = Number(term);
    }
  }

  if (!Number.isFinite(a) || Math.abs(a) < 1e-9 || !Number.isFinite(b) || !Number.isFinite(c)) {
    return null;
  }

  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const discriminant = b * b - 4 * a * c;
  const xIntercepts = [];

  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    xIntercepts.push(createPoint((-b - root) / (2 * a), 0));

    if (root > 1e-9) {
      xIntercepts.push(createPoint((-b + root) / (2 * a), 0));
    }
  }

  return {
    type: "parabola",
    vertex: createPoint(vertexX, vertexY),
    opens: a >= 0 ? "up" : "down",
    axis_of_symmetry: `x = ${formatNumber(vertexX)}`,
    y_intercepts: [createPoint(0, c)],
    x_intercepts: xIntercepts,
  };
}

function parseAbsoluteValueEquation(equationText) {
  const equation = cleanText(equationText)
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/abs\(/gi, "|")
    .replace(/\)/g, "");

  const match = equation.match(/^(?:y|f\(x\))=([+-]?\d*\.?\d*)?\|x([+-]\d*\.?\d+)?\|([+-]\d*\.?\d+)?$/i);

  if (!match) {
    return null;
  }

  const aText = match[1];
  const a = aText === "-" ? -1 : aText === "" || aText === "+" || aText == null ? 1 : Number(aText);
  const h = match[2] ? -Number(match[2]) : 0;
  const k = match[3] ? Number(match[3]) : 0;
  const xIntercepts = [];

  if (Math.abs(a) > 1e-9) {
    const distance = -k / a;

    if (distance >= 0) {
      xIntercepts.push(createPoint(h - distance, 0));

      if (distance > 1e-9) {
        xIntercepts.push(createPoint(h + distance, 0));
      }
    }
  }

  return {
    type: "absolute_value",
    vertex: createPoint(h, k),
    opens: a >= 0 ? "up" : "down",
    axis_of_symmetry: `x = ${formatNumber(h)}`,
    y_intercepts: [createPoint(0, a * Math.abs(-h) + k)],
    x_intercepts: xIntercepts,
    notable_points: [createPoint(h - 1, k + Math.abs(a)), createPoint(h + 1, k + Math.abs(a))],
  };
}

function parseCircleEquation(equationText) {
  const equation = cleanText(equationText)
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/²/g, "^2");

  const shiftedMatch = equation.match(
    /^\(x([+-]\d*\.?\d+)?\)\^2\+\(y([+-]\d*\.?\d+)?\)\^2=([-+]?\d*\.?\d+)$/i,
  );

  if (shiftedMatch) {
    const h = shiftedMatch[1] ? -Number(shiftedMatch[1]) : 0;
    const k = shiftedMatch[2] ? -Number(shiftedMatch[2]) : 0;
    const radiusSquared = Number(shiftedMatch[3]);

    if (radiusSquared > 0) {
      return {
        type: "circle",
        center: createPoint(h, k),
        radius: Math.sqrt(radiusSquared),
      };
    }
  }

  const originMatch = equation.match(/^x\^2\+y\^2=([-+]?\d*\.?\d+)$/i);

  if (!originMatch) {
    return null;
  }

  const radiusSquared = Number(originMatch[1]);

  if (!(radiusSquared > 0)) {
    return null;
  }

  return {
    type: "circle",
    center: createPoint(0, 0),
    radius: Math.sqrt(radiusSquared),
  };
}

function inferTypeFromEquation(equationText) {
  if (!equationText) {
    return { type: "unknown" };
  }

  const line = parseLineEquation(equationText);

  if (line) {
    return line;
  }

  const quadratic = parseQuadraticEquation(equationText);

  if (quadratic) {
    return quadratic;
  }

  const absoluteValue = parseAbsoluteValueEquation(equationText);

  if (absoluteValue) {
    return absoluteValue;
  }

  const circle = parseCircleEquation(equationText);

  if (circle) {
    return circle;
  }

  const normalized = cleanText(equationText).replace(/\s+/g, "");

  if (/x\^\d/.test(normalized) || /x³|x\^3/.test(normalized)) {
    return { type: "polynomial" };
  }

  return { type: "unknown" };
}

function inferTypeFromFeatures(shapeSummary, keyFeatures) {
  if (keyFeatures.center && keyFeatures.radius !== null) {
    return "circle";
  }

  if (keyFeatures.vertex && keyFeatures.opens && ["up", "down"].includes(keyFeatures.opens)) {
    if (cleanText(shapeSummary).toLowerCase().includes("v")) {
      return "absolute_value";
    }

    return "parabola";
  }

  if (keyFeatures.slope !== null) {
    if (Math.abs(keyFeatures.slope) < 1e-9) {
      return "horizontal_line";
    }

    return "line";
  }

  if (keyFeatures.x_intercepts.length === 0 && keyFeatures.y_intercepts.length === 1) {
    const yIntercept = keyFeatures.y_intercepts[0];

    if (yIntercept && Math.abs(yIntercept.x) < 1e-9) {
      const summaryType = inferTypeFromShapeSummary(shapeSummary);

      if (summaryType === "horizontal_line") {
        return "horizontal_line";
      }
    }
  }

  return inferTypeFromShapeSummary(shapeSummary);
}

function resolveGraphType(rawType, featureType, equationType, uncertainties) {
  const subtypeMap = {
    line: new Set(["horizontal_line", "line"]),
    horizontal_line: new Set(["horizontal_line"]),
    vertical_line: new Set(["vertical_line"]),
    parabola: new Set(["parabola"]),
    absolute_value: new Set(["absolute_value"]),
    circle: new Set(["circle"]),
    polynomial: new Set(["polynomial"]),
    piecewise: new Set(["piecewise"]),
    unknown: new Set(["unknown"]),
  };

  if (rawType !== "unknown" && featureType !== "unknown" && rawType !== featureType) {
    const compatible = subtypeMap[rawType]?.has(featureType) || subtypeMap[featureType]?.has(rawType);

    if (!compatible) {
      uncertainties.push(`The shape cues suggest ${featureType.replace(/_/g, " ")}, but the model labeled it as ${rawType.replace(/_/g, " ")}.`);
    }
  }

  if (equationType !== "unknown" && rawType !== "unknown" && equationType !== rawType) {
    const compatible = subtypeMap[rawType]?.has(equationType) || subtypeMap[equationType]?.has(rawType);

    if (!compatible) {
      uncertainties.push(`The equation suggests ${equationType.replace(/_/g, " ")}, but the graph shape may indicate ${rawType.replace(/_/g, " ")}.`);
    }
  }

  if (rawType === "line" && equationType === "horizontal_line") {
    return "horizontal_line";
  }

  if (rawType === "unknown" && featureType !== "unknown") {
    return featureType;
  }

  if (rawType === "unknown" && equationType !== "unknown") {
    return equationType;
  }

  if (rawType !== "unknown") {
    return rawType;
  }

  if (featureType !== "unknown") {
    return featureType;
  }

  if (equationType !== "unknown") {
    return equationType;
  }

  return "unknown";
}

function ensureFeaturePoint(targetKey, source, keyFeatures) {
  if (!source || keyFeatures[targetKey]) {
    return;
  }

  keyFeatures[targetKey] = source;
}

function ensureFeaturePointList(targetKey, source, keyFeatures) {
  if (!Array.isArray(source) || keyFeatures[targetKey].length > 0) {
    return;
  }

  keyFeatures[targetKey] = normalizePointList(source);
}

function mergeEquationHintsIntoFeatures(equationInfo, keyFeatures) {
  if (!equationInfo || equationInfo.type === "unknown") {
    return;
  }

  if (equationInfo.slope !== undefined && keyFeatures.slope === null) {
    keyFeatures.slope = equationInfo.slope;
  }

  if (equationInfo.opens && !keyFeatures.opens) {
    keyFeatures.opens = equationInfo.opens;
  }

  if (equationInfo.axis_of_symmetry && !keyFeatures.axis_of_symmetry) {
    keyFeatures.axis_of_symmetry = equationInfo.axis_of_symmetry;
  }

  if (equationInfo.radius !== undefined && keyFeatures.radius === null) {
    keyFeatures.radius = equationInfo.radius;
  }

  ensureFeaturePoint("vertex", equationInfo.vertex, keyFeatures);
  ensureFeaturePoint("center", equationInfo.center, keyFeatures);
  ensureFeaturePoint("maximum_point", equationInfo.maximum_point, keyFeatures);
  ensureFeaturePoint("minimum_point", equationInfo.minimum_point, keyFeatures);
  ensureFeaturePointList("x_intercepts", equationInfo.x_intercepts, keyFeatures);
  ensureFeaturePointList("y_intercepts", equationInfo.y_intercepts, keyFeatures);
  ensureFeaturePointList("notable_points", equationInfo.notable_points, keyFeatures);

  if (equationInfo.type === "vertical_line" && !keyFeatures.notable_points.length && equationInfo.x !== undefined) {
    keyFeatures.notable_points = [createPoint(equationInfo.x, 0, false, "x-constant reference")];
  }

  if (equationInfo.type === "horizontal_line" && !keyFeatures.y_intercepts.length && equationInfo.y !== undefined) {
    keyFeatures.y_intercepts = [createPoint(0, equationInfo.y)];
  }

  if (equationInfo.type === "line" && keyFeatures.increasing_intervals.length === 0 && keyFeatures.decreasing_intervals.length === 0) {
    if (equationInfo.slope > 0) {
      keyFeatures.increasing_intervals = ["all real x"];
    } else if (equationInfo.slope < 0) {
      keyFeatures.decreasing_intervals = ["all real x"];
    }
  }

}

function deriveShapeSummary(graphType, keyFeatures, existingSummary) {
  const cleanSummary = cleanText(existingSummary);

  if (cleanSummary) {
    return cleanSummary;
  }

  switch (graphType) {
    case "line":
      return keyFeatures.slope !== null && keyFeatures.slope < 0
        ? "straight line falling from left to right"
        : "straight line rising from left to right";
    case "horizontal_line":
      return "horizontal line with constant y";
    case "vertical_line":
      return "vertical line with constant x";
    case "parabola":
      return keyFeatures.opens === "down" ? "inverted U-shaped parabola" : "U-shaped parabola";
    case "absolute_value":
      return "V-shaped absolute value graph";
    case "circle":
      return "circle on a coordinate plane";
    case "piecewise":
      return "piecewise graph made of separate segments";
    case "polynomial":
      return "curved polynomial graph with turning behavior";
    default:
      return "mathematical graph on a coordinate plane";
  }
}

function firstSentenceForGraph(graphType, keyFeatures) {
  switch (graphType) {
    case "line":
      return keyFeatures.slope !== null && keyFeatures.slope < 0
        ? "This graph shows a straight line falling from left to right."
        : "This graph shows a straight line rising from left to right.";
    case "horizontal_line":
      return "This graph shows a horizontal line where y stays constant.";
    case "vertical_line":
      return "This graph shows a vertical line where x stays constant.";
    case "parabola":
      return keyFeatures.opens === "down"
        ? "This graph shows a U-shaped parabola opening downward."
        : "This graph shows a U-shaped parabola opening upward.";
    case "absolute_value":
      return keyFeatures.opens === "down"
        ? "This graph shows a V-shaped absolute value graph opening downward."
        : "This graph shows a V-shaped absolute value graph opening upward.";
    case "circle":
      return "This graph shows a circle on a coordinate plane.";
    case "piecewise":
      return "This graph shows a piecewise graph made of separate segments.";
    case "polynomial":
      return "This graph shows a curved polynomial graph that changes direction.";
    default:
      return "This graph shows a mathematical graph on a coordinate plane.";
  }
}

function firstLineForBrailleGraph(graphType, keyFeatures) {
  switch (graphType) {
    case "line":
      return keyFeatures.slope !== null && keyFeatures.slope < 0
        ? "Straight line falling from left to right."
        : "Straight line rising from left to right.";
    case "horizontal_line":
      return "Horizontal line.";
    case "vertical_line":
      return "Vertical line.";
    case "parabola":
      return keyFeatures.opens === "down" ? "Inverted U-shaped parabola." : "U-shaped parabola.";
    case "absolute_value":
      return keyFeatures.opens === "down" ? "V-shaped graph opening downward." : "V-shaped graph opening upward.";
    case "circle":
      return "Circle on a coordinate plane.";
    case "piecewise":
      return "Piecewise graph.";
    case "polynomial":
      return "Polynomial curve.";
    default:
      return "Math graph on a coordinate plane.";
  }
}

function splitSentences(value) {
  return cleanText(value).match(/[^.!?]+[.!?]?/g) || [];
}

function pointKey(point) {
  return `${formatNumber(point?.x)}:${formatNumber(point?.y)}`;
}

function addPointIfMissing(points, point) {
  if (!point) {
    return;
  }

  const key = pointKey(point);

  if (!points.some((existing) => pointKey(existing) === key)) {
    points.push(point);
  }
}

function parseVerticalAxisValue(axisText) {
  const match = cleanText(axisText).match(/^x\s*=\s*([-+]?\d*\.?\d+)$/i);
  return match ? Number(match[1]) : null;
}

function getVerticalConstantX(keyFeatures) {
  const referencePoint = keyFeatures.notable_points.find((point) => point.label === "x-constant reference");

  if (referencePoint) {
    return referencePoint.x;
  }

  if (keyFeatures.x_intercepts[0]) {
    return keyFeatures.x_intercepts[0].x;
  }

  return null;
}

function getHorizontalConstantY(keyFeatures) {
  if (keyFeatures.y_intercepts[0]) {
    return keyFeatures.y_intercepts[0].y;
  }

  return null;
}

function reflectPointAcrossAxis(point, axisValue) {
  if (!point || typeof axisValue !== "number" || !Number.isFinite(axisValue)) {
    return null;
  }

  return createPoint(2 * axisValue - point.x, point.y, point.approx);
}

function buildMovementSentences(graphType, keyFeatures, shapeSummary, compact = false) {
  switch (graphType) {
    case "line":
      if (keyFeatures.slope !== null && keyFeatures.slope > 0) {
        return compact
          ? ["As x increases y increases.", buildCompactSlopeMeaning(keyFeatures.slope)]
          : ["As x increases, y increases at a constant rate.", buildSlopeMeaning(keyFeatures.slope)];
      }

      if (keyFeatures.slope !== null && keyFeatures.slope < 0) {
        return compact
          ? ["As x increases y decreases.", buildCompactSlopeMeaning(keyFeatures.slope)]
          : ["As x increases, y decreases at a constant rate.", buildSlopeMeaning(keyFeatures.slope)];
      }

      return compact ? ["As x increases y stays the same."] : ["As x increases, y stays the same."];
    case "horizontal_line":
      return compact
        ? ["As x increases y stays the same.", "The graph stays at one height."]
        : ["As x increases, y stays the same.", "The graph stays at the same height all the way across."];
    case "vertical_line": {
      const xConstant = getVerticalConstantX(keyFeatures);
      return [
        xConstant === null
          ? compact
            ? "As y changes x stays fixed."
            : "As y changes, x stays fixed, so the graph goes straight up and down."
          : compact
            ? `As y changes x stays ${formatNumber(xConstant)}.`
            : `As y changes, x stays fixed at ${formatNumber(xConstant)}, so the graph goes straight up and down.`,
      ];
    }
    case "parabola":
      if (keyFeatures.vertex && keyFeatures.opens === "down") {
        return [
          compact
            ? `As x increases it rises to ${pointToText(keyFeatures.vertex)}.`
            : `As x increases, the graph rises to its highest point at ${pointToText(keyFeatures.vertex)} and then falls again.`,
          compact ? "After that it falls." : "This highest point is where the graph changes direction.",
        ];
      }

      if (keyFeatures.vertex) {
        return [
          compact
            ? `As x increases it falls to ${pointToText(keyFeatures.vertex)}.`
            : `As x increases, the graph falls to its lowest point at ${pointToText(keyFeatures.vertex)} and then rises again.`,
          compact ? "After that it rises." : "This lowest point is where the graph changes direction.",
        ];
      }

      return [
        keyFeatures.opens === "down"
          ? compact
            ? "As x increases the graph rises and then falls."
            : "As x increases, the graph rises and then falls."
          : compact
            ? "As x increases the graph falls and then rises."
            : "As x increases, the graph falls and then rises.",
      ];
    case "absolute_value":
      if (keyFeatures.vertex && keyFeatures.opens === "down") {
        return [
          compact
            ? `As x increases it rises to the corner at ${pointToText(keyFeatures.vertex)}.`
            : `As x increases, the graph rises to the corner at ${pointToText(keyFeatures.vertex)} and then falls away from it.`,
          compact ? "After that it falls." : "That corner is the point where the graph changes direction.",
        ];
      }

      if (keyFeatures.vertex) {
        return [
          compact
            ? `As x increases it falls to the corner at ${pointToText(keyFeatures.vertex)}.`
            : `As x increases, the graph falls to the corner at ${pointToText(keyFeatures.vertex)} and then rises away from it.`,
          compact ? "After that it rises." : "That corner is the point where the graph changes direction.",
        ];
      }

      return [
        keyFeatures.opens === "down"
          ? compact
            ? "As x increases the graph rises to a corner and then falls."
            : "As x increases, the graph rises to a corner and then falls."
          : compact
            ? "As x increases the graph falls to a corner and then rises."
            : "As x increases, the graph falls to a corner and then rises.",
      ];
    case "circle":
      return [
        compact ? "It curves around a center point." : "It curves around a center point instead of moving only up or only down as x increases.",
      ];
    case "polynomial": {
      const sentences = [];

      if (keyFeatures.increasing_intervals.length || keyFeatures.decreasing_intervals.length) {
        sentences.push(
          compact
            ? "As x increases the graph changes direction."
            : "As x increases, the graph changes direction in different parts of the plane.",
        );
      } else if (shapeSummary) {
        sentences.push(
          compact
            ? `As x increases the graph follows this pattern: ${cleanSentence(shapeSummary).slice(0, -1)}.`
            : `As x increases, the graph follows this overall pattern: ${cleanSentence(shapeSummary).slice(0, -1)}.`,
        );
      } else {
        sentences.push(
          compact
            ? "As x increases the graph changes direction more than once."
            : "As x increases, the graph changes direction more than once.",
        );
      }

      if (keyFeatures.increasing_intervals.length) {
        sentences.push(`It increases on ${keyFeatures.increasing_intervals.join(", ")}.`);
      }

      if (keyFeatures.decreasing_intervals.length) {
        sentences.push(`It decreases on ${keyFeatures.decreasing_intervals.join(", ")}.`);
      }

      return sentences;
    }
    case "piecewise": {
      const sentences = [
        compact
          ? "As x increases the graph changes from one segment to another."
          : "As x increases, the graph changes from one segment to another.",
      ];

      if (keyFeatures.increasing_intervals.length) {
        sentences.push(`Some segments rise on ${keyFeatures.increasing_intervals.join(", ")}.`);
      }

      if (keyFeatures.decreasing_intervals.length) {
        sentences.push(`Some segments fall on ${keyFeatures.decreasing_intervals.join(", ")}.`);
      }

      return sentences;
    }
    default:
      return [
        shapeSummary
          ? compact
            ? `As x increases the graph follows this shape: ${cleanSentence(shapeSummary).slice(0, -1)}.`
            : `As x increases, the graph follows this overall shape: ${cleanSentence(shapeSummary).slice(0, -1)}.`
          : compact
            ? "As x increases the graph changes across the plane."
            : "As x increases, the graph changes across the coordinate plane.",
      ];
  }
}

function buildAxisIntersectionSentences(graphType, keyFeatures, compact = false) {
  const sentences = [];
  const xConstant = getVerticalConstantX(keyFeatures);
  const yConstant = getHorizontalConstantY(keyFeatures);
  const liesOnYAxis = graphType === "vertical_line" && xConstant !== null && Math.abs(xConstant) < 1e-9;
  const liesOnXAxis = graphType === "horizontal_line" && yConstant !== null && Math.abs(yConstant) < 1e-9;

  if (liesOnYAxis) {
    sentences.push(
      compact
        ? "The graph lies on the y-axis."
        : "The graph lies on the y-axis, so every point on it has x equal to 0.",
    );
    if (compact) {
      sentences.push("Every point has x equal to 0.");
    }
  } else if (keyFeatures.y_intercepts.length === 1) {
    const point = keyFeatures.y_intercepts[0];
    sentences.push(
      compact
        ? `Crosses the y-axis at ${pointToText(point)}.`
        : `It crosses the y-axis at ${pointToText(point)}, meaning when x is zero, y is ${formatNumber(point.y)}.`,
    );
    if (compact) {
      sentences.push(`When x is 0 y is ${formatNumber(point.y)}.`);
    }
  } else if (keyFeatures.y_intercepts.length > 1) {
    sentences.push(
      compact
        ? `Crosses the y-axis at ${listPoints(keyFeatures.y_intercepts)}.`
        : `It crosses the y-axis at ${listPoints(keyFeatures.y_intercepts)}, meaning those are the points where x is zero.`,
    );
    if (compact) {
      sentences.push("Those are the points where x is 0.");
    }
  } else {
    sentences.push(
      compact
        ? "Does not cross the y-axis."
        : "It does not cross the y-axis, so there is no point on the graph where x is zero.",
    );
    if (compact) {
      sentences.push("X is never 0 on this graph.");
    }
  }

  if (liesOnXAxis) {
    sentences.push(
      compact
        ? "The graph lies on the x-axis."
        : "The graph lies on the x-axis, so every point on it has y equal to 0.",
    );
    if (compact) {
      sentences.push("Every point has y equal to 0.");
    }
  } else if (keyFeatures.x_intercepts.length === 1) {
    const point = keyFeatures.x_intercepts[0];
    sentences.push(
      compact
        ? `Crosses the x-axis at ${pointToText(point)}.`
        : `It crosses the x-axis at ${pointToText(point)}, meaning when y is zero, x is ${formatNumber(point.x)}.`,
    );
    if (compact) {
      sentences.push(`When y is 0 x is ${formatNumber(point.x)}.`);
    }
  } else if (keyFeatures.x_intercepts.length > 1) {
    sentences.push(
      compact
        ? `Crosses the x-axis at ${listPoints(keyFeatures.x_intercepts)}.`
        : `It crosses the x-axis at ${listPoints(keyFeatures.x_intercepts)}, meaning those are the points where y becomes zero.`,
    );
    if (compact) {
      sentences.push("Those are the points where y is 0.");
    }
  } else {
    sentences.push(
      compact
        ? "Does not cross the x-axis."
        : "It does not cross the x-axis, so there is no point on the graph where y becomes zero.",
    );
    if (compact) {
      sentences.push("Y is never 0 on this graph.");
    }
  }

  return sentences;
}

function collectExamplePoints(graphType, keyFeatures) {
  const points = [];
  const symmetryX = parseVerticalAxisValue(keyFeatures.axis_of_symmetry);
  const nonReferencePoints = keyFeatures.notable_points.filter((point) => point.label !== "x-constant reference");

  for (const point of keyFeatures.x_intercepts) {
    addPointIfMissing(points, point);
  }

  for (const point of keyFeatures.y_intercepts) {
    addPointIfMissing(points, point);
  }

  addPointIfMissing(points, keyFeatures.vertex);
  addPointIfMissing(points, keyFeatures.minimum_point);
  addPointIfMissing(points, keyFeatures.maximum_point);
  addPointIfMissing(points, keyFeatures.center);

  for (const point of nonReferencePoints) {
    addPointIfMissing(points, point);
  }

  if (graphType === "line" && keyFeatures.slope !== null && keyFeatures.y_intercepts[0]) {
    const intercept = keyFeatures.y_intercepts[0].y;

    for (const xValue of [2, 1, -1, -2]) {
      addPointIfMissing(points, createPoint(xValue, keyFeatures.slope * xValue + intercept));
    }
  }

  if (graphType === "horizontal_line") {
    const y = getHorizontalConstantY(keyFeatures);

    if (y !== null) {
      addPointIfMissing(points, createPoint(-2, y));
      addPointIfMissing(points, createPoint(0, y));
      addPointIfMissing(points, createPoint(2, y));
    }
  }

  if (graphType === "vertical_line") {
    const x = getVerticalConstantX(keyFeatures);

    if (x !== null) {
      addPointIfMissing(points, createPoint(x, -2));
      addPointIfMissing(points, createPoint(x, 0));
      addPointIfMissing(points, createPoint(x, 2));
    }
  }

  if ((graphType === "parabola" || graphType === "absolute_value") && symmetryX !== null) {
    for (const point of [...keyFeatures.y_intercepts, ...nonReferencePoints]) {
      addPointIfMissing(points, reflectPointAcrossAxis(point, symmetryX));
    }
  }

  if (graphType === "circle" && keyFeatures.center && keyFeatures.radius !== null) {
    addPointIfMissing(points, createPoint(keyFeatures.center.x - keyFeatures.radius, keyFeatures.center.y));
    addPointIfMissing(points, createPoint(keyFeatures.center.x, keyFeatures.center.y + keyFeatures.radius));
    addPointIfMissing(points, createPoint(keyFeatures.center.x + keyFeatures.radius, keyFeatures.center.y));
  }

  return points.slice(0, 3);
}

function buildExamplePointsSentence(points, compact = false) {
  if (points.length >= 2) {
    return compact
      ? `Example points ${listPoints(points)}.`
      : `Example points include ${listPoints(points)}.`;
  }

  if (points.length === 1) {
    return compact
      ? `One example point is ${pointToText(points[0])}.`
      : `One clear example point is ${pointToText(points[0])}.`;
  }

  return compact
    ? "Clear example points are not confirmed."
    : "Clear example points are not confirmed from the available graph details.";
}

function buildEquationSentence(equationText, compact = false) {
  if (!equationText) {
    return compact ? "Exact equation not confirmed." : "An exact equation is not confirmed from the available graph details.";
  }

  return compact ? `Equation: ${equationText}.` : `The equation of the graph is ${equationText}.`;
}

function isStructuredNaturalDescription(text) {
  const cleaned = cleanText(text);

  if (!cleaned) {
    return false;
  }

  const sentences = splitSentences(cleaned);
  const coordinateMatches = cleaned.match(/\([-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+\)/g) || [];
  const firstSentence = sentences[0] || "";
  const lastSentence = sentences[sentences.length - 1] || "";

  if (sentences.length < 5) {
    return false;
  }

  if (/\b(?:equation|y|x|f\(x\))\s*[:=]/i.test(firstSentence)) {
    return false;
  }

  if (!/(this graph|line|parabola|circle|piecewise|polynomial|absolute value|horizontal line|vertical line)/i.test(firstSentence)) {
    return false;
  }

  if (!/(as x increases|as y changes|rises|falls|goes straight up and down|curves around|stays the same|stays constant)/i.test(cleaned)) {
    return false;
  }

  if (!/(cross(?:es)? the x-axis|cross(?:es)? the y-axis|does not cross the x-axis|does not cross the y-axis|lies on the x-axis|lies on the y-axis)/i.test(cleaned)) {
    return false;
  }

  if (coordinateMatches.length < 2) {
    return false;
  }

  return /(equation|exact equation).*(=|confirmed)/i.test(lastSentence);
}

function buildNaturalDescription(graphType, equationText, axes, shapeSummary, keyFeatures) {
  const paragraphs = [
    [firstSentenceForGraph(graphType, keyFeatures), ...buildMovementSentences(graphType, keyFeatures, shapeSummary, false)],
    buildAxisIntersectionSentences(graphType, keyFeatures, false),
    [buildExamplePointsSentence(collectExamplePoints(graphType, keyFeatures), false)],
    [buildEquationSentence(equationText, false)],
  ];

  return paragraphs
    .map((paragraph) => paragraph.map(cleanSentence).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n");
}

function buildBrailleFriendlyDescription(graphType, equationText, keyFeatures) {
  const lines = [
    firstLineForBrailleGraph(graphType, keyFeatures),
    ...buildMovementSentences(graphType, keyFeatures, "", true),
    ...buildAxisIntersectionSentences(graphType, keyFeatures, true),
    buildExamplePointsSentence(collectExamplePoints(graphType, keyFeatures), true),
    buildEquationSentence(equationText, true),
  ];

  return lines.map(cleanSentence).filter(Boolean).join("\n");
}

function isStructuredBrailleDescription(text) {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n").trim();

  if (!normalized) {
    return false;
  }

  const lines = normalized.split("\n").map(cleanText).filter(Boolean);
  const firstLine = lines[0] || "";
  const lastLine = lines[lines.length - 1] || "";
  const coordinateMatches = normalized.match(/\([-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+\)/g) || [];

  if (lines.length < 5) {
    return false;
  }

  if (/\b(?:equation|y|x|f\(x\))\s*[:=]/i.test(firstLine)) {
    return false;
  }

  if (!/(line|parabola|circle|piecewise|polynomial|absolute value|horizontal|vertical|v-shaped|u-shaped|math graph)/i.test(firstLine)) {
    return false;
  }

  if (!lines.some((line) => /(as x increases|as y changes|when x increases|rises|falls|stays|curves)/i.test(line))) {
    return false;
  }

  if (!lines.some((line) => /(x-axis|y-axis|does not cross|lies on)/i.test(line))) {
    return false;
  }

  if (!lines.some((line) => /^Example points/i.test(line) || /^One example point/i.test(line))) {
    return false;
  }

  if (coordinateMatches.length < 2) {
    return false;
  }

  return /^Equation:/i.test(lastLine) || /^Exact equation/i.test(lastLine);
}

function buildNemethReadyTokens(equationText, graphType, keyFeatures) {
  const points = uniqueStrings([
    ...keyFeatures.x_intercepts.map(pointToText),
    ...keyFeatures.y_intercepts.map(pointToText),
    pointToText(keyFeatures.vertex),
    pointToText(keyFeatures.maximum_point),
    pointToText(keyFeatures.minimum_point),
    pointToText(keyFeatures.center),
    ...keyFeatures.notable_points.map(pointToText),
  ]);

  const relations = [];

  if (graphType === "line" && keyFeatures.slope !== null) {
    relations.push(keyFeatures.slope > 0 ? "rises from left to right" : "falls from left to right");
  }

  if (graphType === "vertical_line") {
    relations.push("x stays constant");
  }

  if (graphType === "horizontal_line") {
    relations.push("y stays constant");
  }

  if (keyFeatures.opens) {
    relations.push(`opens ${keyFeatures.opens}`);
  }

  if (keyFeatures.axis_of_symmetry) {
    relations.push(`symmetric about ${keyFeatures.axis_of_symmetry}`);
  }

  for (const point of keyFeatures.x_intercepts) {
    relations.push(`crosses x-axis at ${pointToText(point)}`);
  }

  for (const point of keyFeatures.y_intercepts) {
    relations.push(`crosses y-axis at ${pointToText(point)}`);
  }

  for (const interval of keyFeatures.increasing_intervals) {
    relations.push(`increasing on ${interval}`);
  }

  for (const interval of keyFeatures.decreasing_intervals) {
    relations.push(`decreasing on ${interval}`);
  }

  return {
    equation: equationText,
    points,
    relations: uniqueStrings(relations),
  };
}

export function createGraphInterpretationPrompt() {
  return `You are analyzing a mathematical graph for a blind user.

Describe the graph in a way that helps the user build a mental model of it.

Rules:
- Focus on mathematical meaning, not colors or decorative appearance.
- Identify the graph type if possible.
- The explanation must help the user imagine the graph step by step, not just list facts.
- Mention axes, intercepts, key points, direction, and equation if available.
- Use explicit coordinates when possible.
- If exact values are unclear, say "approximately".
- Do not hallucinate hidden values.
- Do not use phrases like "as shown" or "you can see".
- Do not start with the equation.
- Do not just list slope and intercepts without explaining what they mean.
- Use simple, clear sentences.
- Include movement language such as "as x increases, y increases" when it fits the graph.
- Include 2 to 3 explicit example points when possible.
- Make the natural description feel like a teacher explaining the graph to a blind student.

Return valid JSON only.

Schema:
{
  "graph_type": "line | parabola | absolute_value | vertical_line | horizontal_line | circle | polynomial | piecewise | unknown",
  "confidence": 0.0,
  "equation_text": "string or null",
  "axes": {
    "has_x_axis": true,
    "has_y_axis": true,
    "origin_visible": true,
    "scale_notes": "string"
  },
  "shape_summary": "short structural summary",
  "key_features": {
    "x_intercepts": [{"x": number, "y": 0, "approx": false}],
    "y_intercepts": [{"x": 0, "y": number, "approx": false}],
    "slope": "number or null",
    "increasing_intervals": ["string"],
    "decreasing_intervals": ["string"],
    "vertex": {"x": number, "y": number, "approx": false},
    "opens": "up | down | left | right | null",
    "axis_of_symmetry": "string or null",
    "maximum_point": {"x": number, "y": number},
    "minimum_point": {"x": number, "y": number},
    "center": {"x": number, "y": number},
    "radius": "number or null",
    "notable_points": [{"x": number, "y": number, "label": "string"}]
  },
  "natural_description": "clear explanation for a blind user or empty string",
  "braille_friendly_description": "shorter and simpler explanation or empty string",
  "nemeth_ready_tokens": {
    "equation": "string or null",
    "points": ["(x,y)"],
    "relations": ["string"]
  },
  "uncertainties": ["string"]
}

Important accessibility rule:
Both "natural_description" and "braille_friendly_description" must follow this order:
1. Overall shape and behavior. The first sentence must answer: "What kind of graph is this and how does it generally behave?"
2. How the graph changes or moves.
3. Axis intersections, with meaning explained in words.
4. Example points, with at least 2 to 3 explicit coordinates when possible.
5. Equation at the end.

The natural description should be detailed and explanatory.
The Braille-friendly version must be shorter, use one idea per line, keep the same order, and avoid unnecessary words.

Examples:
- "This graph shows a straight line rising from left to right."
- "This graph shows a U-shaped parabola opening upward."
- "This graph shows a horizontal line where y stays constant."`;
}

export function postProcessGraphAnalysisPayload(rawPayload = {}) {
  const uncertainties = uniqueStrings([
    ...(Array.isArray(rawPayload.uncertainties) ? rawPayload.uncertainties : []),
    ...(Array.isArray(rawPayload.uncertainty_notes) ? rawPayload.uncertainty_notes : []),
    ...(Array.isArray(rawPayload.notes) ? rawPayload.notes : []),
  ]);

  const equationText = normalizeEquationText(rawPayload.equation_text ?? rawPayload.equationText);
  const axes = normalizeAxes(rawPayload.axes, rawPayload);
  const keyFeatures = normalizeKeyFeatures(rawPayload.key_features, rawPayload);
  const rawType = normalizeGraphType(rawPayload.graph_type ?? rawPayload.graphType);
  const shapeSummary = cleanText(rawPayload.shape_summary ?? rawPayload.shapeSummary);
  const featureType = inferTypeFromFeatures(shapeSummary, keyFeatures);
  const equationInfo = inferTypeFromEquation(equationText);

  mergeEquationHintsIntoFeatures(equationInfo, keyFeatures);

  const graphType = resolveGraphType(rawType, featureType, equationInfo.type || "unknown", uncertainties);
  const resolvedShapeSummary = deriveShapeSummary(graphType, keyFeatures, shapeSummary);
  const rawNaturalDescription = String(rawPayload.natural_description ?? rawPayload.naturalDescription ?? "");
  const rawBrailleFriendlyDescription = String(
    rawPayload.braille_friendly_description ?? rawPayload.brailleFriendlyDescription ?? "",
  );
  const naturalDescription = isStructuredNaturalDescription(rawNaturalDescription)
    ? rawNaturalDescription
    : buildNaturalDescription(graphType, equationText, axes, resolvedShapeSummary, keyFeatures);
  const brailleFriendlyDescription = isStructuredBrailleDescription(rawBrailleFriendlyDescription)
    ? rawBrailleFriendlyDescription
    : buildBrailleFriendlyDescription(graphType, equationText, keyFeatures);

  return {
    graph_type: graphType,
    confidence: normalizeConfidence(rawPayload.confidence),
    equation_text: equationText,
    axes,
    shape_summary: resolvedShapeSummary,
    key_features: keyFeatures,
    natural_description: cleanStructuredDescription(naturalDescription, false),
    braille_friendly_description: cleanStructuredDescription(brailleFriendlyDescription, true),
    nemeth_ready_tokens: buildNemethReadyTokens(equationText, graphType, keyFeatures),
    uncertainties: uniqueStrings(uncertainties),
  };
}
