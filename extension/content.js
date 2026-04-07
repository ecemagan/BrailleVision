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

        if (!response.ok) throw new Error("API Hatası");

        const data = await response.json();
        const contentDiv = popup.querySelector('.bv-content');
        contentDiv.innerHTML = '';

        if (!data.results || data.results.length === 0) {
            contentDiv.innerHTML = '<div class="bv-error">Matematiksel ifade bulunamadı.</div>';
            return;
        }

        data.results.forEach((res, index) => {
            const item = document.createElement('div');
            item.className = 'bv-result-item';

            if (res.error) {
                item.innerHTML = `<div class="bv-error">Hata: ${res.error}</div>`;
            } else {
                item.innerHTML = `
                    <div class="bv-label">İfade:</div>
                    <div class="bv-math">${escapeHtml(res.expression)}</div>
                    ${res.explanation ? `
                      <div class="bv-label" style="display:flex; justify-content:space-between; align-items:center;">
                          AI Açıklaması <button class="bv-tts-btn" id="tts-btn-${index}">🔊 Dinle</button>
                      </div>
                      <div class="bv-explanation">${escapeHtml(res.explanation)}</div>
                    ` : ''}
                    <div class="bv-label">Nemeth Braille:</div>
                    <div class="bv-braille">${res.braille}</div>
                    <div style="text-align:right; margin-top:8px;">
                        <button class="bv-export-btn" id="export-btn-${index}">📥 İndir (.txt)</button>
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
                        const content = `Matematiksel İfade:\n${res.expression}\n\nNemeth Braille Çevirisi:\n${res.braille}\n`;
                        downloadTxt(content, 'BrailleVision_Matematik.txt');
                    });
                }
            }
        });

    } catch (err) {
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Çeviri yapılamadı. BrailleVision sunucusunun (http://localhost:8000) arkaplanda çalıştığından emin olun.</div>`;
    }
}

/* ─── Metin → Braille Alfabesi ───────────────────────────────────────── */
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

        if (!response.ok) throw new Error("API Hatası");

        const data = await response.json();
        const contentDiv = popup.querySelector('.bv-content');
        contentDiv.innerHTML = `
            <div class="bv-label">Orijinal Metin:</div>
            <div class="bv-math">${escapeHtml(data.original)}</div>
            <div class="bv-label">Braille Çevirisi:</div>
            <div class="bv-braille">${data.braille}</div>
            <div style="text-align:right; margin-top:8px;">
                <button class="bv-export-btn" id="alpha-export-btn">📥 İndir (.txt)</button>
            </div>
        `;

        document.getElementById("alpha-export-btn").addEventListener('click', () => {
            const content = `Orijinal Metin:\n${data.original}\n\nBraille Çevirisi:\n${data.braille}\n`;
            downloadTxt(content, 'Braille Vision_Alfabesi.txt');
        });

    } catch (err) {
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Çeviri yapılamadı. Braille Vision sunucusunun (http://localhost:8000) arkaplanda çalıştığından emin olun.</div>`;
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
            <div class="bv-loader">Çevriliyor...</div>
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
