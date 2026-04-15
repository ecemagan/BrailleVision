#!/bin/bash
# ============================================================
#  BrailleVision – Tüm servisleri başlat
#  1. FastAPI Backend       → http://localhost:8000
#  2. Next.js Web Sitesi    → http://localhost:3001
#  3. Word Add-in Sunucusu  → https://localhost:3000
# ============================================================

# set -e kaldırıldı: sertifika kurulumu gibi opsiyonel adımlar hata verse bile devam et

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Node / npm yollarını bul ve PATH'e ekle ───────────────────────
NODE_BIN="$(which node 2>/dev/null || echo '')"
if [ -z "$NODE_BIN" ]; then
  for candidate in /usr/local/bin/node /opt/homebrew/bin/node; do
    [ -x "$candidate" ] && NODE_BIN="$candidate" && break
  done
fi
if [ -z "$NODE_BIN" ]; then
  echo "❌ node bulunamadı! Node.js kurulu olduğundan emin olun."
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"

NPM_BIN="$(which npm 2>/dev/null || echo '')"
if [ -z "$NPM_BIN" ]; then
  for candidate in \
    /usr/local/lib/node_modules/npm/bin/npm \
    "$NODE_DIR/npm" \
    /opt/homebrew/bin/npm; do
    [ -x "$candidate" ] && NPM_BIN="$candidate" && break
  done
fi
if [ -z "$NPM_BIN" ]; then
  echo "❌ npm bulunamadı! Node.js kurulu olduğundan emin olun."
  exit 1
fi

# ── Renk tanımları ──────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[BrailleVision]${NC} $1"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; }

# ── Temizlik: Ctrl+C ile tüm alt süreçleri öldür ───────────
cleanup() {
  echo ""
  warn "Kapatılıyor… tüm servisler durduruluyor."
  kill -- -$$ 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Port kontrol fonksiyonu ─────────────────────────────────
port_in_use() { lsof -i TCP:"$1" -sTCP:LISTEN -t &>/dev/null; }

# ── Sanal ortam aktivasyonu ──────────────────────────────────
cd "$PROJECT_ROOT"

if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
  ok "Python sanal ortamı (.venv) aktifleştirildi"
elif command -v python3 &>/dev/null; then
  warn ".venv bulunamadı, sistem Python kullanılıyor"
else
  err "Python3 bulunamadı! Lütfen Python yükleyin."
  exit 1
fi

# ── 1. FastAPI Backend ──────────────────────────────────────
if port_in_use 8000; then
  warn "Port 8000 zaten kullanımda – FastAPI başlatılmıyor"
else
  log "FastAPI backend başlatılıyor (port 8000)…"
  python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload \
    > /tmp/braillevision-backend.log 2>&1 &
  BACKEND_PID=$!
  ok "FastAPI PID=$BACKEND_PID  →  http://localhost:8000"
fi

# ── 2. Next.js Web Sitesi ───────────────────────────────────
if port_in_use 3001; then
  warn "Port 3001 zaten kullanımda – Next.js başlatılmıyor"
else
  log "Next.js web sitesi başlatılıyor (port 3001)…"
  "$NPM_BIN" run dev:addin \
    > /tmp/braillevision-nextjs.log 2>&1 &
  NEXT_PID=$!
  ok "Next.js PID=$NEXT_PID  →  http://localhost:3001"
fi

# ── 3. Word Add-in HTTPS Sunucusu ───────────────────────────
if port_in_use 3000; then
  warn "Port 3000 zaten kullanımda – Word Add-in sunucusu başlatılmıyor"
else
  log "Word Add-in HTTPS sunucusu başlatılıyor (port 3000)…"
  cd "$PROJECT_ROOT/word-addin"

  # Sertifika yoksa yükle
  if ! "$NODE_BIN" -e "require('office-addin-dev-certs').getHttpsServerOptions()" &>/dev/null 2>&1; then
    warn "HTTPS sertifikaları bulunamadı – yükleniyor…"
    cd "$PROJECT_ROOT/word-addin"
    "$NPM_BIN" run install-certs || warn "Sertifika kurulumu başarısız – sunucu yine de deneniyor"
  fi

  "$NPM_BIN" start \
    > /tmp/braillevision-wordaddin.log 2>&1 &
  WORD_PID=$!
  cd "$PROJECT_ROOT"
  ok "Word Add-in PID=$WORD_PID  →  https://localhost:3000"
fi

# ── Özet ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        🧠 BrailleVision Çalışıyor!         ║${NC}"
echo -e "${BOLD}╠════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Backend  →  http://localhost:8000          ║${NC}"
echo -e "${BOLD}║  Website  →  http://localhost:3001          ║${NC}"
echo -e "${BOLD}║  Word     →  https://localhost:3000         ║${NC}"
echo -e "${BOLD}╠════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Chrome Extension: chrome://extensions      ║${NC}"
echo -e "${BOLD}║  → 'Geliştirici Modu' aç                    ║${NC}"
echo -e "${BOLD}║  → 'Paketlenmemiş yükle' → /extension klas. ║${NC}"
echo -e "${BOLD}╠════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Durdurmak için: Ctrl+C                     ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Log dosyaları:${NC}"
echo "   Backend  : tail -f /tmp/braillevision-backend.log"
echo "   Next.js  : tail -f /tmp/braillevision-nextjs.log"
echo "   Word     : tail -f /tmp/braillevision-wordaddin.log"
echo ""

# ── Servislerin ayağa kalkmasını bekle ─────────────────────
wait
