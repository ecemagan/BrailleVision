import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
from pathlib import Path
import google.generativeai as genai
import unicodedata
import fitz  # PyMuPDF

# Setup paths for braillevision
PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))


def load_local_env_file() -> None:
    """Loads simple KEY=VALUE pairs from .env.local for backend-only runs."""
    env_path = PROJECT_ROOT / ".env.local"

    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")

        if key and key not in os.environ:
            os.environ[key] = value


load_local_env_file()

from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser
from braillevision.text_braille_translator import TextBrailleTranslator
from src.braillevision.tts_engine import synthesize_voice_xtts

# Accept Coqui TTS terms of service automatically in background to avoid EOF blocking
os.environ["COQUI_TOS_AGREED"] = "1"

# Set Gemini API key (opsiyonel – yoksa metin çevirisi yerel mapping ile çalışır)
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
_GEMINI_AVAILABLE = bool(_GEMINI_API_KEY)
if _GEMINI_AVAILABLE:
    genai.configure(api_key=_GEMINI_API_KEY)


def get_masked_gemini_key_prefix() -> str:
    if not _GEMINI_API_KEY:
        return "<missing>"

    visible_prefix = _GEMINI_API_KEY[:5]
    return f"{visible_prefix}..."

import re

# ─── Unicode & raw math normalizer ────────────────────────────────────────────
_SUPERSCRIPTS = {
    '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4',
    '⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
}

def fix_latex_encoding(text: str) -> str:
    """
    Deterministic post-processor: Fixes broken LaTeX PDF font encoding.
    LaTeX PDFs often store Turkish chars as diacritic + base letter (two glyphs),
    and special symbols like the florin \u0192 as the function f.
    This runs AFTER Gemini OCR and guarantees correctness.
    """
    import unicodedata as _ud

    # \u2500\u2500 Special symbol replacements \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    # \u0192 (U+0192 Latin Small Letter F with Hook) \u2192 f  (common in LaTeX math)
    text = text.replace('\u0192', 'f')
    # Italic/math-mode letters that PDFs sometimes encode as Unicode variants
    for old, new in {'\U0001d453': 'f', '\u0192': 'f', '\u0198': 'K'}.items():
        text = text.replace(old, new)

    # \u2500\u2500 LaTeX diacritic decomposition \u2192 composed Turkish chars \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    replacements = [
        # --- \u011f / \u011e ---
        ('g\u02d8', '\u011f'), ('\u02d8g', '\u011f'),
        ('g\u0306', '\u011f'), ('\u0306g', '\u011f'),
        ('\u00a8g', '\u011f'),
        ('G\u02d8', '\u011e'), ('\u02d8G', '\u011e'),
        ('G\u0306', '\u011e'), ('\u0306G', '\u011e'),
        ('\u00a8G', '\u011e'),
        # --- \u00fc / \u00dc ---
        ('u\u00a8', '\u00fc'), ('\u00a8u', '\u00fc'),
        ('u\u0308', '\u00fc'), ('\u0308u', '\u00fc'),
        ('U\u00a8', '\u00dc'), ('\u00a8U', '\u00dc'),
        ('U\u0308', '\u00dc'), ('\u0308U', '\u00dc'),
        # --- \u015f / \u015e ---
        ('s\u00b8', '\u015f'), ('\u00b8s', '\u015f'),
        ('s\u0327', '\u015f'), ('\u0327s', '\u015f'),
        ('S\u00b8', '\u015e'), ('\u00b8S', '\u015e'),
        ('S\u0327', '\u015e'), ('\u0327S', '\u015e'),
        # --- \u00e7 / \u00c7 ---
        ('c\u00b8', '\u00e7'), ('\u00b8c', '\u00e7'),
        ('c\u0327', '\u00e7'), ('\u0327c', '\u00e7'),
        ('C\u00b8', '\u00c7'), ('\u00b8C', '\u00c7'),
        ('C\u0327', '\u00c7'), ('\u0327C', '\u00c7'),
        # --- \u00f6 / \u00d6 ---
        ('o\u00a8', '\u00f6'), ('\u00a8o', '\u00f6'),
        ('o\u0308', '\u00f6'), ('\u0308o', '\u00f6'),
        ('O\u00a8', '\u00d6'), ('\u00a8O', '\u00d6'),
        ('O\u0308', '\u00d6'), ('\u0308O', '\u00d6'),
        # Edge cases with spaces between diacritic and letter
        ('\u00a8 u', '\u00fc'), ('\u00a8 o', '\u00f6'),
        ('\u00a8 U', '\u00dc'), ('\u00a8 O', '\u00d6'),
        ('\u02d8 g', '\u011f'), ('\u02d8 G', '\u011e'),
        ('\u00b8 s', '\u015f'), ('\u00b8 S', '\u015e'),
        ('\u00b8 c', '\u00e7'), ('\u00b8 C', '\u00c7'),
    ]
    for broken, correct in replacements:
        text = text.replace(broken, correct)

    # Apply Unicode NFC normalization to catch any remaining composed forms
    text = _ud.normalize('NFC', text)
    return text


def normalize_math_input(expr: str) -> str:
    """Convert raw math Unicode notation to our canonical parser form."""
    expr = expr.replace("−", "-")

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

def clean_gemini_json(text: str) -> str:
    return text.replace('```json', '').replace('```', '').strip()


def normalize_optional_text(value: object) -> str:
    text = " ".join(str(value or "").split()).strip()
    if text.lower() in {"null", "none", "unknown", "unclear", "n/a"}:
        return ""
    return text


def normalize_boolean(value: object) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}

    return bool(value)


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Stage-1 OCR: Extract embedded text directly from a PDF using PyMuPDF.
    This is far more accurate than image-based OCR for digitally-created PDFs
    (e.g. LaTeX, Word exports) because it reads the actual Unicode glyphs.
    Returns the full text of all pages joined with newlines.
    Returns empty string if the PDF has no embedded text (scanned document).
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text = []
        for page in doc:
            # "text" mode preserves word order; "blocks" is also good for math-heavy pages
            page_text = page.get_text("text")
            if page_text.strip():
                pages_text.append(page_text)
        doc.close()
        return "\n".join(pages_text)
    except Exception as e:
        print(f"PyMuPDF extraction error: {e}")
        return ""


def _is_text_sufficient(text: str, min_chars: int = 80) -> bool:
    """Returns True if the extracted text has enough content to be usable."""
    # Count only alphanumeric characters to avoid counting noise
    alnum_count = sum(1 for c in text if c.isalnum())
    return alnum_count >= min_chars


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
        
        text = clean_gemini_json(response.text)
        if not text:
            return []
            
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Gemini API Error [key={get_masked_gemini_key_prefix()}]: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")

def extract_graph_with_gemini(file_bytes: bytes, mime_type: str, locale: str) -> dict:
    if not _GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API is not available. Add GEMINI_API_KEY to enable AI Vision mode.")

    lang_instruction = (
        "Write all description fields (natural_description, braille_friendly_description, shape_summary) in TURKISH."
        if locale == "tr" else
        "Write all description fields in ENGLISH."
    )

    prompt = f"""
You are a world-class mathematics teacher analyzing a graph image for a blind student.
Your goal: extract EVERY mathematically meaningful property so the student can build a
perfect mental model AND a computer algebra system can solve related problems.

{lang_instruction}
All JSON keys and enum values stay in ENGLISH regardless of locale.
Return ONLY valid JSON — no markdown fences, no commentary.

STEP 1 — GRAPH TYPE
  Choose: line | parabola | cubic | absolute_value | square_root | reciprocal |
  exponential | logarithmic | trigonometric | circle | ellipse | hyperbola |
  polynomial | piecewise | unknown

STEP 2 — EQUATION  (exact if readable, estimated + approx:true otherwise)

STEP 3 — AXIS ANALYSIS  (scale, labels, ranges)

STEP 4 — KEY MATHEMATICAL FEATURES (extract everything visible or inferrable):
  x-intercepts, y-intercept, vertex, axis of symmetry, local/global max & min,
  inflection points, increasing/decreasing intervals, concave up/down intervals,
  asymptotes (vertical, horizontal, oblique), domain, range,
  period & amplitude (trig), center & radius (circle), 4-6 sample points.

STEP 5 — CALCULUS SUMMARY (math_for_solver block):
  first derivative f'(x), second derivative f''(x),
  limit as x->+inf, limit as x->-inf,
  nature of each critical point (local_min | local_max | saddle).

STEP 6 — NATURAL DESCRIPTION (teacher speaking to blind student, locale language):
  1. "What kind of graph is this and how does it behave overall?" (one sentence)
  2. How the curve moves / changes direction.
  3. Axis crossings with meaning.
  4. At least 4 explicit coordinate examples.
  5. Equation at the end.

STEP 7 — BRAILLE-FRIENDLY DESCRIPTION (same content, one idea per line, shorter).

OUTPUT JSON SCHEMA:
{{
  "graph_type": "<from STEP 1>",
  "confidence": <0.0-1.0>,
  "equation_text": "<equation or null>",
  "equation_approx": <true|false>,
  "axes": {{
    "has_x_axis": true, "has_y_axis": true, "origin_visible": true,
    "x_range": "<e.g. -5 to 5>", "y_range": "<e.g. -10 to 10>",
    "x_scale": "<step or null>", "y_scale": "<step or null>",
    "x_label": "<or null>", "y_label": "<or null>"
  }},
  "shape_summary": "<one sentence>",
  "key_features": {{
    "x_intercepts": [{{"x": 0, "y": 0, "approx": false}}],
    "y_intercept": {{"x": 0, "y": 0, "approx": false}},
    "slope": null,
    "vertex": {{"x": 0, "y": 0, "approx": false}},
    "axis_of_symmetry": "<x=1 or null>",
    "opens": "<up|down|left|right|null>",
    "maximum_points": [{{"x": 0, "y": 0, "label": "local|global"}}],
    "minimum_points": [{{"x": 0, "y": 0, "label": "local|global"}}],
    "inflection_points": [{{"x": 0, "y": 0}}],
    "increasing_intervals": ["(-inf, 1)"],
    "decreasing_intervals": ["(1, inf)"],
    "concave_up_intervals": [],
    "concave_down_intervals": [],
    "asymptotes": {{"vertical": [], "horizontal": [], "oblique": []}},
    "domain": "all real numbers",
    "range": "y >= 0",
    "period": null, "amplitude": null,
    "center": null, "radius": null,
    "notable_points": [{{"x": 0, "y": 0, "label": "description"}}]
  }},
  "sample_points": [{{"x": 0, "y": 0, "approx": false}}],
  "math_for_solver": {{
    "first_derivative": "<f'(x) or null>",
    "second_derivative": "<f''(x) or null>",
    "limit_pos_inf": "<behavior or null>",
    "limit_neg_inf": "<behavior or null>",
    "critical_points": [{{"x": 0, "type": "local_min|local_max|saddle"}}],
    "parseable_equation": "<y=... for CAS>"
  }},
  "natural_description": "<teacher quality, locale language>",
  "braille_friendly_description": "<short, one idea per line, locale language>",
  "nemeth_ready_tokens": {{
    "equation": "<Nemeth-ready string or null>",
    "points": ["(x,y)"],
    "relations": []
  }},
  "uncertainties": []
}}
"""

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        result = model.generate_content(
            [{"mime_type": mime_type, "data": file_bytes}, prompt],
            generation_config={"temperature": 0},
        )

        text = clean_gemini_json(result.text)
        if not text:
            raise HTTPException(status_code=500, detail="Graph analysis returned an empty response.")

        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=500, detail="Graph analysis returned an invalid JSON shape.")

        return parsed
    except HTTPException:
        raise
    except Exception as e:
        print(f"Gemini API Error (process_graph) [key={get_masked_gemini_key_prefix()}]: {e}")
        raise HTTPException(status_code=500, detail=f"Graph analysis failed: {str(e)}")



def process_graph_bytes(file_bytes: bytes, mime_type: str, locale: str) -> dict:
    extracted_graph = extract_graph_with_gemini(file_bytes, mime_type, locale)

    if not isinstance(extracted_graph, dict):
        raise HTTPException(status_code=500, detail="Graph analysis returned an invalid payload.")

    return {
        **extracted_graph,
        "mode_used": "ai-vision",
    }

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

@app.post("/api/process_graph")
async def process_graph(image: UploadFile = File(...), locale: str = Form("en")):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")

    file_bytes = await image.read()
    result = process_graph_bytes(file_bytes, image.content_type, "tr" if locale == "tr" else "en")
    return JSONResponse(content=result)


@app.post("/api/analyze_graph")
async def analyze_graph(image: UploadFile = File(...), locale: str = Form("en")):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")

    file_bytes = await image.read()
    result = process_graph_bytes(file_bytes, image.content_type, "tr" if locale == "tr" else "en")
    return JSONResponse(content=result)

@app.post("/api/extract_image_text_full")
async def extract_image_text_full(
    image: UploadFile = File(...),
    profile: str = Form("image"),
    draft_text: str = Form(""),
):
    """Smart two-stage OCR pipeline:
    Stage 1: PyMuPDF direct text extraction (for digital PDFs — most accurate, no AI needed).
    Stage 2: Gemini vision fallback (for scanned PDFs / images where Stage 1 yields nothing).
    fix_latex_encoding() is applied in both stages.
    """
    if not image.content_type.startswith("image/") and not image.content_type.startswith("application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image or PDF.")

    file_bytes = await image.read()
    mime_type = image.content_type

    # ── Stage 1: PyMuPDF direct extraction (PDFs only) ────────────────────────
    if mime_type == "application/pdf" or getattr(image, "filename", "").endswith(".pdf"):
        raw_text = extract_text_from_pdf_bytes(file_bytes)
        if _is_text_sufficient(raw_text):
            # Apply deterministic Turkish/LaTeX encoding fix
            cleaned = fix_latex_encoding(raw_text)
            cleaned = unicodedata.normalize("NFC", cleaned)
            print(f"[OCR] Stage-1 (PyMuPDF): extracted {len(cleaned)} chars — Gemini not used.")
            return JSONResponse(content={"text": cleaned, "ocr_stage": "pymupdf"})
        print("[OCR] Stage-1 yielded insufficient text — falling back to Gemini vision.")

    # ── Stage 2: Gemini vision (images + scanned PDFs) ────────────────────────
    if not _GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API is not available and PyMuPDF found no embedded text. The file may be a scanned image. Please add a GEMINI_API_KEY to enable AI vision mode.")

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt = """
        Please transcribe ALL text and mathematical content from this image/page character by character with maximum fidelity.

        CRITICAL — TURKISH CHARACTER REPAIR:
        This document may be a LaTeX PDF where Turkish characters are stored as two separate glyphs
        (a diacritic mark + a base letter). You MUST apply the following corrections:

        Broken form → Correct Turkish character:
          ˘g  or  g˘  →  ğ      ˘G  or  G˘  →  Ğ
          ¨u  or  u¨  →  ü      ¨U  or  U¨  →  Ü
          ¸s  or  s¸  →  ş      ¸S  or  S¸  →  Ş
          ¨o  or  o¨  →  ö      ¨O  or  O¨  →  Ö
          ¸c  or  c¸  →  ç      ¸C  or  C¸  →  Ç
          dotless-ı (ı)         →  ı
          ƒ (florin/italic f)   →  f

        Real examples from LaTeX PDFs:
          "K¨okler" → "Kökler"
          "b¨oyle" → "böyle"
          "tanımlanmı¸s" → "tanımlanmış"
          "varsayaca˘gız" → "varsayacağız"
          "¨Usler" → "Üsler"
          "ƒ(x)" → "f(x)"

        OTHER RULES:
        1. Transcribe all mathematical symbols (√, ≤, ≥, ∫, ∂, etc.) accurately.
        2. Preserve line breaks as seen on the page.
        3. Include page numbers and section headers.
        4. Output ONLY the transcribed text — no markdown, no JSON, no comments.
        """
        if profile == "pdf_math":
            draft_hint = draft_text.strip()[:6000]
            prompt = f"""
        This image is a PDF page or textbook excerpt. Transcribe EVERY line exactly as it appears.

        Rules:
        - The source of truth is the image, not the draft below.
        - Do NOT summarize or rewrite — output the original content as plain text.
        - Each output line must correspond to exactly one readable line on the page.
        - Apply ALL Turkish character repairs listed above (˘g→ğ, ¨u→ü, etc.).
        - Convert ƒ(x) → f(x) and other font variants to standard math characters.
        - Preserve formulas: `f(x)/g(x)`, `lim x→c`, `L/M`.
        - Keep minus signs (−), relational symbols (≠, ≤, ≥, ∞, √, →).
        - Return ONLY plain text.

        Draft hint (use only if helpful, image takes priority):
        {draft_hint if draft_hint else "(none)"}
        """
        response = model.generate_content(
            [{"mime_type": mime_type, "data": file_bytes}, prompt],
            generation_config={"temperature": 0},
        )
        extracted_text = fix_latex_encoding(response.text.strip())
        extracted_text = unicodedata.normalize("NFC", extracted_text)
        print(f"[OCR] Stage-2 (Gemini): extracted {len(extracted_text)} chars.")
        return JSONResponse(content={"text": extracted_text, "ocr_stage": "gemini"})

    except Exception as e:
        print(f"Gemini API Error (extract_image_text_full) [key={get_masked_gemini_key_prefix()}]: {e}")
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
        text = clean_gemini_json(response.text)
        if not text:
            return []
            
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Gemini API Error [key={get_masked_gemini_key_prefix()}]: {e}")
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
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Okunacak metin boş olamaz.")
        
    reference_audio = PROJECT_ROOT / "voices" / "beyzases.wav"
    
    # Eğer referans ses valid bir wav dosyası değilse (henüz ayarlanmadıysa), hata veriyoruz:
    if not reference_audio.exists() or reference_audio.stat().st_size < 100:
        raise HTTPException(status_code=400, detail="'beyzases.wav' isimli referans ses dosyası 'voices/' dizininde bulunamadı veya henüz geçerli bir ses kaydedilmedi. Lütfen sisteme kendi sesinizi yükleyin (bitirme projesi demo sesi).")
        
    try:
        wav_bytes = synthesize_voice_xtts(data.text, str(reference_audio))
        # Return as downloadable/playable WAV stream
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        print(f"TTS Engine Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ses sentezleme başarısız oldu: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
