import { splitStoredTextForExport } from "@/lib/exportStructure";
import { buildBrfContentForDocuments } from "@/lib/brfExport";

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

export function buildBrailleExportPages(document) {
  return splitStoredTextForExport(document?.braille_text || "");
}

export async function exportDocuments(documents, format) {
  const safeDocuments = (documents || []).filter(Boolean);

  if (safeDocuments.length === 0) {
    throw new Error("Select at least one document before exporting.");
  }

  if (format === "brf") {
    const combined = buildBrfContentForDocuments(safeDocuments);
    const blob = new Blob([combined], { type: "application/x-brf;charset=utf-8" });
    downloadBlob(blob, `${getExportBaseName(safeDocuments)}.brf`);
    return;
  }

  if (format === "txt") {
    const content = safeDocuments
      .map((doc) => buildBrailleExportPages(doc).join("\n\f\n"))
      .join("\n\f\n");
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
      buildBrailleExportPages(document).forEach((page, pageIndex) => {
        if (pageIndex > 0) {
          children.push(new Paragraph({ text: "", pageBreakBefore: true }));
        }

        page.split("\n").forEach((line) => {
          children.push(new Paragraph({ text: line || " " }));
        });
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
      const document = safeDocuments[index];
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("PDF export is not supported in this browser.");
      }

      context.font = `${16 * scale}px sans-serif`;

      // Only Braille text — no metadata
      const pages = buildBrailleExportPages(document);

      pages.forEach((page, pageIndex) => {
        if (index > 0 || pageIndex > 0) {
          pdf.addPage();
        }

        const lines = page.split("\n");
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
      });
    }

    pdf.save(`${getExportBaseName(safeDocuments)}.pdf`);
    return;
  }

  throw new Error("Unsupported export format.");
}
