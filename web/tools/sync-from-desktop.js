#!/usr/bin/env node
/* Rebuilds this web copy from the desktop app's source folder.
   The desktop files are only READ, never written.

     node web/tools/sync-from-desktop.js "C:/path/to/Charactry"

   (Don't upload web/tools/ to Neocities — it's only for you.)

   What it does:
     1. copies index.html, story.html, ai.js, data files, assets/, languages/, plugins/
     2. patches the COPY of index.html/story.html with the web bridge (a handful of
        one-line string replacements — each one is checked and fails loudly if the
        desktop code changed and the patch no longer applies)
     3. regenerates plugins/index.json and languages/index.json
*/
const fs = require('fs'), path = require('path');

const SRC = path.resolve(process.argv[2] || 'C:/Documents/Documents/Charactry/Charactry');
const DST = path.resolve(__dirname, '..', '..');           // …/charactry
if (!fs.existsSync(path.join(SRC, 'index.html'))) { console.error('Not a Charactry source folder:', SRC); process.exit(1); }

fs.rmSync(path.join(DST, 'languages'), { recursive: true, force: true });   // drop languages that no longer exist on desktop
const cp = (rel) => { fs.cpSync(path.join(SRC, rel), path.join(DST, rel), { recursive: true }); };
['ai.js', 'au-data.js', 'charactry-data.js', 'interactive-data.js', 'charactry.ico', 'assets', 'languages', 'plugins'].forEach(cp);
fs.rmSync(path.join(DST, 'languages', 'README.md'), { force: true });

function patch(file, edits) {
  let s = fs.readFileSync(path.join(SRC, file), 'utf8');
  for (const [label, from, to] of edits) {
    if (!s.includes(from)) throw new Error(`[${file}] patch "${label}" no longer matches the desktop source — update sync-from-desktop.js`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(path.join(DST, file), s);
}

patch('index.html', [
  ['viewport / PWA meta',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
    '<meta name="theme-color" content="#0b0b12">\n<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="mobile-web-app-capable" content="yes">\n<link rel="manifest" href="manifest.json">\n' +
    '<link rel="icon" type="image/png" href="assets/charactry_transparent.png">\n' +
    '<link rel="apple-touch-icon" href="assets/charactry_icon.png">'],
  ['bridge after localForage',
    '<script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script>\n<script src="web/bridge.js"></script>'],
  ['web-ui after ai.js', '<script src="ai.js"></script>', '<script src="ai.js"></script>\n<script src="web/web-ui.js"></script>'],
  ['web stylesheet', '</head>', '<link rel="stylesheet" href="web/web.css">\n</head>'],
  ['restore Theme Pack colours on load',
    "  const t = THEME_MAP[settings.themeLabel];\n  if (t) applyTheme(t);",
    "  const t = THEME_MAP[settings.themeLabel];\n  if (t) applyTheme(t);\n  else if (settings.themeLabel === 'Theme Pack' && settings.themePackVars) { const v = settings.themePackVars, r = document.documentElement.style; const m = { '--bg': v.bg, '--bg2': v.bg2, '--bg3': v.bg3, '--sidebar-bg': v.sb, '--card': v.card, '--border': v.border, '--border2': v.border2, '--text': v.text, '--text2': v.text2, '--text3': v.text3, '--accent': v.accent, '--accent2': v.accent2 }; for (const k in m) if (m[k]) r.setProperty(k, m[k]); if (v.accent) r.setProperty('--accent-glow', v.accent + '2e'); if (v.bg) { document.body.style.background = v.bg; const mn = document.getElementById('main'); if (mn) mn.style.background = v.bg; } }"],
  ['license device name', "device_name: 'Charactry Desktop'", "device_name: 'Charactry Web'"],
]);
patch('story.html', [
  ['bridge after localForage',
    '<script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script>\n<script src="web/bridge.js"></script>'],
]);

const plugins = fs.readdirSync(path.join(DST, 'plugins'))
  .filter(d => fs.existsSync(path.join(DST, 'plugins', d, 'manifest.json')))
  .map(d => ({ id: d, files: fs.readdirSync(path.join(DST, 'plugins', d)).sort() }));
fs.writeFileSync(path.join(DST, 'plugins', 'index.json'), JSON.stringify({ plugins }, null, 2));

const langs = fs.readdirSync(path.join(DST, 'languages')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5)).sort();
fs.writeFileSync(path.join(DST, 'languages', 'index.json'), JSON.stringify(langs));

/* the web UI shows this version number (top bar + Settings → About) */
const ver = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(DST, 'web', 'version.json'), JSON.stringify({ version: ver }));

console.log(`Synced from ${SRC}\n  plugins:   ${plugins.map(p => p.id).join(', ')}\n  languages: ${langs.join(', ')}\n  version:   ${ver}`);
