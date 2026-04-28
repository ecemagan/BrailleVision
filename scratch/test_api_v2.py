import os
import google.generativeai as genai
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def load_local_env_file() -> None:
    env_path = PROJECT_ROOT / ".env.local"
    if not env_path.exists():
        print(".env.local not found")
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
api_key = os.environ.get("GEMINI_API_KEY")
print(f"API Key found: {bool(api_key)}")
if api_key:
    print(f"Key starts with: {api_key[:5]}...")
    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content("Say 'Test OK'")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Gemini API Error: {e}")
else:
    print("GEMINI_API_KEY not found in environment")
