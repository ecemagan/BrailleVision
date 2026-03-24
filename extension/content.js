chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        showPopup(request.text);
    }
});

async function showPopup(text) {
    const existing = document.getElementById("braillevision-ext-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = "braillevision-ext-popup";
    popup.innerHTML = `
        <div class="bv-header">
            <strong>BrailleVision</strong>
            <button id="bv-close-btn">&times;</button>
        </div>
        <div class="bv-content">
            <div class="bv-loader">Çevriliyor...</div>
        </div>
    `;
    document.body.appendChild(popup);

    document.getElementById("bv-close-btn").addEventListener("click", () => {
        popup.remove();
    });

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
            contentDiv.innerHTML = '<div class="bv-error">Bulunamadı.</div>';
            return;
        }

        data.results.forEach(res => {
            const item = document.createElement('div');
            item.className = 'bv-result-item';
            
            if (res.error) {
                item.innerHTML = `<div class="bv-error">Hata: ${res.error}</div>`;
            } else {
                item.innerHTML = `
                    <div class="bv-label">İfade:</div>
                    <div class="bv-math">${escapeHtml(res.expression)}</div>
                    <div class="bv-label">Nemeth Braille:</div>
                    <div class="bv-braille">${res.braille}</div>
                `;
            }
            contentDiv.appendChild(item);
        });

    } catch (err) {
        popup.querySelector('.bv-content').innerHTML = `<div class="bv-error">Çeviri yapılamadı. BrailleVision sunucusunun (http://localhost:8000) arkaplanda çalıştığından emin olun.</div>`;
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
