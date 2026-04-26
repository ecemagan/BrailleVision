import google.generativeai as genai
import os

api_key = "AIzaSyDu42uAwWL4m1iqvpUGx5ws5C5MfYopM0U"
genai.configure(api_key=api_key)

try:
    print("Listing models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model ID: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
