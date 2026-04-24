import { readErrorResponseMessage } from "@/lib/readErrorResponse";

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
    const detail = await readErrorResponseMessage(response);
    throw new Error(detail || `Braille translation failed with status ${response.status}.`);
  }

  const data = await response.json();
  return String(data?.braille || "");
}
