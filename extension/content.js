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
                        <button class="bv-export-btn" id="export-btn-${index}">📥 Download (.brf)</button>
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
                        downloadBRF(res.braille, 'BrailleVision_Math.brf');
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
                <button class="bv-export-btn" id="alpha-export-btn">📥 Download (.brf)</button>
            </div>
        `;

        document.getElementById("alpha-export-btn").addEventListener('click', () => {
            downloadBRF(data.braille, 'BrailleVision_Alphabet.brf');
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

// ─── BRF export (Braille Ready Format – NABCC, 40 cells/line, 25 lines/page)
function downloadBRF(brailleUnicode, filename) {
    const UNICODE_TO_NABCC = {
        '\u2800': ' ',
        '\u2801': 'a', '\u2802': '1', '\u2803': 'b', '\u2804': "'", '\u2805': 'k',
        '\u2806': '2', '\u2807': 'l', '\u2808': '@', '\u2809': 'c', '\u280a': 'i',
        '\u280b': 'f', '\u280c': '/', '\u280d': 'm', '\u280e': 's', '\u280f': 'p',
        '\u2810': '"', '\u2811': 'e', '\u2812': '3', '\u2813': 'h', '\u2814': '9',
        '\u2815': 'o', '\u2816': '6', '\u2817': 'r', '\u2818': '^', '\u2819': 'd',
        '\u281a': 'j', '\u281b': 'g', '\u281c': '>', '\u281d': 'n', '\u281e': 't',
        '\u281f': 'q', '\u2820': ',', '\u2821': '*', '\u2822': '5', '\u2823': '<',
        '\u2824': '-', '\u2825': 'u', '\u2826': '8', '\u2827': 'v', '\u2828': '.',
        '\u2829': '%', '\u282a': '[', '\u282b': '$', '\u282c': '+', '\u282d': 'x',
        '\u282e': '!', '\u282f': '&', '\u2830': ';', '\u2831': ':', '\u2832': '4',
        '\u2833': '\\','\u2834': '0', '\u2835': 'z', '\u2836': '7', '\u2837': '(',
        '\u2838': '_', '\u2839': '?', '\u283a': 'w', '\u283b': ']', '\u283c': '#',
        '\u283d': 'y', '\u283e': ')', '\u283f': '=',
    };

    let ascii = '';
    for (const ch of brailleUnicode) {
        if (ch === '\n') { ascii += '\n'; continue; }
        if (ch === ' ')  { ascii += ' ';  continue; }
        ascii += UNICODE_TO_NABCC[ch] ?? ch;
    }

    const CELLS_PER_LINE = 40;
    const LINES_PER_PAGE = 25;
    const inputLines = ascii.split('\n');
    const wrapped = [];
    
    for (const line of inputLines) {
        if (line.length === 0) { wrapped.push(''); continue; }
        for (let i = 0; i < line.length; i += CELLS_PER_LINE) {
            wrapped.push(line.slice(i, i + CELLS_PER_LINE));
        }
    }

    const pages = [];
    for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
        pages.push(wrapped.slice(i, i + LINES_PER_PAGE).join('\n'));
    }
    const brf = pages.join('\n\f\n');

    const blob = new Blob([brf], { type: 'application/x-brf;charset=utf-8' });
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
