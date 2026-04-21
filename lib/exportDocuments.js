function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFileToken(value) {
  return String(value || "braille-vision")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getExportBaseName(documents) {
  if (documents.length === 1) {
    return sanitizeFileToken(documents[0].file_name.replace(/\.[^/.]+$/, "")) || "braille-document";
  }

  return `braille-library-${documents.length}-items`;
}

// Returns only the Braille text for each document, separated by a blank line.
function buildExportSections(documents) {
  return documents.map((doc) => doc.braille_text || "");
}

export async function exportDocuments(documents, format) {
  const safeDocuments = (documents || []).filter(Boolean);

  if (safeDocuments.length === 0) {
    throw new Error("Select at least one document before exporting.");
  }

  if (format === "brf") {
    // BRF = Braille Ready Format — NABCC ASCII encoding, 40 cells/line, 25 lines/page
    const UNICODE_TO_NABCC = {
      "\u2800": " ",
      "\u2801": "a", "\u2802": "1", "\u2803": "b", "\u2804": "'", "\u2805": "k",
      "\u2806": "2", "\u2807": "l", "\u2808": "@", "\u2809": "c", "\u280a": "i",
      "\u280b": "f", "\u280c": "/", "\u280d": "m", "\u280e": "s", "\u280f": "p",
      "\u2810": '"', "\u2811": "e", "\u2812": "3", "\u2813": "h", "\u2814": "9",
      "\u2815": "o", "\u2816": "6", "\u2817": "r", "\u2818": "^", "\u2819": "d",
      "\u281a": "j", "\u281b": "g", "\u281c": ">", "\u281d": "n", "\u281e": "t",
      "\u281f": "q", "\u2820": ",", "\u2821": "*", "\u2822": "5", "\u2823": "<",
      "\u2824": "-", "\u2825": "u", "\u2826": "8", "\u2827": "v", "\u2828": ".",
      "\u2829": "%", "\u282a": "[", "\u282b": "$", "\u282c": "+", "\u282d": "x",
      "\u282e": "!", "\u282f": "&", "\u2830": ";", "\u2831": ":", "\u2832": "4",
      "\u2833": "\\","\u2834": "0", "\u2835": "z", "\u2836": "7", "\u2837": "(",
      "\u2838": "_", "\u2839": "?", "\u283a": "w", "\u283b": "]", "\u283c": "#",
      "\u283d": "y", "\u283e": ")", "\u283f": "=",
    };

    function toBRF(unicodeBraille) {
      let ascii = "";
      for (const ch of unicodeBraille) {
        if (ch === "\n") { ascii += "\n"; continue; }
        if (ch === " ")  { ascii += " ";  continue; }
        ascii += UNICODE_TO_NABCC[ch] ?? ch;
      }
      // Wrap at 40 cells/line, paginate at 25 lines
      const CELLS = 40, LINES = 25;
      const wrapped = [];
      for (const line of ascii.split("\n")) {
        if (!line) { wrapped.push(""); continue; }
        for (let i = 0; i < line.length; i += CELLS) wrapped.push(line.slice(i, i + CELLS));
      }
      const pages = [];
      for (let i = 0; i < wrapped.length; i += LINES) pages.push(wrapped.slice(i, i + LINES).join("\n"));
      return pages.join("\n\f\n");
    }

    const combined = safeDocuments.map((doc) => toBRF(doc.braille_text)).join("\n\f\n");
    const blob = new Blob([combined], { type: "application/x-brf;charset=utf-8" });
    downloadBlob(blob, `${getExportBaseName(safeDocuments)}.brf`);
    return;
  }

  if (format === "txt") {
    // Pure Braille text only — no metadata
    const content = safeDocuments.map((doc) => doc.braille_text || "").join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${getExportBaseName(safeDocuments)}.txt`);
    return;
  }

  if (format === "docx") {
    const { Document, Packer, Paragraph } = await import("docx");

    const children = [];

    safeDocuments.forEach((document, index) => {
      if (index > 0) {
        children.push(new Paragraph({ text: "", pageBreakBefore: true }));
      }

      // Only Braille text — no metadata headers
      if (index > 0) {
        // page break between multiple documents already added above
      }
      document.braille_text.split("\n").forEach((line) => {
        children.push(new Paragraph({ text: line || " " }));
      });
    });



    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${getExportBaseName(safeDocuments)}.docx`);
    return;
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = 520;
    const canvasWidth = 1200;
    const scale = canvasWidth / contentWidth;

    for (let index = 0; index < safeDocuments.length; index += 1) {
      if (index > 0) {
        pdf.addPage();
      }

      const document = safeDocuments[index];
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("PDF export is not supported in this browser.");
      }

      context.font = `${16 * scale}px sans-serif`;

      // Only Braille text — no metadata
      const lines = [...document.braille_text.split("\n")];


      const wrappedLines = lines.flatMap((line) => {
        if (!line) {
          return [""];
        }

        const words = line.split(" ");
        const lineBuffer = [];
        let currentLine = "";

        words.forEach((word) => {
          const candidate = currentLine ? `${currentLine} ${word}` : word;

          if (context.measureText(candidate).width > contentWidth * scale) {
            lineBuffer.push(currentLine);
            currentLine = word;
          } else {
            currentLine = candidate;
          }
        });

        if (currentLine) {
          lineBuffer.push(currentLine);
        }

        return lineBuffer;
      });

      const lineHeight = 24 * scale;
      const padding = 48 * scale;
      canvas.width = canvasWidth;
      canvas.height = padding * 2 + wrappedLines.length * lineHeight;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111827";
      context.font = `${16 * scale}px sans-serif`;

      wrappedLines.forEach((line, lineIndex) => {
        context.fillText(line || " ", padding, padding + lineHeight * (lineIndex + 1));
      });

      const imageData = canvas.toDataURL("image/png");
      const renderHeight = Math.min(pageHeight - 80, (canvas.height / canvas.width) * contentWidth);
      const x = (pageWidth - contentWidth) / 2;
      pdf.addImage(imageData, "PNG", x, 40, contentWidth, renderHeight);
    }

    pdf.save(`${getExportBaseName(safeDocuments)}.pdf`);
    return;
  }

  throw new Error("Unsupported export format.");
}
