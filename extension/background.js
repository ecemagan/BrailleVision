chrome.runtime.onInstalled.addListener(() => {
    // Auto-detect (smart) option — shown first
    chrome.contextMenus.create({
        id: "translateAutoBraille",
        title: "⠿ BrailleVision: Braille'e Çevir (Otomatik)",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "translateMathToBraille",
        title: "⠿ BrailleVision: Matematik → Nemeth Braille",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "translateTextToBraille",
        title: "⠿ BrailleVision: Metin → Braille Alfabesi",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translateAutoBraille") {
        chrome.tabs.sendMessage(tab.id, { action: "translateAuto", text: info.selectionText });
    } else if (info.menuItemId === "translateMathToBraille") {
        chrome.tabs.sendMessage(tab.id, { action: "translateMath", text: info.selectionText });
    } else if (info.menuItemId === "translateTextToBraille") {
        chrome.tabs.sendMessage(tab.id, { action: "translateAlpha", text: info.selectionText });
    }
});

const API_BASE_URLS = ["http://localhost:8000", "http://127.0.0.1:8000"];

async function callBackend(path, payload) {
    let lastError = null;

    for (const baseUrl of API_BASE_URLS) {
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const bodyText = await response.text().catch(() => "");
                throw new Error(`Backend error (${response.status}): ${bodyText || "No details"}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Failed to reach backend");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "bvApiProcessText") {
        callBackend("/api/process_text", { text: request.text || "" })
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message || "Failed to reach backend" }));
        return true;
    }

    if (request.action === "bvApiTranslateBrailleText") {
        callBackend("/api/translate_braille_text", { text: request.text || "" })
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message || "Failed to reach backend" }));
        return true;
    }

    // Auto-detect: try math first, fall back to text if it fails or has no results
    if (request.action === "bvApiAutoTranslate") {
        const text = request.text || "";
        callBackend("/api/process_text", { text })
            .then((data) => {
                // If math engine returned results, use them
                if (data.results && data.results.length > 0 && !data.results.every(r => r.error)) {
                    sendResponse({ ok: true, data, mode: "math" });
                } else {
                    // Math had no results → fall back to plain text
                    return callBackend("/api/translate_braille_text", { text })
                        .then((textData) => sendResponse({ ok: true, data: textData, mode: "text" }));
                }
            })
            .catch(() => {
                // Math failed entirely → fall back to plain text
                callBackend("/api/translate_braille_text", { text })
                    .then((textData) => sendResponse({ ok: true, data: textData, mode: "text" }))
                    .catch((error) => sendResponse({ ok: false, error: error.message || "Failed to reach backend" }));
            });
        return true;
    }
});
