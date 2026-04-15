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

function buildExportSections(documents) {
  return documents.map((document, index) => {
    const tagLine = document.tags?.length ? `Tags: ${document.tags.join(", ")}` : "Tags: none";

    return [
      `Document ${index + 1}: ${document.file_name}`,
      `Source type: ${document.source_type}`,
      `Conversion mode: ${document.conversion_mode}`,
      tagLine,
      "",
      "Original text:",
      document.original_text,
      "",
      "Braille output:",
      document.braille_text,
    ].join("\n");
  });
}

export async function exportDocuments(documents, format) {
  const safeDocuments = (documents || []).filter(Boolean);

  if (safeDocuments.length === 0) {
    throw new Error("Select at least one document before exporting.");
  }

  if (format === "txt") {
    const blob = new Blob([buildExportSections(safeDocuments).join("\n\n\n")], {
      type: "text/plain;charset=utf-8",
    });
    downloadBlob(blob, `${getExportBaseName(safeDocuments)}.txt`);
    return;
  }

  if (format === "docx") {
    const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
    const children = [];

    safeDocuments.forEach((document, index) => {
      if (index > 0) {
        children.push(new Paragraph({ text: "", pageBreakBefore: true }));
      }

      children.push(
        new Paragraph({
          text: document.file_name,
          heading: HeadingLevel.HEADING_1,
        }),
      );
      children.push(new Paragraph({ children: [new TextRun({ text: `Source type: ${document.source_type}` })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Conversion mode: ${document.conversion_mode}` })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Tags: ${(document.tags || []).join(", ") || "none"}` })] }));
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Original text", bold: true })] }));
      document.original_text.split("\n").forEach((line) => {
        children.push(new Paragraph({ text: line || " " }));
      });
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Braille output", bold: true })] }));
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

      const lines = [
        document.file_name,
        "",
        `Source type: ${document.source_type}`,
        `Conversion mode: ${document.conversion_mode}`,
        `Tags: ${(document.tags || []).join(", ") || "none"}`,
        "",
        "Original text:",
        ...document.original_text.split("\n"),
        "",
        "Braille output:",
        ...document.braille_text.split("\n"),
      ];

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
