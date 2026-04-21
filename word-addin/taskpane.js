/**
 * BrailleVision Word Add-in – Task Pane Logic
 * API requests go through the HTTPS proxy to avoid mixed-content issues.
 */

// Use window.location.origin to ensure absolute URLs match the current hosting environment (important for Mac Word WebKit)
const BACKEND = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000';

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
      text.textContent = 'Backend connected ✓';
    } else {
      throw new Error('bad status');
    }
  } catch {
    dot.className  = 'status-dot offline';
    text.textContent = 'Backend offline — is `python app.py` running?';
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
      let errorDetail = `Status ${res.status}`;
      try { const e = await res.json(); errorDetail = e.detail || errorDetail; } catch {}
      throw new Error(errorDetail);
    }
    const data = await res.json();
    showAlphaResult(data);
  } catch (err) {
    console.error('CallBrailleAlpha error:', err);
    showError('Translation error: ' + err.message + (err.name === 'SyntaxError' ? ' (Check Server/Proxy)' : ''));
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
      let errorDetail = `Status ${res.status}`;
      try { const e = await res.json(); errorDetail = e.detail || errorDetail; } catch {}
      throw new Error(errorDetail);
    }
    const data = await res.json();
    showMathResults(data.results || []);
  } catch (err) {
    console.error('CallNemethMath error:', err);
    showError('Translation error: ' + err.message + (err.name === 'SyntaxError' ? ' (Check Server/Proxy)' : ''));
  } finally {
    setLoading(false);
  }
}

// ─── Result display: Braille alphabet ────────────────────────────────────────
function showAlphaResult(data) {
  const area = document.getElementById('result-area');
  const card = document.createElement('div');
  card.className = 'result-card';

  // Render newlines as <br> so multi-line Braille text shows correctly
  const brailleHtml = escapeHtml(data.braille).replace(/\n/g, '<br>');

  card.innerHTML = `
    <div class="result-label">Braille çevirisi</div>
    <div class="result-braille" id="alpha-braille-out">${brailleHtml}</div>
    <div class="result-actions">
      <button class="mini-btn" id="alpha-insert-btn">📄 Insert</button>
      <button class="mini-btn" id="alpha-copy-btn">📋 Copy</button>
      <button class="mini-btn" id="alpha-dl-btn">📥 .brf</button>
    </div>
  `;
  area.appendChild(card);

  document.getElementById('alpha-insert-btn').addEventListener('click', () => {
    insertToDocument(data.braille);
  });
  document.getElementById('alpha-copy-btn').addEventListener('click', () => {
    copyToClipboard(data.braille);
  });
  document.getElementById('alpha-dl-btn').addEventListener('click', () => {
    downloadBRF(data.braille, 'BrailleVision_Alphabet.brf');
  });
}


// ─── Result display: Nemeth math ─────────────────────────────────────────────
function showMathResults(results) {
  const area = document.getElementById('result-area');

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No mathematical expression found.';
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
      // Render newlines as <br> for readable display in the card
      const brailleHtml = escapeHtml(res.braille).replace(/\n/g, '<br>');
      card.innerHTML = `
        <div class="result-label">Expression</div>
        <div class="result-original">${escapeHtml(res.expression)}</div>
        ${res.explanation ? `<div class="result-label" style="margin-top:4px">Explanation</div>
        <div class="result-explanation">${escapeHtml(res.explanation)}</div>` : ''}
        <div class="result-label" style="margin-top:4px">Nemeth Braille</div>
        <div class="result-braille">${brailleHtml}</div>
        <div class="result-actions">
          <button class="mini-btn" data-action="insert" data-idx="${idx}">📄 Insert</button>
          <button class="mini-btn" data-action="copy" data-idx="${idx}">📋 Copy</button>
          ${res.explanation ? `<button class="mini-btn" data-action="tts" data-idx="${idx}">🔊 Listen</button>` : ''}
          <button class="mini-btn" data-action="dl" data-idx="${idx}">📥 .brf</button>
        </div>
      `;
    }

    area.appendChild(card);

    card.querySelectorAll('.mini-btn[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'copy')   copyToClipboard(res.braille);
        if (action === 'tts')    speak(res.explanation);
        if (action === 'insert') {
          // Insert only the Nemeth Braille output — no expression text
          insertToDocument(res.braille);
        }
        if (action === 'dl') {
          downloadBRF(res.braille, `BrailleVision_Nemeth_${idx + 1}.brf`);
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
  utt.lang = 'tr-TR';
  window.speechSynthesis.speak(utt);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ─── Insert Braille only into the Word document ───────────────────────────────
function insertToDocument(brailleText) {
  Word.run(async (context) => {
    const body = context.document.body;

    // Thin separator line
    const hr = body.insertParagraph('─'.repeat(36), Word.InsertLocation.end);
    hr.font.color = '#7c3aed';
    hr.font.size  = 8;

    // Insert each Braille line with Courier New (monospaced = consistent cell width)
    brailleText.split('\n').forEach(line => {
      const p = body.insertParagraph(line || ' ', Word.InsertLocation.end);
      p.font.name      = 'Courier New';  // monospaced for uniform Braille cell rendering
      p.font.size      = 18;
      p.font.color     = '#1e1b4b';
      p.lineSpacing    = 28;             // ~10 mm line spacing
      p.spaceAfter     = 0;
      p.alignment      = 'Left';
    });

    body.insertParagraph('', Word.InsertLocation.end);
    await context.sync();

    const btn = document.activeElement;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ Added!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(err => showError('Could not insert: ' + err.message));
}

// ─── BRF export (Braille Ready Format – NABCC, 40 cells/line, 25 lines/page) ─
// Converts Unicode Braille → NABCC ASCII, wraps at 40 cells, paginates at 25 lines.
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

  // Convert Unicode Braille → ASCII BRF
  let ascii = '';
  for (const ch of brailleUnicode) {
    if (ch === '\n') { ascii += '\n'; continue; }
    if (ch === ' ')  { ascii += ' ';  continue; }
    ascii += UNICODE_TO_NABCC[ch] ?? ch;
  }

  // Wrap at 40 cells/line, paginate at 25 lines
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

  // Word WebView often blocks Blob downloads — try Blob first, fall back to clipboard
  let downloaded = false;
  try {
    const blob = new Blob([brf], { type: 'application/x-brf;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    downloaded = true;
  } catch (_) { /* fall through */ }

  if (!downloaded) {
    // Fallback: copy BRF content to clipboard and notify user
    copyToClipboard(brf);
    const area = document.getElementById('result-area');
    const msg = document.createElement('div');
    msg.className = 'error-msg';
    msg.style.color = 'var(--success)';
    msg.style.borderColor = 'var(--success)';
    msg.style.background = 'rgba(52,211,153,0.08)';
    msg.textContent = '✅ .brf içeriği panoya kopyalandı. Bir metin editörüne yapıştırıp .brf olarak kaydedin.';
    area.prepend(msg);
    setTimeout(() => msg.remove(), 5000);
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
