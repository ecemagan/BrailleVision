chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateMath" || request.action === "translate") {
        showMathPopup(request.text);
    } else if (request.action === "translateAlpha") {
        showAlphaPopup(request.text);
    } else if (request.action === "translateAuto") {
        showAutoPopup(request.text);
    }
});

const POPUP_MARGIN = 10;
const POPUP_MIN_WIDTH = 280;
const POPUP_MIN_HEIGHT = 220;
let viewportListenerBound = false;

function requestBackend(action, text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, text }, (response) => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message || "Extension messaging failed"));
                return;
            }

            if (!response) {
                reject(new Error("No response from background service"));
                return;
            }

            if (!response.ok) {
                reject(new Error(response.error || "Backend request failed"));
                return;
            }

            resolve(response.data);
        });
    });
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function constrainPopupToViewport(popup) {
    const rect = popup.getBoundingClientRect();
    const maxWidth = Math.max(260, window.innerWidth - (POPUP_MARGIN * 2));
    const maxHeight = Math.max(200, window.innerHeight - (POPUP_MARGIN * 2));

    if (rect.width > maxWidth) {
        popup.style.width = `${maxWidth}px`;
    }
    if (rect.height > maxHeight) {
        popup.style.height = `${maxHeight}px`;
    }

    const nextRect = popup.getBoundingClientRect();
    const maxLeft = Math.max(POPUP_MARGIN, window.innerWidth - nextRect.width - POPUP_MARGIN);
    const maxTop = Math.max(POPUP_MARGIN, window.innerHeight - nextRect.height - POPUP_MARGIN);

    popup.style.left = `${clamp(nextRect.left, POPUP_MARGIN, maxLeft)}px`;
    popup.style.top = `${clamp(nextRect.top, POPUP_MARGIN, maxTop)}px`;
    popup.style.right = "auto";
    popup.style.bottom = "auto";
}

function bindViewportConstraintListener() {
    if (viewportListenerBound) {
        return;
    }

    window.addEventListener("resize", () => {
        const popup = document.getElementById("braillevision-ext-popup");
        if (popup) {
            constrainPopupToViewport(popup);
        }
    });

    viewportListenerBound = true;
}

function enablePopupInteractions(popup) {
    const header = popup.querySelector(".bv-header");
    const closeBtn = popup.querySelector("#bv-close-btn");
    const resizeHandle = popup.querySelector(".bv-resize-handle");

    if (!header || !resizeHandle) {
        return;
    }

    bindViewportConstraintListener();

    requestAnimationFrame(() => {
        const rect = popup.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.top}px`;
        popup.style.right = "auto";
        popup.style.bottom = "auto";
        constrainPopupToViewport(popup);
    });

    let dragState = null;
    header.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        if (closeBtn && (event.target === closeBtn || closeBtn.contains(event.target))) {
            return;
        }

        const rect = popup.getBoundingClientRect();
        dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: rect.left,
            top: rect.top,
        };

        popup.classList.add("bv-dragging");
        header.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    header.addEventListener("pointermove", (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        const rect = popup.getBoundingClientRect();
        const maxLeft = Math.max(POPUP_MARGIN, window.innerWidth - rect.width - POPUP_MARGIN);
        const maxTop = Math.max(POPUP_MARGIN, window.innerHeight - rect.height - POPUP_MARGIN);
        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;

        popup.style.left = `${clamp(dragState.left + deltaX, POPUP_MARGIN, maxLeft)}px`;
        popup.style.top = `${clamp(dragState.top + deltaY, POPUP_MARGIN, maxTop)}px`;
    });

    const endDrag = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        dragState = null;
        popup.classList.remove("bv-dragging");
    };

    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);

    let resizeState = null;
    resizeHandle.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const rect = popup.getBoundingClientRect();
        resizeState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            left: rect.left,
            top: rect.top,
        };

        popup.classList.add("bv-resizing");
        resizeHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    resizeHandle.addEventListener("pointermove", (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) {
            return;
        }

        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;

        const maxWidth = window.innerWidth - resizeState.left - POPUP_MARGIN;
        const maxHeight = window.innerHeight - resizeState.top - POPUP_MARGIN;

        const nextWidth = clamp(resizeState.startWidth + deltaX, POPUP_MIN_WIDTH, maxWidth);
        const nextHeight = clamp(resizeState.startHeight + deltaY, POPUP_MIN_HEIGHT, maxHeight);

        popup.style.width = `${nextWidth}px`;
        popup.style.height = `${nextHeight}px`;
    });

    const endResize = (event) => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) {
            return;
        }

        resizeState = null;
        popup.classList.remove("bv-resizing");
        constrainPopupToViewport(popup);
    };

    resizeHandle.addEventListener("pointerup", endResize);
    resizeHandle.addEventListener("pointercancel", endResize);
}

/* ─── Auto-detect: Math → Nemeth veya Text → Braille ───────────────────── */
async function showAutoPopup(text) {
    const existing = document.getElementById("braillevision-ext-popup");
    if (existing) existing.remove();

    const popup = createBasePopup("BrailleVision – Otomatik Çeviri");
    document.body.appendChild(popup);
    document.getElementById("bv-close-btn").addEventListener("click", () => popup.remove());

    try {
        const response = await requestBackend("bvApiAutoTranslate", text);
        const contentDiv = popup.querySelector('.bv-content');
        contentDiv.innerHTML = '';

        const results = response.results || (response.data && response.data.results);
        const hasMathResults = results && results.length > 0 && !results.every(r => r.error);

        if (response.mode === "math" && hasMathResults) {
            const modeChip = document.createElement('div');
            modeChip.className = 'bv-mode-chip';
            modeChip.textContent = '✓ Matematik modu (Nemeth Braille)';
            contentDiv.appendChild(modeChip);

            results.forEach((res, index) => {
                const item = document.createElement('div');
                item.className = 'bv-result-item';
                if (res.error) {
                    item.innerHTML = `<div class="bv-error">Hata: ${escapeHtml(res.error)}</div>`;
                } else {
                    item.innerHTML = `
                        <div class="bv-label">Matematiksel ifade:</div>
                        <div class="bv-math">${escapeHtml(res.expression)}</div>
                        ${res.explanation ? `
                          <div class="bv-label" style="display:flex;justify-content:space-between;align-items:center;">
                              AI açıklaması <button class="bv-tts-btn" id="auto-tts-${index}">🔊 Dinle</button>
                          </div>
                          <div class="bv-explanation">${escapeHtml(res.explanation)}</div>
                        ` : ''}
                        <div class="bv-label">Nemeth Braille:</div>
                        <div class="bv-braille">${res.braille}</div>
                        <div style="text-align:right;margin-top:8px;">
                            <button class="bv-export-btn" id="auto-exp-${index}">📥 .brf indir</button>
                        </div>
                    `;
                }
                contentDiv.appendChild(item);

                if (!res.error) {
                    const ttsBtn = document.getElementById(`auto-tts-${index}`);
                    if (ttsBtn) ttsBtn.addEventListener('click', () => {
                        window.speechSynthesis.cancel();
                        const s = new SpeechSynthesisUtterance(res.explanation);
                        s.lang = 'tr-TR';
                        window.speechSynthesis.speak(s);
                    });
                    const expBtn = document.getElementById(`auto-exp-${index}`);
                    if (expBtn) expBtn.addEventListener('click', () => downloadBRF(res.braille, 'BrailleVision_Math.brf'));
                }
            });
        } else {
            // Düz metin modu
            const textData = response.data || response;
            const modeChip = document.createElement('div');
            modeChip.className = 'bv-mode-chip bv-mode-text';
            modeChip.textContent = '✓ Metin modu (Braille Alfabesi)';
            contentDiv.appendChild(modeChip);
            renderTextResult(contentDiv, textData);
        }
    } catch (err) {
        const errorText = (err && err.message) ? err.message : "Bilinmeyen hata";
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Çeviri tamamlanamadı. ${escapeHtml(errorText)}<br>BrailleVision sunucusunun (http://localhost:8000) çalıştığından emin olun.</div>`;
    }
}

function renderTextResult(container, data) {
    const original = data.original || data.text || '';
    const braille  = data.braille  || '';
    const frag = document.createElement('div');
    frag.innerHTML = `
        <div class="bv-label">Orijinal metin:</div>
        <div class="bv-math">${escapeHtml(original)}</div>
        <div class="bv-label">Braille çevirisi:</div>
        <div class="bv-braille">${braille}</div>
        <div style="text-align:right;margin-top:8px;">
            <button class="bv-export-btn" id="auto-text-export">📥 .brf indir</button>
        </div>
    `;
    container.appendChild(frag);
    const expBtn = container.querySelector('#auto-text-export');
    if (expBtn) expBtn.addEventListener('click', () => downloadBRF(braille, 'BrailleVision_Text.brf'));
}

/* ─── Matematik → Nemeth Braille ─────────────────────────────────────── */
async function showMathPopup(text) {
    const existing = document.getElementById("braillevision-ext-popup");
    if (existing) existing.remove();

    const popup = createBasePopup("BrailleVision – Matematik");
    document.body.appendChild(popup);

    document.getElementById("bv-close-btn").addEventListener("click", () => popup.remove());

    try {
        const data = await requestBackend("bvApiProcessText", text);
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
        const errorText = (err && err.message) ? err.message : "Unknown error";
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Translation could not be completed. ${escapeHtml(errorText)}<br>Make sure the BrailleVision server (http://localhost:8000) is running in the background.</div>`;
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
        const data = await requestBackend("bvApiTranslateBrailleText", text);
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
        const errorText = (err && err.message) ? err.message : "Unknown error";
        popup.querySelector('.bv-content').innerHTML =
            `<div class="bv-error">Translation could not be completed. ${escapeHtml(errorText)}<br>Make sure the BrailleVision server (http://localhost:8000) is running in the background.</div>`;
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
        <div class="bv-resize-handle" aria-hidden="true"></div>
    `;

    enablePopupInteractions(popup);

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
