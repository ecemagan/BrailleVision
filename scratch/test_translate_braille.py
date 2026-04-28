import requests

try:
    response = requests.post(
        "http://127.0.0.1:8000/api/translate_braille_text",
        json={"text": "merhaba dunya"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Connection Error: {e}")
