/**
 * BrailleVision Word Add-in – HTTPS Development Server + API Proxy
 * Mixed content sorununu aşmak için /api/* isteklerini http://localhost:8000'e proxy eder.
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT         = 3000;
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8000;

async function startServer() {
  let certInfo;
  try {
    const devCerts = require('office-addin-dev-certs');
    certInfo = await devCerts.getHttpsServerOptions();
  } catch (e) {
    console.error('\n❌ HTTPS sertifikası bulunamadı!');
    console.error('Lütfen önce şunu çalıştırın: npm run install-certs\n');
    process.exit(1);
  }

  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
  };

  const server = https.createServer(certInfo, (req, res) => {
    // CORS – Word/Office WebView için zorunlu
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url);
    const pathname  = parsedUrl.pathname;

    // ── API Proxy: /api/* → http://localhost:8000 ──────────────────────────
    if (pathname.startsWith('/api/') || pathname === '/') {
      const isHealthCheck = pathname === '/';

      const options = {
        hostname: BACKEND_HOST,
        port:     BACKEND_PORT,
        path:     req.url,          // query string dahil
        method:   req.method,
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
        },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (err) => {
        if (isHealthCheck) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Backend çevrimdışı', detail: err.message }));
        } else {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            detail: 'BrailleVision backend bağlanamadı. python app.py çalışıyor mu? (port 8000)'
          }));
        }
      });

      // POST body'sini proxy'ye ilet
      if (req.method === 'POST') {
        req.pipe(proxyReq, { end: true });
      } else {
        proxyReq.end();
      }
      return;
    }

    // ── Statik dosyalar ────────────────────────────────────────────────────
    let filePath = pathname === '/' ? '/taskpane.html' : pathname;
    filePath = path.join(__dirname, filePath);

    const ext         = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 - Dosya bulunamadı: ${pathname}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.log('\n✅ BrailleVision Word Add-in sunucusu başlatıldı!');
    console.log(`🌐 HTTPS:  https://localhost:${PORT}`);
    console.log(`🔀 Proxy:  /api/* → http://localhost:${BACKEND_PORT}`);
    console.log('\n📋 Word\'ü açın → Ekle → Eklentilerim → BrailleVision\n');
    console.log('⚠️  BrailleVision backend (port 8000) de çalışıyor olmalı!\n');
  });
}

startServer();
