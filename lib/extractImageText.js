export async function extractImageText(file) {
  // Use Gemini Vision on the backend instead of local Tesseract
  // This provides perfectly accurate math extraction and valid Turkish text
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("http://localhost:8000/api/extract_image_text_full", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    let extractedText = data.text;
    
    // Clear markdown code blocks if the model accidentally included them
    extractedText = extractedText.replace(/^```[a-z]*\n/gm, "").replace(/```$/gm, "");

    const normalizedText = extractedText.trim();

    if (!normalizedText) {
      throw new Error("No readable text or math formulas were found in the selected image.");
    }

    return normalizedText;
  } catch (err) {
    console.error("Gemini API image extraction failed:", err);
    throw new Error("Görsel okunurken bir hata oluştu veya API kullanılamıyor. Lütfen tekrar deneyin.");
  }
}

