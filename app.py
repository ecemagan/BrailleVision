import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
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

from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser
from braillevision.text_braille_translator import TextBrailleTranslator

# Set Gemini API key (opsiyonel – yoksa metin çevirisi yerel mapping ile çalışır)
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "your key")
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
        
        1. Eğer görselde OCR hataları (l ve 1 karışması, f ve integral işareti vb.) varsa bağlama göre DÜZELT.
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
        
        1. Varsa OCR/optik hatalarını (1 ve l karışması vb.) akıllıca düzelt.
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

