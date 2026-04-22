export async function translateBrailleText(text) {
  const normalizedText = String(text || "");

  if (!normalizedText.trim()) {
    return "";
  }

  const response = await fetch("/api/translate_braille_text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: normalizedText }),
  });

  if (!response.ok) {
    let detail = "";

    try {
      const payload = await response.json();
      detail = payload?.detail || payload?.message || "";
    } catch {
      detail = await response.text();
    }

    throw new Error(detail || `Braille translation failed with status ${response.status}.`);
  }

  const data = await response.json();
  return String(data?.braille || "");
}
