import google.generativeai as genai
import os

api_key = "AIzaSyDu42uAwWL4m1iqvpUGx5ws5C5MfYopM0U"
genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Hello")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Test Error: {e}")
