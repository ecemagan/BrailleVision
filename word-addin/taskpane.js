/**
 * BrailleVision Word Add-in – Task Pane Logic
 * API requests go through the HTTPS proxy to avoid mixed-content issues.
 */

// Leave empty = same-origin (https://localhost:3000) → proxy → http://localhost:8000
const BACKEND = '';

// ─── Start when Office is ready ──────────────────────────────────────────────
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    initUI();
    checkBackend();
  }
});

// ─── Initialize UI ────────────────────────────────────────────────────────────
function initUI() {
  document.getElementById('btn-alpha').addEventListener('click', () => translateSelected('alpha'));
  document.getElementById('btn-math').addEventListener('click',  () => translateSelected('math'));
  document.getElementById('btn-doc').addEventListener('click',   () => translateFullDoc());
}

// ─── Check backend connectivity ──────────────────────────────────────────────
async function checkBackend() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const r = await fetch(`${BACKEND}/`, { signal: AbortSignal.timeout(3000) });
    if (r.ok || r.status < 500) {
      dot.className  = 'status-dot online';
      text.textContent = 'Backend connected — ready to convert ✓';
    } else {
      throw new Error('bad status');
    }
  } catch {
    dot.className  = 'status-dot offline';
    text.textContent = 'Backend could not connect! Is `python app.py` running?';
  }
}

// ─── Convert selected text ───────────────────────────────────────────────────
async function translateSelected(mode) {
  let selectedText = '';

  try {
    selectedText = await getSelectionText();
  } catch (err) {
    showError('Could not read text from Word: ' + err.message);
    return;
  }

  if (!selectedText || !selectedText.trim()) {
    showError('Please select text in the Word document first.');
    return;
  }

  if (mode === 'alpha') {
    await callBrailleAlpha(selectedText.trim());
  } else {
    await callNemethMath(selectedText.trim());
  }
}

// ─── Convert the entire document ──────────────────────────────────────────────
async function translateFullDoc() {
  let docText = '';
  try {
    docText = await getDocumentText();
  } catch (err) {
    showError('Could not read the document text: ' + err.message);
    return;
  }

  if (!docText || !docText.trim()) {
    showError('The document appears to be empty.');
    return;
  }

  await callBrailleAlpha(docText.trim());
}

// ─── Office.js text reading ───────────────────────────────────────────────────
function getSelectionText() {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
    // Word belgelerinde paragraflar genellikle \r (carriage return) ile ayrılır.
    // Backend'de bu karakterler silinmesin diye \n'ye (newline) dönüştürüyoruz.
    return selection.text.replace(/\r\n|\r/g, '\n');
  });
}

function getDocumentText() {
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    return body.text.replace(/\r\n|\r/g, '\n');
  });
}

// ─── API: Text → Braille alphabet ────────────────────────────────────────────
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
    showError('Translation error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ─── API: Math → Nemeth Braille ──────────────────────────────────────────────
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
    showError('Translation error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ─── Result display: Braille alphabet ────────────────────────────────────────
function showAlphaResult(data) {
  const area = document.getElementById('result-area');
  const card = document.createElement('div');
  card.className = 'result-card';

  const preview = data.original.length > 120
    ? data.original.slice(0, 120) + '…'
    : data.original;

  card.innerHTML = `
    <div>
      <div class="result-label">Original text</div>
      <div class="result-original">${escapeHtml(preview)}</div>
    </div>
    <div>
      <div class="result-label">Braille translation</div>
      <div class="result-braille" id="alpha-braille-out">${data.braille}</div>
    </div>
    <div class="result-actions">
      <button class="mini-btn" id="alpha-insert-btn">📄 Insert into document</button>
      <button class="mini-btn" id="alpha-copy-btn">📋 Copy</button>
      <button class="mini-btn" id="alpha-tts-btn">🔊 Read aloud</button>
      <button class="mini-btn" id="alpha-dl-btn">📥 Download</button>
    </div>
  `;
  area.appendChild(card);

  document.getElementById('alpha-insert-btn').addEventListener('click', () => {
    const content = `Original Text:\n${data.original}\n\nBraille Translation:\n${data.braille}`;
    insertToDocument(content, 'BrailleVision – Text Translation');
  });
  document.getElementById('alpha-copy-btn').addEventListener('click', () => {
    copyToClipboard(data.braille);
  });
  document.getElementById('alpha-tts-btn').addEventListener('click', () => {
    speak(data.original);
  });
  document.getElementById('alpha-dl-btn').addEventListener('click', () => {
    downloadTxt(
      `Original Text:\n${data.original}\n\nBraille Translation:\n${data.braille}\n`,
      'BrailleVision_Alphabet.txt'
    );
  });
}


// ─── Result display: Nemeth math ─────────────────────────────────────────────
function showMathResults(results) {
  const area = document.getElementById('result-area');

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No mathematical expression was found. Gemini AI could not detect a mathematical structure.';
    area.appendChild(empty);
    return;
  }

  results.forEach((res, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    if (res.error) {
      card.innerHTML = `
        <div class="result-label">Expression</div>
        <div class="result-original">${escapeHtml(res.expression)}</div>
        <div class="error-msg">⚠️ ${escapeHtml(res.error)}</div>
      `;
    } else {
      const expSafe = escapeHtml(res.explanation || '');
      card.innerHTML = `
        <div>
          <div class="result-label">Mathematical expression</div>
          <div class="result-original">${escapeHtml(res.expression)}</div>
        </div>
        ${res.explanation ? `
        <div>
          <div class="result-label">AI explanation</div>
          <div class="result-explanation">${expSafe}</div>
        </div>` : ''}
        <div>
          <div class="result-label">Nemeth Braille</div>
          <div class="result-braille">${res.braille}</div>
        </div>
        <div class="result-actions">
          <button class="mini-btn" data-action="insert" data-idx="${idx}">📄 Insert into document</button>
          <button class="mini-btn" data-action="copy" data-idx="${idx}">📋 Copy</button>
          ${res.explanation ? `<button class="mini-btn" data-action="tts" data-idx="${idx}">🔊 Read aloud</button>` : ''}
          <button class="mini-btn" data-action="dl" data-idx="${idx}">📥 Download</button>
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
          const content = `${res.expression}\nNemeth Braille: ${res.braille}${res.explanation ? '\nExplanation: ' + res.explanation : ''}`;
          insertToDocument(content, 'BrailleVision – Math Translation');
        }
        if (action === 'dl') {
          downloadTxt(
            `Mathematical Expression:\n${res.expression}\n\nNemeth Braille:\n${res.braille}\n`,
            `BrailleVision_Nemeth_${idx + 1}.txt`
          );
        }
      });
    });
  });
}

// ─── Helper functions ────────────────────────────────────────────────────────
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
  utt.lang = 'en-US';
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

// ─── Insert Braille output into the Word document ────────────────────────────
function insertToDocument(content, title) {
  Word.run(async (context) => {
    const body = context.document.body;

    const isFullBraille = (title === 'BrailleVision – Metin Çevirisi');

    // Orijinal metinle araya belirgin boşluklar ekle
    body.insertParagraph('', Word.InsertLocation.end);
    body.insertParagraph('', Word.InsertLocation.end);

    if (isFullBraille) {
      // Tüm belge çevirisinde sayfa hizası karışmasın diye ekstra boşluk
      body.insertParagraph('', Word.InsertLocation.end);
      body.insertParagraph('', Word.InsertLocation.end);
    } else {
      // Sadece ayraç satırı
      const hr = body.insertParagraph('─'.repeat(40), Word.InsertLocation.end);
      hr.font.color = '#7c3aed';
      hr.font.size  = 9;
      body.insertParagraph('', Word.InsertLocation.end);
    }

    // Heading
    const heading = body.insertParagraph(title, Word.InsertLocation.end);
    heading.font.bold  = true;
    heading.font.color = '#5b21b6';
    heading.font.size  = 13;

    // Başlıkla içerik arasına boşluk
    body.insertParagraph('', Word.InsertLocation.end);

    // Content lines
    content.split('\n').forEach(line => {
      // İçerikteki boş satırların da düzgün yansıması için boşluk kontrolü eklendi
      const p = body.insertParagraph(line || ' ', Word.InsertLocation.end);
      
      // Varsayılan normal görünüm
      p.font.size = 11;
      
      // Braille satırı kontrolü (Tüm metin çevirisi yapıldıysa içerik komple Braille'dir)
      const isBrailleLine = isFullBraille || line.startsWith('Nemeth Braille:') || line.startsWith('Braille Çevirisi:');
      
      if (isBrailleLine) {
        p.font.size  = 20; // Braille okunaklı olması için büyük font
        p.font.color = '#1e1b4b';
        p.alignment = 'Left'; // Yaslamadan kaynaklı harf arası açıklarını önle
        p.spaceAfter = 10; // Braille satırları arasına makul boşluk
      } else if (line.startsWith('Açıklama:')) {
        p.font.italic = true;
        p.font.color = '#4b5563';
      }
    });

    // En alta çevirinin bittiğini belli eden boşluk
    body.insertParagraph('', Word.InsertLocation.end);
    body.insertParagraph('', Word.InsertLocation.end);

    await context.sync();

    // Notify the user
    const btn = document.activeElement;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ Added!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(err => showError('Could not insert into the document: ' + err.message));
}

function downloadTxt(content, filename) {
  // Blob downloads may not work in Word WebView — try the proxy route
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
    showError('Download is not supported. The content was copied to the clipboard — you can paste it.');
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
