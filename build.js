#!/usr/bin/env node
/**
 * GIS Build Script
 *
 * Usage:
 *   node build.js [version]   → Prod build: dist/gis_vXXen.html (single-file)
 *   node build.js --dev       → Dev server: http://localhost:<port>/ (modules served separately)
 *
 * Prod mode: reads src/template.html + all src/*.js modules in declared order,
 *            injects concatenated JS into the // __GIS_JS__ placeholder,
 *            writes dist/gis_vXXen.html
 *
 * Dev mode:  reads src/template.html, replaces the <script>// __GIS_JS__</script>
 *            block with one <script src="./src/NAME.js"></script> per module,
 *            writes dev/index.html, starts a mini HTTP server on the first free
 *            port from 7800–7810, opens Chrome.
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const net  = require('net');
const { exec, spawn } = require('child_process');

// ── Config ───────────────────────────────────────────────────────────────
const ARG       = process.argv[2] || '90en';
const IS_DEV    = ARG === '--dev';
const VERSION   = IS_DEV ? null : ARG;
const ROOT      = __dirname;
const SRC       = path.join(ROOT, 'src');
const DIST      = path.join(ROOT, 'dist');
const DEV       = path.join(ROOT, 'dev');
const TEMPLATE  = path.join(SRC, 'template.html');
const JS_MARKER = '// __GIS_JS__';

// Dev server config
// CRITICAL: Port je fixní na 7800, ne range. Důvod:
// IndexedDB je izolovaná per-origin (protokol + host + port). Pokud by server
// startoval na 7801 při obsazeném 7800, user by přišel o celou knihovnu —
// localhost:7800 a localhost:7801 jsou pro browser ROZDÍLNÉ origins.
// Lepší je proto selhat s jasnou chybou a nechat usera port uvolnit.
const DEV_PORT = 7800;

// ── Module order (must match original file order exactly) ─────────────────
const MODULES = [
  'models.js',
  'styles.js',
  'setup.js',
  'spending.js',
  'model-select.js',
  'assets.js',
  'refs.js',
  'generate.js',
  'fal.js',
  'output-placeholder.js',
  'proxy.js',
  'gemini.js',
  'output-render.js',
  'db.js',
  'gallery.js',
  'toast.js',
  'paint.js',
  'ai-prompt.js',
  'video.js',
];

// ═════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═════════════════════════════════════════════════════════════════════════

function readTemplate() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`ERROR: template not found: ${TEMPLATE}`);
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (!template.includes(JS_MARKER)) {
    console.error(`ERROR: JS_MARKER "${JS_MARKER}" not found in template.html`);
    process.exit(1);
  }
  return template;
}

function verifyModules() {
  for (const mod of MODULES) {
    const modPath = path.join(SRC, mod);
    if (!fs.existsSync(modPath)) {
      console.error(`ERROR: module not found: ${modPath}`);
      process.exit(1);
    }
  }
}

function validateHtmlStructure(template) {
  const htmlOnly = template.split(JS_MARKER)[0] || '';
  const divOpens  = (htmlOnly.match(/<div[\s>]/g) || []).length;
  const divCloses = (htmlOnly.match(/<\/div>/g) || []).length;
  const divBalance = divOpens - divCloses;
  if (divBalance !== 0) {
    console.error(`\n  ⚠ WARNING: HTML div balance = ${divBalance} (${divOpens} opens, ${divCloses} closes)`);
    console.error(`    Template has ${divBalance > 0 ? divBalance + ' unclosed' : Math.abs(divBalance) + ' extra closing'} <div> tag(s)!`);
  } else {
    console.log(`  ✓ HTML div balance: OK (${divOpens} pairs)`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// PROD BUILD
// ═════════════════════════════════════════════════════════════════════════

function buildProd() {
  const OUT_FILE = path.join(DIST, `gis_v${VERSION}.html`);

  const template = readTemplate();
  verifyModules();

  // Concatenate modules
  const parts = [];
  let totalLines = 0;
  for (const mod of MODULES) {
    const modPath = path.join(SRC, mod);
    const src = fs.readFileSync(modPath, 'utf8');
    const lines = src.split('\n').length;
    totalLines += lines;
    parts.push(src);
    console.log(`  ✓ ${mod.padEnd(28)} ${String(lines).padStart(5)} lines`);
  }

  const js = parts.join('').replace(/\n$/, '');
  const html = template.replace(JS_MARKER, js);

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  validateHtmlStructure(template);

  const outLines = html.split('\n').length;
  console.log(`\n  ✓ Built: dist/gis_v${VERSION}.html`);
  console.log(`    JS: ${totalLines} lines across ${MODULES.length} modules`);
  console.log(`    Total output: ${outLines} lines`);
}

// ═════════════════════════════════════════════════════════════════════════
// DEV SERVER
// ═════════════════════════════════════════════════════════════════════════

/**
 * Replace the single <script>// __GIS_JS__</script> block with one
 * <script src="./src/NAME.js"></script> per module.
 *
 * Critical: the marker lives INSIDE a <script> block in template.html.
 * We can't just replace the marker with more <script> tags (nested scripts),
 * so we match-and-replace the entire wrapping <script> element.
 */
function generateDevHtml(template) {
  // Match: <script>\s*// __GIS_JS__\s*</script>
  // Permissive whitespace, must be the script block containing ONLY the marker.
  const blockRegex = /<script>\s*\/\/\s*__GIS_JS__\s*<\/script>/;
  if (!blockRegex.test(template)) {
    console.error('ERROR: Could not find <script>// __GIS_JS__</script> block in template.');
    console.error('       The marker must be the sole content of its <script> tag.');
    process.exit(1);
  }

  const scriptTags = MODULES
    .map(mod => `<script src="./src/${mod}"></script>`)
    .join('\n');

  return template.replace(blockRegex, scriptTags);
}

function isPortFree(port) {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.once('close', () => resolve(true)).close())
      .listen(port, '127.0.0.1');
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.mjs' : 'application/javascript; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg' : 'image/svg+xml',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico' : 'image/x-icon',
  '.txt' : 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeResolve(baseDir, reqPath) {
  // Resolve and verify the path stays within baseDir (path-traversal guard).
  const resolved = path.resolve(baseDir, '.' + reqPath);
  if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
    return null;
  }
  return resolved;
}

function openChrome(url) {
  const platform = process.platform;
  let cmd, args;
  if (platform === 'win32') {
    // Windows: `start` needs an empty title argument when the first arg is quoted.
    cmd = 'cmd';
    args = ['/c', 'start', '', 'chrome', url];
  } else if (platform === 'darwin') {
    cmd = 'open';
    args = ['-a', 'Google Chrome', url];
  } else {
    cmd = 'google-chrome';
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    // Silently swallow errors (chrome not in PATH, etc.) — server keeps running,
    // Petr can just open the URL manually.
    child.on('error', () => {
      console.log(`  (Could not auto-open Chrome — open ${url} manually)`);
    });
    child.unref();
  } catch (e) {
    console.log(`  (Could not auto-open Chrome — open ${url} manually)`);
  }
}

async function startDevServer() {
  const template = readTemplate();
  verifyModules();

  // Generate dev HTML
  if (!fs.existsSync(DEV)) fs.mkdirSync(DEV, { recursive: true });
  const devHtml = generateDevHtml(template);
  const devHtmlPath = path.join(DEV, 'index.html');
  fs.writeFileSync(devHtmlPath, devHtml, 'utf8');
  console.log(`  ✓ Dev HTML generated: dev/index.html`);
  console.log(`  ✓ Modules: ${MODULES.length} <script> tags injected`);

  validateHtmlStructure(template);

  // Check that port 7800 is free — NEVER silently switch to another port,
  // IndexedDB is per-origin and user would lose their library.
  const port = DEV_PORT;
  if (!(await isPortFree(port))) {
    console.error(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.error(`║  ERROR: Port ${port} is already in use.                          ║`);
    console.error(`╚══════════════════════════════════════════════════════════════╝`);
    console.error('');
    console.error(`The dev server MUST run on port ${port} (fixed) because your GIS`);
    console.error(`library is stored in IndexedDB tied to http://localhost:${port}.`);
    console.error(`Running on a different port = losing access to your library.`);
    console.error('');
    console.error('How to fix:');
    console.error(`  1. Find what's using port ${port}:`);
    console.error(`     Windows:  netstat -ano | findstr :${port}`);
    console.error(`     macOS:    lsof -i :${port}`);
    console.error(`  2. Close that program (or its tab/window).`);
    console.error(`  3. Run start_dev.bat again.`);
    console.error('');
    console.error(`If you can't identify the process, restarting your computer`);
    console.error(`will free the port.`);
    process.exit(1);
  }

  // HTTP server
  const server = http.createServer((req, res) => {
    try {
      const parsed = new URL(req.url, `http://localhost:${port}`);
      let urlPath = decodeURIComponent(parsed.pathname);

      // Route: / → dev/index.html
      if (urlPath === '/' || urlPath === '/index.html') {
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Cache-Control': 'no-store',  // Always re-read from disk; dev = no caching
        });
        res.end(fs.readFileSync(devHtmlPath));
        return;
      }

      // Route: /src/* → src/ directory
      if (urlPath.startsWith('/src/')) {
        const relPath = urlPath.slice('/src/'.length);
        const filePath = safeResolve(SRC, '/' + relPath);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found: ' + urlPath);
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(fs.readFileSync(filePath));
        return;
      }

      // Anything else
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
    } catch (err) {
      console.error('Request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('500 Server Error: ' + err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log(`\n  ✓ Dev server running`);
    console.log(`    URL:     ${url}`);
    console.log(`    Serving: /src/* (modules) + /      (dev HTML)`);
    console.log(`    Edit any module → Ctrl+R in Chrome → live change`);
    console.log(`    Press Ctrl+C to stop.`);
    console.log('');
    openChrome(url);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Stopping dev server…');
    server.close(() => process.exit(0));
  });
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════

if (IS_DEV) {
  console.log('GIS — Dev server mode\n');
  startDevServer();
} else {
  console.log(`GIS — Prod build mode (v${VERSION})\n`);
  buildProd();
}
