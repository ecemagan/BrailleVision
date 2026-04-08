let tesseractModulePromise;

async function getTesseractModule() {
  if (!tesseractModulePromise) {
    // OCR is only loaded when an image needs to be read.
    tesseractModulePromise = import("tesseract.js");
  }

  return tesseractModulePromise;
}

export async function extractImageText(file) {
  const { recognize } = await getTesseractModule();
  const {
    data: { text },
  } = await recognize(file, "eng+tur");

  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("No readable text was found in the selected image.");
  }

  return normalizedText;
}
