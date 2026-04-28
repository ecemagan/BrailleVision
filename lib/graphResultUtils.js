import { convertToBraille } from "@/lib/convertToBraille";
import { postProcessGraphAnalysisPayload } from "@/lib/graphAnalysisCore.mjs";

const TOKEN_PATTERN = /\s+|[^\p{L}\p{N}]|[\p{L}\p{N}]+/gu;

function ensureText(value) {
  return String(value || "").trim();
}

function ensureBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
}

function getAnalysisModeLabel(mode, locale) {
  const normalizedMode = ensureText(mode).toLowerCase();

  if (normalizedMode === "ai-vision") {
    return locale === "tr" ? "AI Vision" : "AI Vision";
  }

  if (normalizedMode === "offline-basic") {
    return locale === "tr" ? "Offline Basic" : "Offline Basic";
  }

  return locale === "tr" ? "Bilinmeyen mod" : "Unknown mode";
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

function pointToText(point) {
  if (!point) {
    return "";
  }

  const prefix = point.approx ? "approximately " : "";
  return `${prefix}(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
}

function formatPointList(points) {
  if (!Array.isArray(points) || !points.length) {
    return "";
  }

  if (points.length === 1) {
    return pointToText(points[0]);
  }

  return points.map(pointToText).join(", ");
}

function formatGraphType(graphType, locale) {
  const labels = {
    en: {
      line: "Line",
      parabola: "Parabola",
      absolute_value: "Absolute Value",
      vertical_line: "Vertical Line",
      horizontal_line: "Horizontal Line",
      circle: "Circle",
      polynomial: "Polynomial",
      piecewise: "Piecewise",
      unknown: "Unknown",
    },
    tr: {
      line: "Doğru",
      parabola: "Parabol",
      absolute_value: "Mutlak Değer",
      vertical_line: "Dikey Doğru",
      horizontal_line: "Yatay Doğru",
      circle: "Çember",
      polynomial: "Polinom",
      piecewise: "Parçalı",
      unknown: "Belirsiz",
    },
  };

  const language = locale === "tr" ? "tr" : "en";
  return labels[language][graphType] || labels[language].unknown;
}

function formatAxisStatus(isPresent, locale) {
  if (locale === "tr") {
    return isPresent ? "Var" : "Doğrulanmadı";
  }

  return isPresent ? "Present" : "Not confirmed";
}

function formatTrendDirection(processed, locale) {
  const { graph_type: graphType, key_features: keyFeatures } = processed;
  const english =
    graphType === "vertical_line"
      ? "Constant x"
      : graphType === "horizontal_line"
        ? "Constant"
        : graphType === "line"
          ? keyFeatures.slope !== null && keyFeatures.slope < 0
            ? "Decreasing"
            : "Increasing"
          : graphType === "parabola" || graphType === "absolute_value"
            ? keyFeatures.opens === "down"
              ? "Increasing then decreasing"
              : "Decreasing then increasing"
            : keyFeatures.increasing_intervals.length && keyFeatures.decreasing_intervals.length
              ? "Mixed"
              : keyFeatures.increasing_intervals.length
                ? "Increasing"
                : keyFeatures.decreasing_intervals.length
                  ? "Decreasing"
                  : "Unclear";

  if (locale !== "tr") {
    return english;
  }

  const translationMap = {
    "Constant x": "Sabit x",
    Constant: "Sabit",
    Increasing: "Artan",
    Decreasing: "Azalan",
    "Increasing then decreasing": "Önce artan sonra azalan",
    "Decreasing then increasing": "Önce azalan sonra artan",
    Mixed: "Karışık",
    Unclear: "Belirsiz",
  };

  return translationMap[english] || english;
}

function formatConfidence(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.68";
  }

  return value.toFixed(2);
}

function buildTitle(processed, locale) {
  const typeLabel = formatGraphType(processed.graph_type, locale);

  if (locale === "tr") {
    return `${typeLabel} açıklaması`;
  }

  return `${typeLabel} description`;
}

function buildNotes(processed) {
  return [
    processed.axes.scale_notes || "",
    ...processed.uncertainties,
  ].filter(Boolean);
}

function buildClassroomTip(processed, locale) {
  if (locale === "tr") {
    return processed.equation_text
      ? "Önce denklemi ve eksenleri kontrol edin. Sonra kesişim noktalarını ve ana özellikleri doğrulayın."
      : "Önce eksenleri kontrol edin. Sonra ana noktaları ve grafik davranışını doğrulayın.";
  }

  return processed.equation_text
    ? "Check the equation and the axes first. Then verify the intercepts and the main graph features."
    : "Check the axes first. Then verify the key points and the overall graph behavior.";
}

export function buildGraphSegments(text) {
  return Array.from(String(text || "").matchAll(TOKEN_PATTERN), (match, index) => {
    const token = match[0];
    const isSpace = /^\s+$/.test(token);

    return {
      id: `seg_${index + 1}`,
      text: token,
      braille: isSpace ? token : convertToBraille(token),
      kind: isSpace ? "space" : token.length === 1 && !/[\p{L}\p{N}]/u.test(token) ? "punctuation" : "word",
      is_interactive: !isSpace,
    };
  });
}

function normalizeSegments(segments, explanationText) {
  if (Array.isArray(segments) && segments.length > 0) {
    return segments.map((segment, index) => ({
      id: segment.id || `seg_${index + 1}`,
      text: segment.text || "",
      braille: segment.braille || (segment.text?.trim() ? convertToBraille(segment.text) : segment.text || ""),
      kind: segment.kind || (/^\s+$/.test(segment.text || "") ? "space" : "word"),
      is_interactive: segment.is_interactive ?? !/^\s+$/.test(segment.text || ""),
    }));
  }

  return buildGraphSegments(explanationText);
}

export function normalizeGraphAnalysisPayload(payload, locale = "en") {
  const processed = postProcessGraphAnalysisPayload(payload);
  const analysisMode =
    ensureText(payload?.mode_used) ||
    ensureText(payload?.modeUsed) ||
    ensureText(payload?.analysisMode) ||
    "offline-basic";
  const syncedText = processed.braille_friendly_description || processed.natural_description;
  const explanationBraille = ensureText(payload?.explanation_braille) || convertToBraille(syncedText);
  const notes = buildNotes(processed);

  return {
    title: ensureText(payload?.title) || buildTitle(processed, locale),
    graphType: formatGraphType(processed.graph_type, locale),
    coordinatePlanePresent: processed.axes.has_x_axis || processed.axes.has_y_axis,
    axisX: formatAxisStatus(processed.axes.has_x_axis, locale),
    axisY: formatAxisStatus(processed.axes.has_y_axis, locale),
    trendDirection: formatTrendDirection(processed, locale),
    xInterceptText: formatPointList(processed.key_features.x_intercepts),
    yInterceptText: formatPointList(processed.key_features.y_intercepts),
    equationText: ensureText(processed.equation_text),
    captionText: ensureText(payload?.caption_text) || ensureText(payload?.captionText),
    explanationText: processed.natural_description,
    brailleFriendlyDescription: processed.braille_friendly_description,
    explanationBraille,
    notes,
    confidence: formatConfidence(processed.confidence),
    confidenceScore: processed.confidence,
    analysisMode,
    analysisModeLabel: ensureText(payload?.analysisModeLabel) || getAnalysisModeLabel(analysisMode, locale),
    plainLanguageSummary: processed.natural_description,
    mathematicalSummary: processed.shape_summary,
    classroomTip: ensureText(payload?.classroom_tip) || ensureText(payload?.classroomTip) || buildClassroomTip(processed, locale),
    segments: normalizeSegments(payload?.segments, syncedText),
    rawAnalysis: processed,
  };
}

export function buildGraphDocumentText(result, t) {
  return [
    `${t("graphs.resultTitleLabel")}: ${result.title}`,
    `${t("graphs.graphTypeLabel")}: ${result.graphType}`,
    `${t("graphs.axisXLabel")}: ${result.axisX}`,
    `${t("graphs.axisYLabel")}: ${result.axisY}`,
    `${t("graphs.trendLabel")}: ${result.trendDirection}`,
    result.equationText ? `${t("graphs.equationLabel")}: ${result.equationText}` : "",
    `${t("graphs.confidenceLabel")}: ${result.confidence}`,
    "",
    result.explanationText,
    result.brailleFriendlyDescription ? "" : null,
    result.brailleFriendlyDescription ? `Braille-friendly: ${result.brailleFriendlyDescription}` : "",
    result.rawAnalysis?.shape_summary ? "" : null,
    result.rawAnalysis?.shape_summary ? `Shape summary: ${result.rawAnalysis.shape_summary}` : "",
    result.notes.length ? "" : null,
    result.notes.length ? `${t("graphs.notesLabel")}:` : "",
    ...result.notes.map((note, index) => `${index + 1}. ${note}`),
  ]
    .filter((line) => line !== null)
    .filter(Boolean)
    .join("\n");
}
