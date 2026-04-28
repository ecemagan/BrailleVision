function isTurkish(locale) {
  return String(locale || "").toLowerCase().startsWith("tr");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLetters(value) {
  return /[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(value);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function getBBoxCenter(bbox = {}) {
  const x0 = Number(bbox.x0 || 0);
  const x1 = Number(bbox.x1 || 0);
  const y0 = Number(bbox.y0 || 0);
  const y1 = Number(bbox.y1 || 0);

  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
  };
}

function getDefaultStrings(locale) {
  if (isTurkish(locale)) {
    return {
      defaultTitle: "Temel çevrimdışı grafik okuması",
      genericType: "Genel grafik / chart",
      functionType: "Fonksiyon grafiği",
      lineType: "Çizgi grafiği",
      barType: "Sütun / bar grafiği",
      scatterType: "Saçılım grafiği",
      pieType: "Pasta grafiği",
      histogramType: "Histogram",
      xUnknown: "Alt eksende değerler veya kategoriler görünüyor; etiket tam okunamadı.",
      yUnknown: "Sol eksende ölçek veya ölçüm bilgisi var; etiket tam okunamadı.",
      valuesUnknown: "Görünen sayılar sınırlı veya OCR ile net okunamadı.",
      modeLabel: "Offline Basic",
      unclearTrend: "belirsiz",
      increasingTrend: "artan",
      decreasingTrend: "azalan",
      horizontalTrend: "yatay",
      confidence: "low",
      noCaption: "",
      titleObservation: (title) => `Başlık olarak en olası metin: ${title}.`,
      xObservation: (label) => `X ekseni için okunan ifade: ${label}.`,
      yObservation: (label) => `Y ekseni için okunan ifade: ${label}.`,
      valuesObservation: (values) => `Görselde seçilebilen bazı sayılar: ${values.join(", ")}.`,
      textObservation: (count) => `Grafik üzerinde OCR ile yaklaşık ${count} metin satırı seçildi.`,
      plainSummary: ({ graphType, equationText, trendDirection, yInterceptText, xInterceptText }) =>
        `${graphType}${equationText ? `, görünür denklem ${equationText}` : ""}${trendDirection && trendDirection !== "belirsiz" ? `, eğilim ${trendDirection}` : ""}${yInterceptText ? `, y kesişimi ${yInterceptText}` : ""}${xInterceptText ? `, x kesişimi ${xInterceptText}` : ""}.`,
      mathSummary: ({ explanationText }) => explanationText,
      classroomTip: "Başlığı, eksen adlarını ve görünen sayıları görselle karşılaştırın. Bu temel mod özellikle etiket doğrulama için uygundur.",
      lineExplanation: ({ equationText, trendSentence, yInterceptText, xInterceptText, axisSentence, captionText, noteText }) =>
        [
          "Bu grafik x-y koordinat düzleminde çizilmiş bir doğru gösteriyor.",
          equationText ? `Görselde seçilebilen denklem ${equationText}.` : "",
          trendSentence,
          yInterceptText ? `Doğru y eksenini ${yInterceptText} noktasında kesiyor gibi görünüyor.` : "",
          xInterceptText ? `Doğru x eksenini ${xInterceptText} noktasında kesiyor gibi görünüyor.` : "",
          axisSentence,
          captionText ? `Görünen açıklama metni ${captionText}.` : "",
          noteText,
        ]
          .filter(Boolean)
          .join(" "),
      genericExplanation: ({ graphType, axisSentence, captionText, noteText }) =>
        [
          `Bu görsel ${graphType.toLowerCase()} olarak yorumlandı.`,
          axisSentence,
          captionText ? `Görünen açıklama metni ${captionText}.` : "",
          noteText,
        ]
          .filter(Boolean)
          .join(" "),
    };
  }

  return {
    defaultTitle: "Basic offline graph reading",
    genericType: "General graph / chart",
    functionType: "Function graph",
    lineType: "Line graph",
    barType: "Bar chart",
    scatterType: "Scatter plot",
    pieType: "Pie chart",
    histogramType: "Histogram",
    xUnknown: "Values or categories are visible along the lower axis, but the label could not be read clearly.",
    yUnknown: "A scale or measured quantity is visible on the left axis, but the label could not be read clearly.",
    valuesUnknown: "Visible numeric marks were limited or not read clearly by OCR.",
    modeLabel: "Offline Basic",
    unclearTrend: "unclear",
    increasingTrend: "increasing",
    decreasingTrend: "decreasing",
    horizontalTrend: "horizontal",
    confidence: "low",
    noCaption: "",
    titleObservation: (title) => `Most likely title text: ${title}.`,
    xObservation: (label) => `Detected x-axis text: ${label}.`,
    yObservation: (label) => `Detected y-axis text: ${label}.`,
    valuesObservation: (values) => `Some visible values detected in the image: ${values.join(", ")}.`,
    textObservation: (count) => `OCR detected about ${count} text lines on the graph.`,
    plainSummary: ({ graphType, equationText, trendDirection, yInterceptText, xInterceptText }) =>
      `${graphType}${equationText ? `, visible equation ${equationText}` : ""}${trendDirection && trendDirection !== "unclear" ? `, trend ${trendDirection}` : ""}${yInterceptText ? `, y-intercept ${yInterceptText}` : ""}${xInterceptText ? `, x-intercept ${xInterceptText}` : ""}.`,
    mathSummary: ({ explanationText }) => explanationText,
    classroomTip: "Compare the title, axis labels, and visible numeric marks with the image. This basic mode is best used to verify labels and support side-by-side checking.",
    lineExplanation: ({ equationText, trendSentence, yInterceptText, xInterceptText, axisSentence, captionText, noteText }) =>
      [
        "This graph shows a straight line on an x-y coordinate plane.",
        equationText ? `The visible equation is ${equationText}.` : "",
        trendSentence,
        yInterceptText ? `It crosses the y-axis at ${yInterceptText}.` : "",
        xInterceptText ? `It crosses the x-axis at ${xInterceptText}.` : "",
        axisSentence,
        captionText ? `A nearby caption reads ${captionText}.` : "",
        noteText,
      ]
        .filter(Boolean)
        .join(" "),
    genericExplanation: ({ graphType, axisSentence, captionText, noteText }) =>
      [
        `This image appears to show a ${graphType.toLowerCase()}.`,
        axisSentence,
        captionText ? `A nearby caption reads ${captionText}.` : "",
        noteText,
      ]
        .filter(Boolean)
        .join(" "),
  };
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(isTurkish(locale) ? "tr-TR" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

async function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image dimensions could not be read."));
    };

    image.src = objectUrl;
  });
}

function detectGraphType(text, fileName, strings) {
  const combined = `${text} ${fileName}`.toLowerCase();

  if (/histogram|bins?|frequency\s+distribution/.test(combined)) {
    return strings.histogramType;
  }

  if (/scatter|scatterplot|dot\s*plot|nokta|dağılım|dagilim/.test(combined)) {
    return strings.scatterType;
  }

  if (/bar|column|sütun|sutun|çubuk|cubuk/.test(combined)) {
    return strings.barType;
  }

  if (/pie|circle\s*chart|pasta|dilim/.test(combined)) {
    return strings.pieType;
  }

  if (/y\s*=|f\(x\)|x\^|parab|sin|cos|tan|log|sqrt/.test(combined)) {
    return strings.functionType;
  }

  if (/line\s*graph|line\s*chart|trend|zaman|month|week|year|oran/.test(combined)) {
    return strings.lineType;
  }

  return strings.genericType;
}

function normalizeEquationText(value) {
  return String(value || "")
    .replace(/[−—–]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

function inferTitle(lines, imageHeight, strings, fileName) {
  const candidates = lines
    .filter((line) => line.center.y <= imageHeight * 0.24 && hasLetters(line.text))
    .sort((left, right) => right.text.length - left.text.length || left.center.y - right.center.y);

  if (candidates[0]?.text) {
    return candidates[0].text;
  }

  const cleanName = normalizeText(String(fileName || "").replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
  return cleanName || strings.defaultTitle;
}

function inferAxisX(lines, imageHeight, strings) {
  const candidates = lines
    .filter((line) => line.center.y >= imageHeight * 0.72 && hasLetters(line.text))
    .sort((left, right) => left.center.y - right.center.y || right.text.length - left.text.length);

  if (candidates[0]?.text) {
    return candidates[0].text;
  }

  return strings.xUnknown;
}

function inferAxisY(lines, imageWidth, imageHeight, strings) {
  const candidates = lines
    .filter(
      (line) =>
        line.center.x <= imageWidth * 0.28 &&
        line.center.y >= imageHeight * 0.12 &&
        line.center.y <= imageHeight * 0.84 &&
        hasLetters(line.text),
    )
    .sort((left, right) => left.center.y - right.center.y || right.text.length - left.text.length);

  if (candidates[0]?.text) {
    return candidates[0].text;
  }

  return strings.yUnknown;
}

function extractValues(text) {
  return uniq((text.match(/-?\d+(?:[.,]\d+)?%?/g) || []).slice(0, 8));
}

function detectEquationText(text) {
  const compactText = String(text || "").replace(/[−—–]/g, "-");
  const match = compactText.match(/\b(?:y|f\(x\))\s*=\s*[^\n,;]+/i);
  return match ? normalizeText(match[0]) : "";
}

function inferCaption(lines, imageHeight) {
  const candidates = lines
    .filter((line) => line.center.y >= imageHeight * 0.82 && hasLetters(line.text))
    .sort((left, right) => right.text.length - left.text.length || right.center.y - left.center.y);

  return candidates[0]?.text || "";
}

function inferTrendDirection(equationText, strings) {
  const linear = parseLinearEquation(equationText);

  if (!linear) {
    return strings.unclearTrend;
  }

  if (linear.slope > 0) {
    return strings.increasingTrend;
  }

  if (linear.slope < 0) {
    return strings.decreasingTrend;
  }

  return strings.horizontalTrend;
}

function inferIntercepts(equationText, locale) {
  const linear = parseLinearEquation(equationText);

  if (!linear) {
    return {
      xInterceptText: "",
      yInterceptText: "",
    };
  }

  return {
    xInterceptText: linear.xIntercept === null ? "" : formatNumber(linear.xIntercept, locale),
    yInterceptText: formatNumber(linear.intercept, locale),
  };
}

function parseLinearEquation(equationText) {
  const normalizedEquation = normalizeEquationText(equationText);
  const constantMatch = normalizedEquation.match(/^(?:y|f\(x\))=([+-]?\d+(?:\.\d+)?)$/i);

  if (constantMatch) {
    const intercept = Number(constantMatch[1]);
    if (!Number.isFinite(intercept)) {
      return null;
    }

    return {
      slope: 0,
      intercept,
      xIntercept: intercept === 0 ? 0 : null,
    };
  }

  const slopeMatch = normalizedEquation.match(/^(?:y|f\(x\))=([+-]?)(\d*(?:\.\d+)?)x(?:([+-])(\d+(?:\.\d+)?))?$/i);

  if (!slopeMatch) {
    return null;
  }

  const sign = slopeMatch[1] === "-" ? -1 : 1;
  const magnitude = slopeMatch[2] ? Number(slopeMatch[2]) : 1;
  const slope = sign * magnitude;
  const intercept =
    slopeMatch[3] && slopeMatch[4]
      ? (slopeMatch[3] === "-" ? -1 : 1) * Number(slopeMatch[4])
      : 0;

  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) {
    return null;
  }

  return {
    slope,
    intercept,
    xIntercept: slope === 0 ? null : (-intercept / slope),
  };
}

function inferAxisSentence(axisX, axisY, locale) {
  const normalizedX = String(axisX || "").toLowerCase();
  const normalizedY = String(axisY || "").toLowerCase();
  const hasExplicitX = normalizedX === "x" || normalizedX.startsWith("x ");
  const hasExplicitY = normalizedY === "y" || normalizedY.startsWith("y ");

  if (isTurkish(locale)) {
    if (hasExplicitX && hasExplicitY) {
      return "Grafikte etiketlenmiş x ve y eksenleri görülüyor.";
    }

    if (axisX && axisY) {
      return `Grafikte x ekseni için ${axisX} ve y ekseni için ${axisY} bilgisi görülüyor.`;
    }

    if (axisX) {
      return `Grafikte x ekseni için ${axisX} bilgisi görülüyor.`;
    }

    if (axisY) {
      return `Grafikte y ekseni için ${axisY} bilgisi görülüyor.`;
    }

    return "";
  }

  if (hasExplicitX && hasExplicitY) {
    return "The graph includes labeled x and y axes.";
  }

  if (axisX && axisY) {
    return `The graph shows ${axisX} on the x-axis and ${axisY} on the y-axis.`;
  }

  if (axisX) {
    return `The x-axis appears to be labeled as ${axisX}.`;
  }

  if (axisY) {
    return `The y-axis appears to be labeled as ${axisY}.`;
  }

  return "";
}

function inferTrendSentence(trendDirection, locale) {
  const normalizedTrend = String(trendDirection || "").toLowerCase();

  if (isTurkish(locale)) {
    if (normalizedTrend === "artan") {
      return "Doğru soldan sağa yükseliyor, yani fonksiyon artan.";
    }
    if (normalizedTrend === "azalan") {
      return "Doğru soldan sağa düşüyor, yani fonksiyon azalan.";
    }
    if (normalizedTrend === "yatay") {
      return "Doğru yatay görünüyor, yani fonksiyon sabit.";
    }
    return "";
  }

  if (normalizedTrend === "increasing") {
    return "The line rises from left to right, so the function is increasing.";
  }
  if (normalizedTrend === "decreasing") {
    return "The line falls from left to right, so the function is decreasing.";
  }
  if (normalizedTrend === "horizontal") {
    return "The line is horizontal, so the function stays constant.";
  }

  return "";
}

async function runLocalOcr(file, locale) {
  const { createWorker } = await import("tesseract.js");
  const languages = isTurkish(locale) ? "tur+eng" : "eng";
  const worker = await createWorker(languages);

  try {
    const { data } = await worker.recognize(file);
    return data;
  } finally {
    await worker.terminate();
  }
}

function normalizeOcrLines(ocrData) {
  return (ocrData?.lines || [])
    .map((line) => {
      const text = normalizeText(line?.text);

      return {
        text,
        bbox: line?.bbox || {},
        center: getBBoxCenter(line?.bbox),
      };
    })
    .filter((line) => line.text);
}

function buildOfflineNarration({ locale, fileName, ocrText = "", ocrLines = [], imageWidth = 1, imageHeight = 1 }) {
  const strings = getDefaultStrings(locale);
  const equationText = detectEquationText(ocrText);
  const linearEquation = parseLinearEquation(equationText);
  const graphType = linearEquation ? strings.lineType : detectGraphType(ocrText, fileName, strings);
  const title = inferTitle(ocrLines, imageHeight, strings, fileName);
  const axisX = inferAxisX(ocrLines, imageHeight, strings);
  const axisY = inferAxisY(ocrLines, imageWidth, imageHeight, strings);
  const values = extractValues(ocrText);
  const captionText = inferCaption(ocrLines, imageHeight);
  const trendDirection = inferTrendDirection(equationText, strings);
  const intercepts = inferIntercepts(equationText, locale);
  const axisSentence = inferAxisSentence(axisX, axisY, locale);
  const trendSentence = inferTrendSentence(trendDirection, locale);
  const noteText = values.length
    ? ""
    : isTurkish(locale)
      ? "Bazı sayısal işaretler net okunamadığı için açıklama yaklaşık yorum içeriyor."
      : "Some numeric markings were not read clearly, so parts of the explanation are approximate.";

  const keyObservations = [
    strings.titleObservation(title),
    equationText ? (isTurkish(locale) ? `Okunan denklem: ${equationText}.` : `Detected equation: ${equationText}.`) : "",
    strings.xObservation(axisX),
    strings.yObservation(axisY),
    trendSentence,
    intercepts.yInterceptText
      ? (isTurkish(locale) ? `Y kesişimi: ${intercepts.yInterceptText}.` : `Y-intercept: ${intercepts.yInterceptText}.`)
      : "",
    intercepts.xInterceptText
      ? (isTurkish(locale) ? `X kesişimi: ${intercepts.xInterceptText}.` : `X-intercept: ${intercepts.xInterceptText}.`)
      : "",
    values.length ? strings.valuesObservation(values) : strings.valuesUnknown,
    strings.textObservation(ocrLines.length),
  ].filter(Boolean);

  const explanationText = linearEquation
    ? strings.lineExplanation({
        equationText,
        trendSentence,
        yInterceptText: intercepts.yInterceptText,
        xInterceptText: intercepts.xInterceptText,
        axisSentence,
        captionText,
        noteText,
      })
    : strings.genericExplanation({
        graphType,
        axisSentence,
        captionText,
        noteText,
      });

  return {
    title,
    graphType,
    axisX,
    axisY,
    trendDirection,
    xInterceptText: intercepts.xInterceptText,
    yInterceptText: intercepts.yInterceptText,
    equationText,
    captionText,
    explanationText,
    plainLanguageSummary: strings.plainSummary({
      graphType,
      equationText,
      trendDirection,
      yInterceptText: intercepts.yInterceptText,
      xInterceptText: intercepts.xInterceptText,
    }),
    mathematicalSummary: strings.mathSummary({ explanationText }),
    keyObservations,
    classroomTip: strings.classroomTip,
    confidence: strings.confidence,
    notes: values.length ? [] : [strings.valuesUnknown],
    analysisMode: "offline-basic",
    analysisModeLabel: strings.modeLabel,
    extractedText: ocrText,
  };
}

export async function analyzeGraphImageOffline(file, locale = "en") {
  const dimensions = await getImageDimensions(file);

  try {
    const ocrData = await runLocalOcr(file, locale);
    const normalizedLines = normalizeOcrLines(ocrData);
    const normalizedText = normalizeText(ocrData?.text || normalizedLines.map((line) => line.text).join(" "));

    return buildOfflineNarration({
      locale,
      fileName: file?.name,
      ocrText: normalizedText,
      ocrLines: normalizedLines,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    });
  } catch {
    return buildOfflineNarration({
      locale,
      fileName: file?.name,
      ocrText: "",
      ocrLines: [],
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    });
  }
}
