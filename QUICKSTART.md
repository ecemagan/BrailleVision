# BrailleVision - Hızlı Başlangıç

## İlk Kez Kurulum (Tek Seferlik)

```bash
# 1. Projeyi klonla
git clone https://github.com/ecemagan/BrailleVision.git
cd BrailleVision

# 2. Python ortamını kur
python3 -m venv .venv
source .venv/bin/activate           # macOS/Linux
# .venv\Scripts\activate            # Windows

# 3. Python bağımlılıklarını yükle
pip install -r requirements.txt

# 4. Node bağımlılıklarını yükle
npm install
cd word-addin
npm install
cd ..

# 5. HTTPS sertifikasını yükle (Word gerektiriyor)
cd word-addin
npm run install-certs
cd ..

# 6. Manifest'i Word'e tanıt (macOS)
mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
cp word-addin/manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/manifest.xml

# Windows için: SETUP.md dosyasının "Adım 5" bölümüne bak
```

---

## Her Gün - Sunucuları Başlat (2 Terminal)

### Terminal 1 - Python Backend (Port 8000)
```bash
cd BrailleVision
source .venv/bin/activate           # macOS/Linux
# .venv\Scripts\activate            # Windows
python app.py
```

### Terminal 2 - Word Add-in Gateway (Port 3000)
```bash
cd BrailleVision/word-addin
npm start
```

---

## Word'de Eklentiyi Aç

1. Microsoft Word'ü aç (sunucular çalışırken)
2. **Ekle** sekmesine tıkla
3. **Eklentilerim** → **Paylaşılan Klasör** 
4. **BrailleVision** eklentisini seç
5. Sağ tarafta eklenti paneli açılır ✅

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| "Backend bağlanamadı" | Terminal 1'deki Python sunucusunu kontrol et (`python app.py`) |
| Panel açılmıyor | Terminal 2'deki Node sunucusunu kontrol et (`npm start`) |
| `npm start` hatası | `cd word-addin && npm install` dene |
| macOS sertifika hatası | `cd word-addin && npm run install-certs` komutunu çalıştır |
| Windows port engeli | Firewall ayarlarında 3000 ve 8000 portlarına izin ver |

---

## Detaylı Kurulum

Daha ayrıntılı talimatlar için `SETUP.md` dosyasını oku.
