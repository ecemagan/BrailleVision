// Client-side PDF text extraction using Mozilla PDF.js.
export async function extractPdfText(file) {
  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const tokens = [];

    for (const item of textContent.items) {
      if (!("str" in item)) {
        continue;
      }

      const value = item.str.trim();
      if (!value) {
        continue;
      }

      tokens.push(value);

      if (item.hasEOL) {
        tokens.push("\n");
      }
    }

    const pageText = tokens
      .join(" ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  const extractedText = pageTexts.join("\n\n").trim();

  if (!extractedText) {
    throw new Error("This PDF does not contain selectable text. OCR support is not added yet.");
  }

  return extractedText;
}
