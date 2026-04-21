chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateMath" || request.action === "translate") {
        showMathPopup(request.text);
    } else if (request.action === "translateAlpha") {
        showAlphaPopup(request.text);
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
                <button class="bv-export-btn" id="alpha-export-btn">📥 Download (.txt)</button>
            </div>
        `;

        document.getElementById("alpha-export-btn").addEventListener('click', () => {
            const content = `Original Text:\n${data.original}\n\nBraille Translation:\n${data.braille}\n`;
            downloadTxt(content, 'BrailleVision_Alphabet.txt');
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
