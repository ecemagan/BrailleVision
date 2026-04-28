import os
import io
import wave
import torch
import soundfile as sf
import numpy as np

# TTS will be imported here when needed, to avoid loading models globally if not used immediately.
_tokenizer = None
_model = None

# Fallback basic XTTS config format
def get_tts_engine():
    global _model
    if _model is None:
        try:
            from TTS.api import TTS
            
            # PyTorch 2.6+ default weights_only=True blocks Coqui's custom classes.
            # We patch torch.load globally to handle this since we trust the model source.
            import torch
            _orig_torch_load = torch.load
            def _patched_torch_load(*args, **kwargs):
                if 'weights_only' not in kwargs:
                    kwargs['weights_only'] = False
                return _orig_torch_load(*args, **kwargs)
            torch.load = _patched_torch_load

            print("Downloading/Loading XTTS Model (This may take a while...)")
            
            # Using xtts_v2 for zero-shot voice cloning
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Some Macs support mps but TTS package might have limited MPS support. 
            # We'll use CPU if CUDA is not available.
            _model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("XTTS Model Loaded Successfully!")
        except Exception as e:
            print(f"Failed to load TTS model: {e}")
            raise e
    return _model

def synthesize_voice_xtts(text: str, reference_audio_path: str, output_path: str = None) -> bytes:
    """
    Kullanıcının verilen metnini, verilen ses referansına dayanarak sentezler ve byte dizisi olarak döndürür.
    Eğer output_path verilirse ayrıca dosyaya da yazar.
    """
    tts = get_tts_engine()

    if not os.path.exists(reference_audio_path):
        raise FileNotFoundError(f"Referans ses dosyası bulunamadı: {reference_audio_path}")

    # Generate audio
    # XTTS language code for Turkish is "tr"
    # speed=0.85: Daha yavaş ve anlaşılır, "ürpertici" olmayan bir tempo için ayarlandı.
    print(f"[XTTS] Ses üretiliyor... Metin uzunluğu: {len(text)} karakter")
    wav = tts.tts(text=text, speaker_wav=reference_audio_path, language="tr", speed=0.85)

    # The output is a numpy array (wav object) with sample rate of 24000
    sample_rate = 24000
    
    # We buffer our wav to memory
    audio_buffer = io.BytesIO()
    
    # Save the numpy array to bytes using soundfile
    sf.write(audio_buffer, wav, sample_rate, format='WAV')
    
    encoded_audio = audio_buffer.getvalue()
    
    if output_path is not None:
        with open(output_path, "wb") as f:
            f.write(encoded_audio)
            
    return encoded_audio

