import { normalizeGraphAnalysisPayload } from "@/lib/graphResultUtils";
import { analyzeGraphImageOffline } from "@/lib/offlineGraphAnalysis";

export async function analyzeGraphImage(file, locale = "en") {
  if (!file) {
    throw new Error("Choose a graph image before starting the analysis.");
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("locale", locale);

  try {
    const response = await fetch("/api/process_graph", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "";

      try {
        const payload = await response.json();
        errorMessage = payload?.detail || payload?.message || "";
      } catch {
        errorMessage = await response.text();
      }

      throw new Error(errorMessage || `Server error: ${response.status}`);
    }

    const payload = await response.json();
    return normalizeGraphAnalysisPayload(payload, locale);
  } catch {
    const fallbackPayload = await analyzeGraphImageOffline(file, locale);
    return normalizeGraphAnalysisPayload(fallbackPayload, locale);
  }
}
