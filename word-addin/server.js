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
const NEXT_HOST    = 'localhost';
const NEXT_PORT    = 3001;

function proxyRequest(req, res, target) {
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.path || req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${target.hostname}:${target.port}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: err.message }));
  });

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    req.pipe(proxyReq, { end: true });
  } else {
    proxyReq.end();
  }
}

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
    if (pathname.startsWith('/api/')) {
      proxyRequest(req, res, {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
      });
      return;
    }

    if (pathname === '/backend-health') {
      proxyRequest(req, res, {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: '/',
      });
      return;
    }

    if (pathname === '/') {
      res.writeHead(302, { Location: '/word' });
      res.end();
      return;
    }

    // ── Manifest ve ikonlar yerel statik, add-in UI ise Next üzerinden gelir ──
    const filePath = path.normalize(path.join(__dirname, pathname));

    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 - Forbidden');
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (!statError && stats.isFile()) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readError, data) => {
          if (readError) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 - Dosya bulunamadı: ${pathname}`);
            return;
          }

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
        return;
      }

      proxyRequest(req, res, {
        hostname: NEXT_HOST,
        port: NEXT_PORT,
      });
    });
  });

  server.listen(PORT, () => {
    console.log('\n✅ BrailleVision Word Add-in sunucusu başlatıldı!');
    console.log(`🌐 HTTPS:  https://localhost:${PORT}`);
    console.log(`🔀 Proxy:  /api/* → http://localhost:${BACKEND_PORT}`);
    console.log(`🖥️  UI Proxy: /word → http://localhost:${NEXT_PORT}/word`);
    console.log('\n📋 Word\'ü açın → Ekle → Eklentilerim → BrailleVision\n');
    console.log('⚠️  Önce Next UI (port 3001) ve backend (port 8000) de çalışıyor olmalı!\n');
  });
}

startServer();
