#!/usr/bin/env node
/**
 * GIS Build Script
 * Usage: node build.js [version]
 * Example: node build.js 90en  →  dist/gis_v90en.html
 *
 * Reads src/template.html + all src/*.js modules in declared order,
 * injects concatenated JS into the // __GIS_JS__ placeholder,
 * writes dist/gis_vXXen.html
 */

const fs   = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────
const VERSION  = process.argv[2] || '90en';
const SRC      = path.join(__dirname, 'src');
const DIST     = path.join(__dirname, 'dist');
const TEMPLATE = path.join(SRC, 'template.html');
const OUT_FILE = path.join(DIST, `gis_v${VERSION}.html`);
const JS_MARKER = '// __GIS_JS__';

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
  'video.js',   // NEW
];

// ── Build ─────────────────────────────────────────────────────────────────
function build() {
  // Verify template exists
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`ERROR: template not found: ${TEMPLATE}`);
    process.exit(1);
  }

  // Read template
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (!template.includes(JS_MARKER)) {
    console.error(`ERROR: JS_MARKER "${JS_MARKER}" not found in template.html`);
    process.exit(1);
  }

  // Concatenate modules
  const parts = [];
  let totalLines = 0;
  for (const mod of MODULES) {
    const modPath = path.join(SRC, mod);
    if (!fs.existsSync(modPath)) {
      console.error(`ERROR: module not found: ${modPath}`);
      process.exit(1);
    }
    const src = fs.readFileSync(modPath, 'utf8');
    const lines = src.split('\n').length;
    totalLines += lines;
    parts.push(src);
    console.log(`  ✓ ${mod.padEnd(28)} ${String(lines).padStart(5)} lines`);
  }

  const js = parts.join('').replace(/\n$/, ''); // strip extra trailing newline

  // Inject into template
  const html = template.replace(JS_MARKER, js);

  // Write output
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  const outLines = html.split('\n').length;
  console.log(`\n  ✓ Built: dist/gis_v${VERSION}.html`);
  console.log(`    JS: ${totalLines} lines across ${MODULES.length} modules`);
  console.log(`    Total output: ${outLines} lines`);
}

build();
