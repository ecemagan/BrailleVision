import requests

try:
    response = requests.post(
        "http://127.0.0.1:8000/api/process_text",
        json={"text": "x^2 + y^2 = z^2"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Connection Error: {e}")
