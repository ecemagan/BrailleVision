document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.section');
    
    let stream = null;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            tab.classList.add('active');
            const target = tab.dataset.target;
            document.getElementById(target).classList.add('active');

            if (target === 'camera-section') {
                startCamera();
            } else {
                stopCamera();
            }
        });
    });

    // Camera Logic
    const video = document.getElementById('videoElement');
    const canvas = document.getElementById('canvasElement');
    const captureBtn = document.getElementById('capture-btn');

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
        } catch (err) {
            console.error("Camera access denied or unavailable", err);
            alert("Kameraya erişilemedi. Lütfen izinleri kontrol edin.");
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    }

    captureBtn.addEventListener('click', () => {
        if (!stream) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            processFile(file, '/api/process_image');
        }, 'image/jpeg', 0.95);
    });

    // File Upload Logic
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(fileInput.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (file.type === 'application/pdf') {
            processFile(file, '/api/process_document');
        } else if (file.type.startsWith('image/')) {
            processFile(file, '/api/process_document');
        } else {
            alert('Lütfen PDF veya Görsel formatında bir dosya yükleyin.');
        }
    }

    // Text Input Logic
    const translateTextBtn = document.getElementById('translate-text-btn');
    const mathTextInput = document.getElementById('math-text-input');

    translateTextBtn.addEventListener('click', () => {
        const text = mathTextInput.value.trim();
        if (!text) {
            alert('Lütfen çevrilecek matematiksel ifadeyi girin.');
            return;
        }
        processText(text);
    });

    // Plain text → Braille Alphabet
    const translateAlphaBtn = document.getElementById('translate-alpha-btn');
    const alphaTextInput = document.getElementById('alpha-text-input');
    const alphaResult = document.getElementById('alpha-braille-result');
    const alphaOutput = document.getElementById('alpha-braille-output');
    const alphaDownloadBtn = document.getElementById('alpha-download-btn');

    translateAlphaBtn.addEventListener('click', async () => {
        const text = alphaTextInput.value.trim();
        if (!text) {
            alert('Lütfen çevrilecek metni girin.');
            return;
        }

        translateAlphaBtn.disabled = true;
        translateAlphaBtn.textContent = 'Çevriliyor...';
        alphaResult.classList.add('hidden');

        try {
            const response = await fetch('/api/translate_braille_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Bir hata oluştu');
            }

            const data = await response.json();
            alphaOutput.textContent = data.braille;
            alphaResult.classList.remove('hidden');
        } catch (error) {
            alert('Hata: ' + error.message);
        } finally {
            translateAlphaBtn.disabled = false;
            translateAlphaBtn.textContent = 'Braille Alfabesine Çevir';
        }
    });

    alphaDownloadBtn.addEventListener('click', () => {
        const original = alphaTextInput.value.trim();
        const braille = alphaOutput.textContent;
        const content = `${braille}\\n`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'BrailleVision_Alfabesi.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    async function processText(text) {
        setLoading(true);
        resultsContainer.classList.add('hidden');
        resultsContent.innerHTML = '';

        try {
            const response = await fetch('/api/process_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Bir hata oluştu');
            }

            const data = await response.json();
            renderResults(data.results);
            
        } catch (error) {
            alert('Hata: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    // API Call
    const loading = document.getElementById('loading');
    const resultsContainer = document.getElementById('results');
    const resultsContent = document.getElementById('results-content');

    async function processFile(file, endpoint) {
        setLoading(true);
        resultsContainer.classList.add('hidden');
        resultsContent.innerHTML = '';

        const formData = new FormData();
        const fieldName = endpoint.includes('document') ? 'file' : 'image';
        formData.append(fieldName, file);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Bir hata oluştu');
            }

            const data = await response.json();
            renderResults(data.results);
            
        } catch (error) {
            alert('Hata: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    function renderResults(results) {
        if (!results || results.length === 0) {
            resultsContent.innerHTML = '<p style="color:var(--text-secondary)">Belgede matematiksel ifade bulunamadı veya dönüştürülemedi.</p>';
        } else {
            results.forEach(res => {
                const card = document.createElement('div');
                card.className = 'result-card';
                
                let errorHtml = res.error ? `<div class="error-text">Hata: ${res.error}</div>` : '';
                
                let expSafe = res.explanation ? res.explanation.replace(/'/g, "\\'") : '';
                let explanationHtml = res.explanation ? `
                    <div class="label" style="display:flex; justify-content:space-between; align-items:center;">
                        AI Açıklaması 
                        <button class="tts-btn" onclick="window.speakText('${expSafe}')">🔊 Dinle</button>
                    </div>
                    <div class="explanation-text">${escapeHtml(res.explanation)}</div>
                ` : '';
                
                let mathSafe = res.expression ? res.expression.replace(/'/g, "\\'") : '';
                let brailleSafe = res.braille ? res.braille.replace(/'/g, "\\'") : '';
                
                card.innerHTML = `
                    <div class="label">Matematiksel İfade</div>
                    <div class="math-expr">${escapeHtml(res.expression)}</div>
                    ${explanationHtml}
                    <div class="label">Nemeth Braille</div>
                    <div class="braille-output">${res.braille}</div>
                    ${errorHtml}
                    <div class="card-actions">
                        <button class="export-btn" onclick="window.downloadTxt('${mathSafe}', '${brailleSafe}')">📥 İndir (.brf/.txt)</button>
                    </div>
                `;
                resultsContent.appendChild(card);
            });
        }
        resultsContainer.classList.remove('hidden');
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});

window.speakText = function(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'tr-TR';
        window.speechSynthesis.speak(msg);
    } else {
        alert("Tarayıcınız sesli okumayı desteklemiyor.");
    }
};

window.downloadTxt = function(math, braille) {
    const content = `Matematiksel İfade:\n${math}\n\nNemeth Braille Çevirisi:\n${braille}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BrailleVision_Ceviri.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
