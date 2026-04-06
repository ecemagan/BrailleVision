/**
 * BrailleVision Word Add-in – Task Pane Logic
 * API çağrıları HTTPS proxy üzerinden gider (mixed content sorununu aşar).
 */

// Boş bırak = same-origin (https://localhost:3000) → proxy → http://localhost:8000
const BACKEND = '';

// ─── Office hazır olunca başlat ───────────────────────────────────────────────
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    initUI();
    checkBackend();
  }
});

// ─── UI başlat ────────────────────────────────────────────────────────────────
function initUI() {
  document.getElementById('btn-alpha').addEventListener('click', () => translateSelected('alpha'));
  document.getElementById('btn-math').addEventListener('click',  () => translateSelected('math'));
  document.getElementById('btn-doc').addEventListener('click',   () => translateFullDoc());
}

// ─── Backend bağlantı kontrolü ────────────────────────────────────────────────
async function checkBackend() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const r = await fetch(`${BACKEND}/`, { signal: AbortSignal.timeout(3000) });
    if (r.ok || r.status < 500) {
      dot.className  = 'status-dot online';
      text.textContent = 'Backend bağlı – Çevirmeye hazır ✓';
    } else {
      throw new Error('bad status');
    }
  } catch {
    dot.className  = 'status-dot offline';
    text.textContent = 'Backend bağlanamadı! python app.py çalışıyor mu?';
  }
}

// ─── Seçili metni çevir ───────────────────────────────────────────────────────
async function translateSelected(mode) {
  let selectedText = '';

  try {
    selectedText = await getSelectionText();
  } catch (err) {
    showError('Word\'den metin alınamadı: ' + err.message);
    return;
  }

  if (!selectedText || !selectedText.trim()) {
    showError('Lütfen önce Word belgesinde bir metin seçin.');
    return;
  }

  if (mode === 'alpha') {
    await callBrailleAlpha(selectedText.trim());
  } else {
    await callNemethMath(selectedText.trim());
  }
}

// ─── Tüm belgeyi çevir ────────────────────────────────────────────────────────
async function translateFullDoc() {
  let docText = '';
  try {
    docText = await getDocumentText();
  } catch (err) {
    showError('Belge metni alınamadı: ' + err.message);
    return;
  }

  if (!docText || !docText.trim()) {
    showError('Belge boş görünüyor.');
    return;
  }

  await callBrailleAlpha(docText.trim());
}

// ─── Office.js metin okuma ────────────────────────────────────────────────────
function getSelectionText() {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
    return selection.text;
  });
}

function getDocumentText() {
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    return body.text;
  });
}

// ─── API: Metin → Braille Alfabesi ───────────────────────────────────────────
async function callBrailleAlpha(text) {
  setLoading(true);
  clearResult();

  try {
    const res = await fetch(`${BACKEND}/api/translate_braille_text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showAlphaResult(data);

  } catch (err) {
    showError('Çeviri hatası: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ─── API: Matematik → Nemeth Braille ─────────────────────────────────────────
async function callNemethMath(text) {
  setLoading(true);
  clearResult();

  try {
    const res = await fetch(`${BACKEND}/api/process_text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showMathResults(data.results || []);

  } catch (err) {
    showError('Çeviri hatası: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ─── Sonuç gösterimi: Braille Alfabesi ───────────────────────────────────────
function showAlphaResult(data) {
  const area = document.getElementById('result-area');
  const card = document.createElement('div');
  card.className = 'result-card';

  const preview = data.original.length > 120
    ? data.original.slice(0, 120) + '…'
    : data.original;

  card.innerHTML = `
    <div>
      <div class="result-label">Orijinal Metin</div>
      <div class="result-original">${escapeHtml(preview)}</div>
    </div>
    <div>
      <div class="result-label">Braille Çevirisi</div>
      <div class="result-braille" id="alpha-braille-out">${data.braille}</div>
    </div>
    <div class="result-actions">
      <button class="mini-btn" id="alpha-insert-btn">📄 Belgeye Ekle</button>
      <button class="mini-btn" id="alpha-copy-btn">📋 Kopyala</button>
      <button class="mini-btn" id="alpha-tts-btn">🔊 Oku</button>
      <button class="mini-btn" id="alpha-dl-btn">📥 İndir</button>
    </div>
  `;
  area.appendChild(card);

  document.getElementById('alpha-insert-btn').addEventListener('click', () => {
    const content = `Orijinal Metin:\n${data.original}\n\nBraille Çevirisi:\n${data.braille}`;
    insertToDocument(content, 'BrailleVision – Metin Çevirisi');
  });
  document.getElementById('alpha-copy-btn').addEventListener('click', () => {
    copyToClipboard(data.braille);
  });
  document.getElementById('alpha-tts-btn').addEventListener('click', () => {
    speak(data.original);
  });
  document.getElementById('alpha-dl-btn').addEventListener('click', () => {
    downloadTxt(
      `Orijinal Metin:\n${data.original}\n\nBraille Çevirisi:\n${data.braille}\n`,
      'BrailleVision_Alfabesi.txt'
    );
  });
}


// ─── Sonuç gösterimi: Nemeth Matematik ───────────────────────────────────────
function showMathResults(results) {
  const area = document.getElementById('result-area');

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Matematiksel ifade bulunamadı. Gemini AI, matematiksel bir yapı tespit edemedi.';
    area.appendChild(empty);
    return;
  }

  results.forEach((res, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    if (res.error) {
      card.innerHTML = `
        <div class="result-label">İfade</div>
        <div class="result-original">${escapeHtml(res.expression)}</div>
        <div class="error-msg">⚠️ ${escapeHtml(res.error)}</div>
      `;
    } else {
      const expSafe = escapeHtml(res.explanation || '');
      card.innerHTML = `
        <div>
          <div class="result-label">Matematiksel İfade</div>
          <div class="result-original">${escapeHtml(res.expression)}</div>
        </div>
        ${res.explanation ? `
        <div>
          <div class="result-label">AI Açıklaması</div>
          <div class="result-explanation">${expSafe}</div>
        </div>` : ''}
        <div>
          <div class="result-label">Nemeth Braille</div>
          <div class="result-braille">${res.braille}</div>
        </div>
        <div class="result-actions">
          <button class="mini-btn" data-action="insert" data-idx="${idx}">📄 Belgeye Ekle</button>
          <button class="mini-btn" data-action="copy" data-idx="${idx}">📋 Kopyala</button>
          ${res.explanation ? `<button class="mini-btn" data-action="tts" data-idx="${idx}">🔊 Oku</button>` : ''}
          <button class="mini-btn" data-action="dl" data-idx="${idx}">📥 İndir</button>
        </div>
      `;
    }

    area.appendChild(card);

    // Buton event'leri
    card.querySelectorAll('.mini-btn[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'copy')   copyToClipboard(res.braille);
        if (action === 'tts')    speak(res.explanation);
        if (action === 'insert') {
          const content = `${res.expression}\nNemeth Braille: ${res.braille}${res.explanation ? '\nAçıklama: ' + res.explanation : ''}`;
          insertToDocument(content, 'BrailleVision – Matematik Çevirisi');
        }
        if (action === 'dl') {
          downloadTxt(
            `Matematiksel İfade:\n${res.expression}\n\nNemeth Braille:\n${res.braille}\n`,
            `BrailleVision_Nemeth_${idx + 1}.txt`
          );
        }
      });
    });
  });
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('loading').classList.toggle('visible', on);
  ['btn-alpha', 'btn-math', 'btn-doc'].forEach(id => {
    document.getElementById(id).disabled = on;
  });
}

function clearResult() {
  document.getElementById('result-area').innerHTML = '';
}

function showError(msg) {
  const area = document.getElementById('result-area');
  area.innerHTML = `<div class="error-msg">❌ ${escapeHtml(msg)}</div>`;
}

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'tr-TR';
  window.speechSynthesis.speak(utt);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback for older Office webviews
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ─── Word belgesine Braille çıktısı ekle ─────────────────────────────────────
function insertToDocument(content, title) {
  Word.run(async (context) => {
    const body = context.document.body;

    // Ayraç satırı
    const hr = body.insertParagraph('─'.repeat(40), Word.InsertLocation.end);
    hr.font.color = '#7c3aed';
    hr.font.size  = 9;

    // Başlık
    const heading = body.insertParagraph(title, Word.InsertLocation.end);
    heading.font.bold  = true;
    heading.font.color = '#5b21b6';
    heading.font.size  = 11;

    // İçerik satırları
    content.split('\n').forEach(line => {
      const p = body.insertParagraph(line, Word.InsertLocation.end);
      p.font.size = 10;
      // Braille satırı büyük fontla göster
      if (line.startsWith('Nemeth Braille:') || line.startsWith('Braille Çevirisi:')) {
        p.font.size  = 13;
        p.font.bold  = true;
        p.font.color = '#1e1b4b';
      }
    });

    await context.sync();

    // Kullanıcıya bildir
    const btn = document.activeElement;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ Eklendi!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(err => showError('Belgeye eklenemedi: ' + err.message));
}

function downloadTxt(content, filename) {
  // Word WebView'de blob download çalışmayabilir — proxy üzerinden dene
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    copyToClipboard(content);
    showError('İndirme desteklenmiyor. İçerik panoya kopyalandı — yapıştırabilirsiniz.');
  }
}


function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
