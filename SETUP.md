# BrailleVision – Kurulum Rehberi

Bu rehber, projeyi GitHub'dan çektikten sonra sıfırdan kurmak için adım adım talimatlar içerir.
Hem **macOS** hem **Windows** için talimatlar verilmiştir.

---

## Gereksinimler

Kurulması gereken programlar:

| Program | Sürüm | İndirme |
|---------|-------|---------|
| Python | 3.10+ | https://www.python.org/downloads/ |
| Node.js | 18+ | https://nodejs.org/ |
| Microsoft Word | macOS veya Windows | Microsoft 365 |

> ⚠️ Python kurulumunda **"Add Python to PATH"** kutucuğunu işaretlemeyi unutma (Windows'ta).

---

## Adım 1 – Projeyi İndir

```bash
git clone https://github.com/KULLANICI_ADI/BrailleVision.git
cd BrailleVision
```

---

## Adım 2 – Python Bağımlılıklarını Kur

```bash
pip install -r requirements.txt
```

> Windows'ta `pip` çalışmazsa `py -m pip install -r requirements.txt` dene.

---

## Adım 3 – Word Eklentisi Bağımlılıklarını Kur

```bash
cd word-addin
npm install
```

---

## Adım 4 – HTTPS Sertifikasını Kur

Word eklentileri HTTPS gerektiriyor. Aşağıdaki komutu çalıştır:

```bash
# word-addin klasöründeyken:
npm run install-certs
```

> macOS'ta şifre sorabilir — Mac giriş şifreni gir.
> Windows'ta "Evet" onayı ister.

---

## Adım 5 – Manifest'i Word'e Tanıt

Bu adım **bir kez** yapılır. İşletim sistemine göre farklı:

### macOS:

```bash
# Terminal'de çalıştır:
mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
cp word-addin/manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/BrailleVision.xml
```

### Windows:

1. `word-addin` klasörünün tam yolunu bul (örn: `C:\Users\ADINIZ\BrailleVision\word-addin`)
2. Word'ü aç → **Dosya → Seçenekler → Güven Merkezi → Güven Merkezi Ayarları**
3. **Güvenilen Eklenti Katalogları** sekmesine tıkla
4. Katalog URL'sine `word-addin` klasörünün yolunu yaz (örn: `\\localhost\BrailleVision\word-addin`)
5. **Listeye Ekle** → **Menüde Göster** kutusunu işaretle → **Tamam**
6. Word'ü kapat ve yeniden aç

---

## Adım 6 – Sunucuları Başlat

Her kullanımdan önce **iki terminal** açıp şu komutları çalıştır:

### Terminal 1 – Python Backend:

```bash
# BrailleVision ana klasöründe:
cd BrailleVision
python3 app.py          # macOS
python app.py           # Windows
```

Başarılı çıktı:
```
INFO: Uvicorn running on http://127.0.0.1:8000
INFO: Application startup complete.
```

### Terminal 2 – Word Eklentisi HTTPS Sunucusu:

```bash
# word-addin klasöründe:
cd BrailleVision/word-addin
node server.js
```

Başarılı çıktı:
```
✅ BrailleVision Word Add-in sunucusu başlatıldı!
🌐 HTTPS:  https://localhost:3000
🔀 Proxy:  /api/* → http://localhost:8000
```

---

## Adım 7 – Word'de Eklentiyi Aç

1. Microsoft Word'ü aç (sunucular çalışırken)
2. **Ekle** sekmesine tıkla
3. **Eklentilerim** → **Paylaşılan Klasör** → **BrailleVision** seç
4. Sağ tarafta BrailleVision paneli açılır

---

## Sorun Giderme

### ❌ "Backend bağlanamadı" hatası
→ Terminal 1'deki Python sunucusunu başlattığından emin ol (`python3 app.py`)

### ❌ Panel hiç açılmıyor
→ Terminal 2'deki Node sunucusunun çalıştığından emin ol (`node server.js`)
→ `https://localhost:3000` adresini tarayıcıda aç — "Bağlantı güvenli değil" uyarısı gelirse **Gelişmiş → Yine de devam et** de

### ❌ `npm run install-certs` başarısız oldu
→ Şunu dene: `npx office-addin-dev-certs install`

### ❌ Windows'ta port engeli
→ Güvenlik duvarı (Firewall) 3000 ve 8000 portlarına izin vermeli. Windows Defender Firewall → Uygulama izni ver.

---

## Her Oturumda Çalıştırılacaklar (Özet)

```bash
# Terminal 1
cd BrailleVision && python3 app.py

# Terminal 2
cd BrailleVision/word-addin && node server.js
```

Sonra Word'ü aç → Eklentilerim → BrailleVision ✅
