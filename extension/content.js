chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateMath" || request.action === "translate") {
        showMathPopup(request.text);
    } else if (request.action === "translateAlpha") {
        showAlphaPopup(request.text);
    }
});

/* ─── Matematik → Nemeth Braille ─────────────────────────────────────── */
async function showMathPopup(text) {
    const existing = document.getElementById("braillevision-ext-popup");
    if (existing) existing.remove();

    const popup = createBasePopup("BrailleVision – Matematik");
    document.body.appendChild(popup);

    document.getElementById("bv-close-btn").addEventListener("click", () => popup.remove());

    try {
        const response = await fetch("http://localhost:8000/api/process_text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        const contentDiv = popup.querySelector('.bv-content');
        contentDiv.innerHTML = '';

        if (!data.results || data.results.length === 0) {
            contentDiv.innerHTML = '<div class="bv-error">No mathematical expression was found.</div>';
            return;
        }

        data.results.forEach((res, index) => {
            const item = document.createElement('div');
            item.className = 'bv-result-item';

            if (res.error) {
                item.innerHTML = `<div class="bv-error">Error: ${res.error}</div>`;
            } else {
                item.innerHTML = `
                    <div class="bv-label">Expression:</div>
                    <div class="bv-math">${escapeHtml(res.expression)}</div>
                    ${res.explanation ? `
                      <div class="bv-label" style="display:flex; justify-content:space-between; align-items:center;">
                          AI explanation <button class="bv-tts-btn" id="tts-btn-${index}">🔊 Listen</button>
                      </div>
                      <div class="bv-explanation">${escapeHtml(res.explanation)}</div>
                    ` : ''}
                    <div class="bv-label">Nemeth Braille:</div>
                    <div class="bv-braille">${res.braille}</div>
                    <div style="text-align:right; margin-top:8px;">
                        <button class="bv-export-btn" id="export-btn-${index}">📥 Download (.txt)</button>
                    </div>
                `;
            }
            contentDiv.appendChild(item);

            if (!res.error) {
                const ttsBtn = document.getElementById(`tts-btn-${index}`);
                if (ttsBtn) {
                    ttsBtn.addEventListener('click', () => {
                        window.speechSynthesis.cancel();
                        let s = new SpeechSynthesisUtterance(res.explanation);
                        s.lang = 'tr-TR';
                        window.speechSynthesis.speak(s);
                    });
                }

                const exportBtn = document.getElementById(`export-btn-${index}`);
                if (exportBtn) {
                    exportBtn.addEventListener('click', () => {
                        const content = `Mathematical Expression:\n${res.expression}\n\nNemeth Braille Translation:\n${res.braille}\n`;
                        downloadTxt(content, 'BrailleVision_Math.txt');
                    });
                }
            }
        });

    } catch (err) {
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Translation could not be completed. Make sure the BrailleVision server (http://localhost:8000) is running in the background.</div>`;
    }
}

/* ─── Text → Braille alphabet ───────────────────────────────────────── */
async function showAlphaPopup(text) {
    const existing = document.getElementById("braillevision-ext-popup");
    if (existing) existing.remove();

    const popup = createBasePopup("BrailleVision – Braille Alfabesi");
    document.body.appendChild(popup);

    document.getElementById("bv-close-btn").addEventListener("click", () => popup.remove());

    try {
        const response = await fetch("http://localhost:8000/api/translate_braille_text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        const contentDiv = popup.querySelector('.bv-content');
        contentDiv.innerHTML = `
            <div class="bv-label">Original text:</div>
            <div class="bv-math">${escapeHtml(data.original)}</div>
            <div class="bv-label">Braille translation:</div>
            <div class="bv-braille">${data.braille}</div>
            <div style="text-align:right; margin-top:8px;">
                <button class="bv-export-btn" id="alpha-export-btn">📥 Download (.txt)</button>
            </div>
        `;

        document.getElementById("alpha-export-btn").addEventListener('click', () => {
            const content = `Original Text:\n${data.original}\n\nBraille Translation:\n${data.braille}\n`;
            downloadTxt(content, 'BrailleVision_Alphabet.txt');
        });

    } catch (err) {
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Translation could not be completed. Make sure the BrailleVision server (http://localhost:8000) is running in the background.</div>`;
    }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function createBasePopup(title) {
    const popup = document.createElement("div");
    popup.id = "braillevision-ext-popup";
    popup.innerHTML = `
        <div class="bv-header">
            <strong>${title}</strong>
            <button id="bv-close-btn">&times;</button>
        </div>
        <div class="bv-content">
            <div class="bv-loader">Converting...</div>
        </div>
    `;
    return popup;
}

function downloadTxt(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
