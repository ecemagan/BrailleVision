import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
from pathlib import Path
import google.generativeai as genai
import unicodedata

# Setup paths for braillevision
PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser
from braillevision.text_braille_translator import TextBrailleTranslator
try:
    from src.braillevision.tts_engine import synthesize_voice_xtts as _synthesize_voice_xtts
    _tts_available = True
except (ImportError, ModuleNotFoundError) as _tts_import_err:
    print(f"[WARN] TTS engine could not be loaded: {_tts_import_err}. /api/tts endpoint will be disabled.")
    _tts_available = False
    _synthesize_voice_xtts = None

# Accept Coqui TTS terms of service automatically in background to avoid EOF blocking
os.environ["COQUI_TOS_AGREED"] = "1"

# Set Gemini API key (opsiyonel – yoksa metin çevirisi yerel mapping ile çalışır)
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDu42uAwWL4m1iqvpUGx5ws5C5MfYopM0U")
_GEMINI_AVAILABLE = bool(_GEMINI_API_KEY and _GEMINI_API_KEY != "your key")
if _GEMINI_AVAILABLE:
    genai.configure(api_key=_GEMINI_API_KEY)

import re

# ─── Unicode & raw math normalizer ────────────────────────────────────────────
_SUPERSCRIPTS = {
    '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4',
    '⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
}

def normalize_math_input(expr: str) -> str:
    """Convert raw math Unicode notation to our canonical parser form."""
    # Fix LaTeX PDF encoding issues first (ƒ→f, broken Turkish chars, etc.)
    # Note: fix_latex_encoding is defined later in the file but Python resolves
    # function references at call-time, so this forward reference is fine.
    expr = fix_latex_encoding(expr)

    # Unicode superscripts → ^N
    for sup, digit in _SUPERSCRIPTS.items():
        expr = expr.replace(sup, f'^{digit}')

    # ∫_{lower}^{upper} integrand d(var) — curly brace form
    expr = re.sub(
        r'∫\s*_\{([^}]+)\}\s*\^\{([^}]+)\}\s+(.+?)\s+d([a-zA-Z])\b',
        r'int(\3, \4, \1, \2)', expr)

    # ∫_lower^upper integrand d(var) — plain form  e.g. ∫_0^1 x^2 dx
    expr = re.sub(
        r'∫\s*_([^\s^]+)\s*\^\s*([^\s]+)\s+(.+?)\s+d([a-zA-Z])\b',
        r'int(\3, \4, \1, \2)', expr)

    # ∫ integrand d(var) — indefinite  e.g. ∫ x^2 dx
    expr = re.sub(
        r'∫\s+(.+?)\s+d([a-zA-Z])\b',
        r'int(\1, \2)', expr)

    # d/dx (expr)  or  d/dy(expr) — Leibniz form
    # Matches: d/dx(sin(x))  →  diff(sin(x), x)
    # We use a lambda to properly strip the outer parens
    def _repl_deriv(m):
        var, inner = m.group(1), m.group(2)
        return f'diff({inner}, {var})'

    expr = re.sub(
        r'd\s*/\s*d([a-zA-Z])\s*\((.+)\)\s*$',
        _repl_deriv, expr)

    # d^n/dx^n (expr)
    def _repl_deriv_n(m):
        order, var, inner = m.group(1), m.group(2), m.group(3)
        return f'diff({inner}, {var}, {order})'

    expr = re.sub(
        r'd\^([0-9]+)\s*/\s*d([a-zA-Z])\^[0-9]+\s*\((.+)\)\s*$',
        _repl_deriv_n, expr)

    # ∂f/∂x style — partial deriv (map to diff)
    expr = re.sub(
        r'∂\s*(.+?)\s*/\s*∂([a-zA-Z])',
        r'diff(\1, \2)', expr)

    return expr


def translate_math_to_nemeth(expression: str) -> dict:
    try:
        if not expression.strip():
            return {"expression": "", "braille": "", "error": "Boş ifade"}
        normalized = normalize_math_input(expression)
        tokens = Lexer(normalized).tokenize()
        ast = Parser(tokens).parse()
        braille = NemethTranslator().translate(ast)
        return {"expression": expression, "braille": braille, "error": None}
    except Exception as e:
        return {"expression": expression, "braille": "", "error": str(e)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    return FileResponse("static/index.html")

import json

def fix_latex_encoding(text: str) -> str:
    """
    Deterministic post-processor: Fixes broken LaTeX PDF font encoding.
    LaTeX PDFs often store Turkish chars as diacritic + base letter (two glyphs),
    and special symbols like the florin ƒ as the function f.
    This runs AFTER Gemini OCR and guarantees correctness.
    """
    # ── Special symbol replacements ──────────────────────────────────────
    # ƒ (U+0192 Latin Small Letter F with Hook) → f  (common in LaTeX math)
    text = text.replace('ƒ', 'f')
    # Italic/math-mode letters that PDFs sometimes encode as Unicode variants
    italic_map = {
        '\U0001d453': 'f',  # Mathematical italic small f
        '\u0192': 'f',      # Latin small letter f with hook (ƒ)
        '\u0198': 'K',      # rare K variant
    }
    for old, new in italic_map.items():
        text = text.replace(old, new)

    # ── LaTeX diacritic decomposition → composed Turkish chars ───────────
    # Order matters: longer sequences first
    replacements = [
        # --- ğ / Ğ ---
        ('g\u02d8', '\u011f'), ('\u02d8g', '\u011f'),  # g˘ / ˘g
        ('g\u0306', '\u011f'), ('\u0306g', '\u011f'),  # ğ (combining breve)
        ('\u00a8g', '\u011f'),                           # ¨g (wrong diacritic but seen)
        ('G\u02d8', '\u011e'), ('\u02d8G', '\u011e'),
        ('G\u0306', '\u011e'), ('\u0306G', '\u011e'),
        ('\u00a8G', '\u011e'),
        # --- ü / Ü ---
        ('u\u00a8', '\u00fc'), ('\u00a8u', '\u00fc'),  # u¨ / ¨u
        ('u\u0308', '\u00fc'), ('\u0308u', '\u00fc'),  # combining diaeresis
        ('U\u00a8', '\u00dc'), ('\u00a8U', '\u00dc'),
        ('U\u0308', '\u00dc'), ('\u0308U', '\u00dc'),
        # --- ş / Ş ---
        ('s\u00b8', '\u015f'), ('\u00b8s', '\u015f'),  # s¸ / ¸s
        ('s\u0327', '\u015f'), ('\u0327s', '\u015f'),  # combining cedilla
        ('S\u00b8', '\u015e'), ('\u00b8S', '\u015e'),
        ('S\u0327', '\u015e'), ('\u0327S', '\u015e'),
        # --- ç / Ç ---
        ('c\u00b8', '\u00e7'), ('\u00b8c', '\u00e7'),  # c¸ / ¸c
        ('c\u0327', '\u00e7'), ('\u0327c', '\u00e7'),
        ('C\u00b8', '\u00c7'), ('\u00b8C', '\u00c7'),
        ('C\u0327', '\u00c7'), ('\u0327C', '\u00c7'),
        # --- ö / Ö ---
        ('o\u00a8', '\u00f6'), ('\u00a8o', '\u00f6'),  # o¨ / ¨o
        ('o\u0308', '\u00f6'), ('\u0308o', '\u00f6'),
        ('O\u00a8', '\u00d6'), ('\u00a8O', '\u00d6'),
        ('O\u0308', '\u00d6'), ('\u0308O', '\u00d6'),
        # --- ı (dotless i) ---
        ('\u0131', '\u0131'),   # already correct, ensure no mangling
        ('\u0069\u0307', 'i'),  # i + combining dot above → i (normalize)
        # Edge cases seen in real PDFs
        ('\u00a8 u', '\u00fc'), ('\u00a8 o', '\u00f6'), ('\u00a8 U', '\u00dc'), ('\u00a8 O', '\u00d6'),
        ('\u02d8 g', '\u011f'), ('\u02d8 G', '\u011e'),
        ('\u00b8 s', '\u015f'), ('\u00b8 S', '\u015e'),
        ('\u00b8 c', '\u00e7'), ('\u00b8 C', '\u00c7'),
    ]
    for broken, correct in replacements:
        text = text.replace(broken, correct)

    # Apply Unicode NFC normalization to catch any remaining composed forms
    import unicodedata as _ud
    text = _ud.normalize('NFC', text)
    return text


def process_file_with_gemini(file_bytes: bytes, mime_type: str) -> list[dict]:
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt = """
        Aşağıdaki görsel/belgeden matematiksel işlemleri/denklemleri çıkar.
        Desteklenen işlemler şunlardır: toplama, çıkarma, çarpma, bölme, üslü ifadeler (x^2),
        kesirler, karekök (sqrt), küpkök (cbrt), logaritma (log, log2, log10, ln),
        trigonometrik fonksiyonlar (sin, cos, tan, arcsin, arccos, arctan, sinh, cosh, tanh),
        mutlak değer (abs), tavan/taban (ceil, floor), üstel fonksiyon (exp),
        limit (lim), toplam (sum), çarpım (prod), faktöriyel (factorial),
        pi, e, sonsuz (inf), max, min, gcd, lcm, mod,
        Kümeler ve Mantık: birleşim (∪), kesişim (∩), boş küme (∅), elemanıdır (∈), elemanı değildir (∉), alt küme (⊂), kapsar (⊃), denktir (≡), ancak ve ancak (⇔, ⇐, ⇒), fark (\\).
        
        KRİTİK - TÜRKÇE KARAKTER DÜZELTMESİ (LaTeX PDF Encoding Sorunu):
        Bu belge büyük ihtimalle LaTeX ile oluşturulmuş bir PDF'dir. Bu tür PDF'lerde Türkçe
        karakterler bozuk görünür. Aşağıdaki ZORUNLU dönüşüm tablosunu uygula:
        - "˘g" veya "g˘" veya "¨g" → "ğ"  |  "G˘" veya "˘G" → "Ğ"
        - "¨u" veya "u¨" veya "˙u" → "ü"  |  "¨U" veya "U¨" → "Ü"
        - "¸s" veya "s¸" → "ş"             |  "¸S" veya "S¸" → "Ş"
        - "¨o" veya "o¨" → "ö"             |  "¨O" veya "O¨" → "Ö"
        - "¸c" veya "c¸" → "ç"             |  "¸C" veya "C¸" → "Ç"
        - Tek başına bırakılmış "ı" (noktalı i değil, noktasız i) yerine bağlama göre "ı" veya "i" yaz.
        - "'" (tek tırnak) ile karışan "i" harflerini bağlama göre düzelt.
        Örnek broken text: "K¨okler" → "Kökler", "b¨oyle" → "böyle", "tanımlanmı¸s" → "tanımlanmış"
        
        ÖNEMLİ: Kümelerde "Tümleyen" (complement) sembolü görüyorsan bunu her zaman ÜSLÜ İFADE olarak formatla! (Örn: A'nın tümleyeni için A^c veya A^' kullan, "A c" şeklinde boşluk bırakma). Eşdeğerliklerde çift yönlü ok için ⇔ kullan (⇐⇒ kullanma).
        ÖNEMLİ - İNTEGRAL VE TÜREV FORMATLARI: Görselde integral veya türev görüyorsan:
        - Belirsiz integral için: int(x^2, x)  [int(ifade, değişken)]
        - Belirli integral için: int(x^2, x, 0, 1)  [int(ifade, değişken, alt_sınır, üst_sınır)]
        - Birinci türev için: diff(sin(x), x)  [diff(ifade, değişken)]
        - İkinci türev için: diff(x^3, x, 2)  [diff(ifade, değişken, derece)]
        - Prime gösterimi için: f'(x) veya f''(x)
        Örnek: "∫_0^1 x² dx" → int(x^2, x, 0, 1) ve "d/dx(sin x)" → diff(sin(x), x)
        
        1. Eğer görselde OCR hataları varsa bağlama göre DÜZELT.
        2. Her denklem için programatik format kullan: örn. sqrt(x), log(x), log2(x), ln(x), abs(x), x^2, x_n.
        3. Çıkarılan her bir denklem için öğrencilerin dinlerken anlayabileceği şekilde açıklayıcı bir Türkçe sesli okuma metni yaz.
        4. Çıktıyı kesinlikle JSON formatında döndür. Markdown etiketlerini (```json ... ```) kullanma, direkt JSON dizisini (array) ver.
        Format şu şekilde olmalı:
        [
            { "math": "sqrt(x) + 1/2 = 5", "explanation": "Karekök x artı bir bölü iki, beşe eşittir." },
            { "math": "log2(8) = 3", "explanation": "İki tabanında sekizin logaritması üçe eşittir." }
        ]
        """
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ])
        
        text = response.text.replace('```json', '').replace('```', '').strip()
        if not text:
            return []
            
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")

@app.post("/api/process_document")
async def process_document(file: UploadFile = File(...)):
    if not file.content_type.startswith("application/pdf") and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send a PDF or Image.")
    
    file_bytes = await file.read()
    mime_type = file.content_type
    
    extracted_items = process_file_with_gemini(file_bytes, mime_type)
    
    results = []
    for item in extracted_items:
        exp = item.get("math", "")
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            res["explanation"] = item.get("explanation", "")
            results.append(res)
            
    return JSONResponse(content={"results": results})

@app.post("/api/process_image")
async def process_image(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")
    
    file_bytes = await image.read()
    mime_type = image.content_type
    
    extracted_items = process_file_with_gemini(file_bytes, mime_type)
    
    results = []
    for item in extracted_items:
        exp = item.get("math", "")
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            res["explanation"] = item.get("explanation", "")
            results.append(res)
            
    return JSONResponse(content={"results": results})

@app.post("/api/extract_image_text_full")
async def extract_image_text_full(image: UploadFile = File(...)):
    """Gemini API kullanarak görselden düz metin ve matematik formüllerini tam doğrulukla (OCR) çıkarır."""
    if not _GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API is not available.")
        
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")
    
    try:
        file_bytes = await image.read()
        mime_type = image.content_type
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt = """
        Lütfen bu görseldeki tüm metni, formülleri ve içerikleri olduğu gibi, karakter karakter en doğru şekilde dışa aktar.
        
        KRİTİK - LaTeX PDF FONT ENCODING DÜZELTMESİ:
        Bu belge büyük ihtimalle LaTeX ile oluşturulmuş bir PDF'dir. Bu tür PDF'lerde Türkçe
        karakterler bozuk kodlanır ve görüntü üzerinde diacritic işaretleri ayrı karakter olarak görünür.
        Aşağıdaki dönüşüm tablosunu KESİNLİKLE uygula:
        
        BOZUK → DOĞRU (Küçük harf):
        "˘g", "g˘", "¨g"  → "ğ"
        "¨u", "u¨"        → "ü"
        "¸s", "s¸"        → "ş"
        "¨o", "o¨"        → "ö"
        "¸c", "c¸"        → "ç"
        Noktasız i (dotless i) → "ı"
        
        BOZUK → DOĞRU (Büyük harf):
        "˘G", "G˘", "¨G"  → "Ğ"
        "¨U", "U¨"        → "Ü"
        "¸S", "S¸"        → "Ş"
        "¨O", "O¨"        → "Ö"
        "¸C", "C¸"        → "Ç"
        
        SOMUT ÖRNEKLER:
        "K¨okler" → "Kökler"
        "b¨oyle" → "böyle"
        "tanımlanmı¸s" → "tanımlanmış"
        "˘gerçek" → "gerçek"
        "K¨u meler" veya "K¨ umeler" → "Kümeler"
        "¨ Us" veya "¨Usler" → "Üsler"
        "carpma" veya "¸carpma" → "çarpma"
        "bi¸cimde" → "biçimde"
        "degil" veya "de˘gil" → "değil"
        "varsayaca˘gız" → "varsayacağız"
        
        DİĞER KURALLAR:
        1. Matematiksel işlemleri, sembolleri (√, ≤, ≥, integral, üstel vb.) ve değişkenleri kesin bir doğrulukla metne dönüştür.
        2. Sayfa numaralarını ve başlıkları da dahil et.
        3. Sadece ve sadece dışa aktarılan metni yaz. Önüne veya arkasına kendi yorumlarını, markdown etiketlerini (```) veya açıklamalar ekleme.
        """
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ])
        
        # Sadece saf metni döndür (trimlenmiş şekilde) + deterministic encoding fix
        extracted_text = fix_latex_encoding(response.text.strip())
        return JSONResponse(content={"text": extracted_text})
        
    except Exception as e:
        print(f"Gemini API Error (extract_image_text_full): {e}")
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

def process_text_raw_with_gemini(text_input: str) -> list[dict]:
    """Gemini ile metinden matematik denklemlerini çıkar. API yoksa [] döner."""
    if not _GEMINI_AVAILABLE:
        return []
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt = f"""
        Aşağıdaki metinden matematiksel işlemleri/denklemleri çıkar.
        Desteklenen işlemler: toplama, çıkarma, çarpma, bölme, üslü ifadeler (x^2),
        kesirler, karekök (sqrt), küpkök (cbrt), logaritma (log, log2, log10, ln),
        trigonometrik fonksiyonlar (sin, cos, tan, arcsin, arccos, arctan, sinh, cosh, tanh),
        mutlak değer (abs), tavan/taban (ceil, floor), üstel fonksiyon (exp),
        limit (lim), toplam (sum), çarpım (prod), faktöriyel (factorial),
        pi, e, sonsuz (inf), max, min, gcd, lcm, mod,
        Kümeler ve Mantık: birleşim (∪), kesişim (∩), boş küme (∅), elemanıdır (∈), elemanı değildir (∉), alt küme (⊂), kapsar (⊃), denktir (≡), ancak ve ancak (⇔, ⇐, ⇒), fark (\\).
        
        ÖNEMLİ: Kümelerde "Tümleyen" (complement) sembolü görüyorsan bunu her zaman ÜSLÜ İFADE olarak formatla! (Örn: A'nın tümleyeni için A^c veya A^' kullan, "A c" şeklinde boşluk bırakma). Eşdeğerliklerde çift yönlü ok için ⇔ kullan (⇐⇒ kullanma).
        ÖNEMLİ - İNTEGRAL VE TÜREV FORMATLARI: Metinde integral veya türev görüyorsan:
        - Belirsiz integral için: int(x^2, x)  [int(ifade, değişken)]
        - Belirli integral için: int(x^2, x, 0, 1)  [int(ifade, değişken, alt_sınır, üst_sınır)]
        - Birinci türev için: diff(sin(x), x)  [diff(ifade, değişken)]
        - İkinci türev için: diff(x^3, x, 2)  [diff(ifade, değişken, derece)]
        - Prime gösterimi için: f'(x) veya f''(x)
        Örnek: "∫_0^1 x² dx" → int(x^2, x, 0, 1) ve "d/dx(sin x)" → diff(sin(x), x)
        
        1. Varsa OCR/optik hatalarını (Özellikle "i" yerine kullanılan "'" tek tırnak işaretlerini, 1 ve l karışmasını vb.) akıllıca düzelt. Kelime içinde anlamsız duran tek tırnakları i/ı harfi ile değiştir (Örn: "wr't'ng" -> "writing").
        2. Her denklem için programatik formatta yaz: sqrt(x), log(x), log2(8), ln(x), abs(x), x^2, x_n.
        3. Çıkarılan her bir denklem için **değerleri ve sayıları bizzat telaffuz ederek** detaylı bir Türkçe sesli okuma / açıklama metni yaz.
        4. Çıktıyı JSON array formatında döndür. Başka hiçbir şey yazma.
        Format:
        [
            {{ "math": "denklem formatı", "explanation": "Sayıları ve işlemleri barındıran Türkçe okuma metni" }}
        ]
        
        Metin:
        {text_input}
        """
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        if not text:
            return []
            
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return []

class TextInput(BaseModel):
    text: str

@app.post("/api/process_text")
async def process_text(data: TextInput):
    """
    Kullanıcının girdiği matematiksel ifadeleri çevirir (Nemeth).
    Eğer Gemini API kapalıysa, doğrudan girdi üzerinden (satır satır) düz matematik algoritmasını (Nemeth) dener.
    """
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")

    # Normalize mathematical italic letters and diacritics into standard characters
    # Fix LaTeX encoding issues (ƒ→f, broken Turkish chars) then NFKC normalize
    fixed_text = fix_latex_encoding(data.text)
    normalized_text = unicodedata.normalize('NFKC', fixed_text)

    # 1. Gemini ile çıkarmayı dene (API key varsa çalışır, yoksa boş [] döner)
    extracted_items = process_text_raw_with_gemini(normalized_text)

    # 2. Eğer API kapalıysa veya bir şey çıkaramadıysa, manuel fallback yap:
    if not extracted_items:
        expressions = [line.strip() for line in normalized_text.split('\n') if line.strip()]
        error_info = "Doğrudan çeviri (API Pasif)" if not _GEMINI_AVAILABLE else "API Hatası: Lütfen anahtarınızı kontrol edin."
        extracted_items = [{"math": exp, "explanation": error_info} for exp in expressions]

    results = []
    for item in extracted_items:
        exp = item.get("math", "")
        # translate_math_to_nemeth, Lexer -> Parser -> NemethTranslator zincirini API'siz (%100 yerel) kullanır
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            res["explanation"] = item.get("explanation", "")
            results.append(res)
            
    return JSONResponse(content={"results": results})


class TextBrailleInput(BaseModel):
    text: str

@app.post("/api/translate_braille_text")
async def translate_braille_text(data: TextBrailleInput):
    """Translate plain text into Grade 1 Braille alphabet."""
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")
    
    # Fix LaTeX encoding issues (ƒ→f, broken Turkish chars) then NFKC normalize
    fixed_text = fix_latex_encoding(data.text)
    normalized_text = unicodedata.normalize('NFKC', fixed_text)
    
    translator = TextBrailleTranslator()
    braille_output = translator.translate(normalized_text)
    
    return JSONResponse(content={
        "original": data.text,
        "braille": braille_output
    })

class TTSRequest(BaseModel):
    text: str

@app.post("/api/tts")
async def process_tts(data: TTSRequest):
    """
    Kullanıcı sesini temel alan Coqui XTTS Voice Cloning (Yapay Zeka Seslendirme) 
    kullanarak metni okur ve .wav formatında ses döndürür.
    """
    if not _tts_available:
        raise HTTPException(
            status_code=503,
            detail="TTS motoru yüklenemedi. 'torch' ve 'TTS' kütüphanelerinin kurulu olduğundan emin olun: pip install torch TTS"
        )

    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Okunacak metin boş olamaz.")
        
    reference_audio = PROJECT_ROOT / "voices" / "beyzases.wav"
    
    # Eğer referans ses valid bir wav dosyası değilse (henüz ayarlanmadıysa), hata veriyoruz:
    if not reference_audio.exists() or reference_audio.stat().st_size < 100:
        raise HTTPException(status_code=400, detail="'beyzases.wav' isimli referans ses dosyası 'voices/' dizininde bulunamadı veya henüz geçerli bir ses kaydedilmedi. Lütfen sisteme kendi sesinizi yükleyin (bitirme projesi demo sesi).")
        
    try:
        wav_bytes = _synthesize_voice_xtts(data.text, str(reference_audio))
        # Return as downloadable/playable WAV stream
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        print(f"TTS Engine Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ses sentezleme başarısız oldu: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
