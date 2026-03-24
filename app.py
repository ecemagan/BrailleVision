import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sys
from pathlib import Path
import google.generativeai as genai

# Setup paths for braillevision
PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from braillevision.lexer import Lexer
from braillevision.nemeth_translator import NemethTranslator
from braillevision.parser import Parser

# Set Gemini API key
os.environ["GEMINI_API_KEY"] = "AIzaSyBcyeSdUpl83hq0W7wh7ZbYOBdlS43wXBI"
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def translate_math_to_nemeth(expression: str) -> dict:
    try:
        if not expression.strip():
            return {"expression": "", "braille": "", "error": "Boş ifade"}
        tokens = Lexer(expression).tokenize()
        ast = Parser(tokens).parse()
        braille = NemethTranslator().translate(ast)
        return {"expression": expression, "braille": braille, "error": None}
    except Exception as e:
        return {"expression": expression, "braille": "", "error": str(e)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    return FileResponse("static/index.html")

def process_file_with_gemini(file_bytes: bytes, mime_type: str) -> list[str]:
    # Use Gemini model to extract math expressions
    # gemini-1.5-flash is fast and supports multimodality including images and PDF.
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """
        Bu görselden/belgeden sadece matematiksel işlemleri/denklemleri çıkar. 
        Sadece düz formatta metin olarak yaz (örn: sqrt(x) + 1/2 = 5). 
        Markdown kullanma. Birden fazla denklem varsa her birini yeni bir satıra yaz.
        Açıklama, yorum veya başka bir kelime yazma.
        """
        response = model.generate_content([
            {"mime_type": mime_type, "data": file_bytes},
            prompt
        ])
        text = response.text.strip()
        if not text:
            return []
        
        # Split by newlines and clean up
        expressions = [line.strip() for line in text.split('\n') if line.strip()]
        return expressions
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")

@app.post("/api/process_document")
async def process_document(file: UploadFile = File(...)):
    if not file.content_type.startswith("application/pdf") and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send a PDF or Image.")
    
    file_bytes = await file.read()
    mime_type = file.content_type
    
    expressions = process_file_with_gemini(file_bytes, mime_type)
    
    results = []
    for exp in expressions:
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            results.append(res)
            
    return JSONResponse(content={"results": results})

@app.post("/api/process_image")
async def process_image(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Send an Image.")
    
    file_bytes = await image.read()
    mime_type = image.content_type
    
    expressions = process_file_with_gemini(file_bytes, mime_type)
    
    results = []
    for exp in expressions:
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            results.append(res)
            
    return JSONResponse(content={"results": results})

class TextInput(BaseModel):
    text: str

@app.post("/api/process_text")
async def process_text(data: TextInput):
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Metin boş olamaz.")
    
    # Text is directly provided, no need for Gemini to extract.
    # We can handle multiple lines if user enters multiple equations.
    expressions = [line.strip() for line in data.text.split('\n') if line.strip()]
    
    results = []
    for exp in expressions:
        res = translate_math_to_nemeth(exp)
        if res.get("braille") or res.get("error"):
            results.append(res)
            
    return JSONResponse(content={"results": results})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
