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

def process_file_with_gemini(file_bytes: bytes, mime_type: str) -> list[dict]:
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """
        Aşağıdaki görsel/belgeden matematiksel işlemleri/denklemleri çıkar.
        Desteklenen işlemler şunlardır: toplama, çıkarma, çarpma, bölme, üslü ifadeler (x^2),
        kesirler, karekök (sqrt), küpkök (cbrt), logaritma (log, log2, log10, ln),
        trigonometrik fonksiyonlar (sin, cos, tan, arcsin, arccos, arctan, sinh, cosh, tanh),
        mutlak değer (abs), tavan/taban (ceil, floor), üstel fonksiyon (exp),
        limit (lim), toplam (sum), çarpım (prod), faktöriyel (factorial),
        pi, e, sonsuz (inf), max, min, gcd, lcm, mod,
        Kümeler ve Mantık: birleşim (∪), kesişim (∩), boş küme (∅), elemanıdır (∈), elemanı değildir (∉), alt küme (⊂), kapsar (⊃), denktir (≡), ancak ve ancak (⇔, ⇐, ⇒), fark (\\).
        
        ÖNEMLİ: Kümelerde "Tümleyen" (complement) sembolü görüyorsan bunu her zaman ÜSLÜ İFADE olarak formatla! (Örn: A'nın tümleyeni için A^c veya A^' kullan, "A c" şeklinde boşluk bırakma). Eşdeğerliklerde çift yönlü ok için ⇔ kullan (⇐⇒ kullanma).
        ÖNEMLİ - İNTEGRAL VE TÜREV FORMATLARI: Görselde integral veya türev görüyorsan:
        - Belirsiz integral için: int(x^2, x)  [int(ifade, değişken)]
        - Belirli integral için: int(x^2, x, 0, 1)  [int(ifade, değişken, alt_sınır, üst_sınır)]
        - Birinci türev için: diff(sin(x), x)  [diff(ifade, değişken)]
        - İkinci türev için: diff(x^3, x, 2)  [diff(ifade, değişken, derece)]
        - Prime gösterimi için: f'(x) veya f''(x)
        Örnek: "∫_0^1 x² dx" → int(x^2, x, 0, 1) ve "d/dx(sin x)" → diff(sin(x), x)
        
        1. Eğer görselde OCR hataları (Örn: i ve ' (tek tırnak) karışması, l ve 1 karışması, f ve integral işareti vb.) varsa bağlama göre DÜZELT. En sık yapılan "i" yerine "'" (tek tırnak) kullanımını kelimenin anlamına göre i/ı olarak mutlaka düzelt (Örn: "wr't'ng" -> "writing", "opportun't'es" -> "opportunities").
        2. Her denklem için programatik format kullan: örn. sqrt(x), log(x), log2(x), ln(x), abs(x), x^2, x_n.
        3. Çıkarılan her bir denklem için öğrencilerin dinlerken anlayabileceği şekilde **değerleri ve sayıları bizzat telaffuz ederek** açıklayıcı bir Türkçe sesli okuma metni yaz.
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

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """
        You are analyzing a mathematical graph for a blind user.

        Describe the graph in a way that helps the user build a mental model of it.

        Rules:
        - Focus on mathematical meaning, not colors or decorative appearance.
        - Identify the graph type if possible.
        - The explanation must help the user imagine the graph step by step, not just list facts.
        - Mention axes, intercepts, key points, direction, and equation if available.
        - Use explicit coordinates when possible.
        - If exact values are unclear, say "approximately".
        - Do not hallucinate hidden values.
        - Do not use phrases like "as shown" or "you can see".
        - Do not start with the equation.
        - Do not just list slope and intercepts without explaining what they mean.
        - Use simple, clear sentences.
        - Include movement language such as "as x increases, y increases" when it fits the graph.
        - Include 2 to 3 explicit example points when possible.
        - Make the natural description feel like a teacher explaining the graph to a blind student.
        - Use English enum values and English text fields.
        - Return valid JSON only.

        Schema:
        {
          "graph_type": "line | parabola | absolute_value | vertical_line | horizontal_line | circle | polynomial | piecewise | unknown",
          "confidence": 0.0,
          "equation_text": "string or null",
          "axes": {
            "has_x_axis": true,
            "has_y_axis": true,
            "origin_visible": true,
            "scale_notes": "string"
          },
          "shape_summary": "short structural summary",
          "key_features": {
            "x_intercepts": [{"x": number, "y": 0, "approx": false}],
            "y_intercepts": [{"x": 0, "y": number, "approx": false}],
            "slope": "number or null",
            "increasing_intervals": ["string"],
            "decreasing_intervals": ["string"],
            "vertex": {"x": number, "y": number, "approx": false},
            "opens": "up | down | left | right | null",
            "axis_of_symmetry": "string or null",
            "maximum_point": {"x": number, "y": number},
            "minimum_point": {"x": number, "y": number},
            "center": {"x": number, "y": number},
            "radius": "number or null",
            "notable_points": [{"x": number, "y": number, "label": "string"}]
          },
          "natural_description": "clear explanation for a blind user or empty string",
          "braille_friendly_description": "shorter and simpler explanation or empty string",
          "nemeth_ready_tokens": {
            "equation": "string or null",
            "points": ["(x,y)"],
            "relations": ["string"]
          },
          "uncertainties": ["string"]
        }

        Important accessibility rule:
        Both "natural_description" and "braille_friendly_description" must follow this order:
        1. Overall shape and behavior. The first sentence must answer: "What kind of graph is this and how does it generally behave?"
        2. How the graph changes or moves.
        3. Axis intersections, with meaning explained in words.
        4. Example points, with at least 2 to 3 explicit coordinates when possible.
        5. Equation at the end.

        The natural description should be detailed and explanatory.
        The Braille-friendly version must be shorter, use one idea per line, keep the same order, and avoid unnecessary words.

        Examples:
        - "This graph shows a straight line rising from left to right."
        - "This graph shows a U-shaped parabola opening upward."
        - "This graph shows a horizontal line where y stays constant."
        """
        result = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ])

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
    """Gemini API kullanarak görselden düz metin ve matematik formüllerini tam doğrulukla (OCR) çıkarır."""
    if not _GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API is not available.")
        
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")
    
    try:
        file_bytes = await image.read()
        mime_type = image.content_type
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """
Lütfen bu görseldeki tüm metni, formülleri ve içerikleri olduğu gibi, karakter karakter en doğru şekilde dışa aktar. 
1. Türkçe karakterleri (ğ, ü, ş, ı, ö, ç) tamamen doğru yaz (asla birleştirilmiş veya bozuk harfler kullanma, 'yo˘gundurlar' yerine 'yoğundurlar' yaz).
2. Matematiksel işlemleri, sembolleri (√, ≤, ≥, integral, üstel vb.) ve değişkenleri kesin bir doğrulukla metne dönüştür.
3. Sadece ve sadece dışa aktarılan metni yaz. Önüne veya arkasına kendi yorumlarını, markdown etiketlerini (```) veya açıklamalar ekleme.
        """
        if profile == "pdf_math":
            draft_hint = draft_text.strip()[:6000]
            prompt = f"""
Bu görsel bir PDF sayfası veya ders kitabı parçasıdır. Görevin SAYFADAKİ METNİ VE MATEMATİK İFADELERİNİ satır satır, mümkün olan en birebir şekilde transkribe etmektir.

Çok önemli:
- Kaynak gerçek görseldir. Aşağıda verilecek taslak metin sadece yardımcı ipucudur; görselle çelişirse görseli esas al.
- Amaç "özetlemek" veya "yeniden yazmak" değil, orijinal içeriği düz metin olarak doğru aktarmaktır.
- Çıktıdaki her satır, sayfadaki tek bir okunabilir satıra karşılık gelsin. Komşu satırları birleştirme. Farklı kuralları veya sütunları birbirine karıştırma.

Kurallar:
1. Başlık, numara ve kural adı solda; formül sağda ise TEK SATIRDA birleştir. Ama aynı satıra sadece o satıra ait tek kuralı yaz.
2. Limit alt bilgisi satır altında görünüyorsa bunu `lim x→c ...` biçiminde aynı satıra taşı.
3. Kesirleri düz metinde doğru yaz: `f(x)/g(x)` ve `L/M`. Gereksiz boşluk ekleme.
4. `ƒ(x)` varsa `f(x)` yaz. Görseldeki süslü/font farklı karakterleri standart matematik karakterine çevir ama anlamı değiştirme.
5. Eksi işaretini ve özel sembolleri doğru koru: `−`, `≠`, `≤`, `≥`, `∞`, `√`, `→`.
6. Aynı kuralı tekrar etme. Yan yana duran farklı satırları tek satır yapma. Özellikle şunları ASLA üretme: `xSc`, `x S c`, `lim lim`, `x x x`, `L / M`.
7. Şüpheli bir karakter varsa en olası doğru karakteri yaz ama sembol uydurma. Okunmuyorsa sadece o kısmı kısa ve minimal bırak; açıklama ekleme.
8. Sadece saf metni döndür. Markdown, JSON, açıklama veya yorum ekleme.

Beklenen çıktı örnekleri:
1. Sum Rule: lim x→c (f(x) + g(x)) = L + M
5. Quotient Rule: lim x→c f(x)/g(x) = L/M, M ≠ 0

Yardımcı taslak metin:
{draft_hint if draft_hint else "(taslak yok)"}
"""
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ], generation_config={"temperature": 0})
        
        # Sadece saf metni döndür (trimlenmiş şekilde)
        extracted_text = response.text.strip()
        return JSONResponse(content={"text": extracted_text})
        
    except Exception as e:
        print(f"Gemini API Error (extract_image_text_full) [key={get_masked_gemini_key_prefix()}]: {e}")
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

def process_text_raw_with_gemini(text_input: str) -> list[dict]:
    """Gemini ile metinden matematik denklemlerini çıkar. API yoksa [] döner."""
    if not _GEMINI_AVAILABLE:
        return []
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
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
    normalized_text = unicodedata.normalize('NFKC', data.text)

    # 1. Gemini ile çıkarmayı dene (API key varsa çalışır, yoksa boş [] döner)
    extracted_items = process_text_raw_with_gemini(normalized_text)

    # 2. Eğer API kapalıysa veya bir şey çıkaramadıysa, manuel fallback yap:
    if not extracted_items:
        expressions = [line.strip() for line in normalized_text.split('\n') if line.strip()]
        extracted_items = [{"math": exp, "explanation": "Doğrudan çeviri (API Kapalı)"} for exp in expressions]

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
    
    normalized_text = unicodedata.normalize('NFKC', data.text)
    
    translator = TextBrailleTranslator()
    braille_output = translator.translate(normalized_text)
    
    return JSONResponse(content={
        "original": data.text,
        "braille": braille_output
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
