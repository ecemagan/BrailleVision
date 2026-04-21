chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translateMathToBraille",
        title: "Translate math to Nemeth Braille",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "translateTextToBraille",
        title: "Translate text to Braille",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translateMathToBraille") {
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
});
