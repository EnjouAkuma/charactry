/* ═══════════════════════════════════════════════════════════════════
   Charactry Web — bridge.js
   Loaded right after localForage and BEFORE the app scripts.

   The desktop app talks to Electron through `window.electronAPI`
   (see preload.js). This file provides the same API on top of browser
   storage so the real app code runs unchanged:

     • characters / brain logs / worldbuilding / lorebooks → IndexedDB
     • plugins  → bundled folders + user-installed .zip files (IndexedDB)
     • AI       → Ollama-style calls are translated to OpenRouter
                  (or any OpenAI-compatible endpoint, or a local Ollama)
     • license  → untouched; index.html talks to license-api directly

   Nothing here touches the desktop app's files.
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ROOT = new URL('../', document.currentScript.src).href;   // …/charactry/
  const disk = localforage.createInstance({ name: 'charactry_web', storeName: 'disk' });
  const WEB  = (window.CharactryWeb = window.CharactryWeb || {});
  WEB.ROOT = ROOT;
  WEB.disk = disk;

  /* ── tiny helpers ─────────────────────────────────────────────── */
  const SAFE_ID   = /^[a-zA-Z0-9_\-]+$/;
  const IMG_EXT   = /\.(png|jpe?g|webp|gif)$/i;
  const mimeOf    = (name) => {
    const e = (name.split('.').pop() || '').toLowerCase();
    return ({ png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif',
              svg:'image/svg+xml', ico:'image/x-icon', css:'text/css', js:'text/javascript',
              json:'application/json', html:'text/html', md:'text/markdown', woff:'font/woff',
              woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf' })[e] || 'application/octet-stream';
  };
  const keysWith = async (prefix) => (await disk.keys()).filter(k => k.startsWith(prefix));
  const fetchText = async (url) => {
    try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.text() : null; }
    catch { return null; }
  };
  const blobToDataURL = (blob) => new Promise((res, rej) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
  });
  WEB.blobToDataURL = blobToDataURL;
  WEB.mimeOf = mimeOf;

  /* Translations for the strings this web layer adds (web/i18n.json).
     Uses the language chosen in Settings, falling back to English. */
  let I18N = {};
  WEB.i18nReady = fetch(ROOT + "web/i18n.json").then(r => r.json()).then(j => { I18N = j; }).catch(() => {});
  WEB.T = function (key, vars) {
    let lang = "en";
    try { lang = (typeof settings !== "undefined" && settings.language) || "en"; } catch {}
    let s = (I18N[lang] && I18N[lang][key]) || (I18N.en && I18N.en[key]) || key;
    if (vars) s = s.replace(/{(w+)}/g, (m, n) => (vars[n] != null ? vars[n] : m));
    return s;
  };
  const T = WEB.T;

  /* ═══════════════════════════════════════════════════════════════
     AI PROVIDER CONFIG
     Kept in its own key (never in `settings`) so it is not swept
     into the normal backup file. API keys stay in this browser only.
  ═══════════════════════════════════════════════════════════════ */
  const AI_DEFAULT = {
    provider:   'openrouter',                    // 'openrouter' | 'custom' | 'ollama'
    model:      '',                              // model id used for every request
    openrouter: { key: '' },
    custom:     { base: '', key: '' },
    ollama:     { url: 'http://localhost:11434' },
  };
  let aiCfg = JSON.parse(JSON.stringify(AI_DEFAULT));
  const aiReady = disk.getItem('ai_provider').then(v => {
    if (v && typeof v === 'object') {
      aiCfg = Object.assign({}, aiCfg, v);
      aiCfg.openrouter = Object.assign({}, AI_DEFAULT.openrouter, v.openrouter);
      aiCfg.custom     = Object.assign({}, AI_DEFAULT.custom,     v.custom);
      aiCfg.ollama     = Object.assign({}, AI_DEFAULT.ollama,     v.ollama);
    }
  }).catch(() => {});
  WEB.ai = {
    ready: aiReady,
    get: () => aiCfg,
    async set(patch) {
      await aiReady;
      aiCfg = Object.assign({}, aiCfg, patch);
      await disk.setItem('ai_provider', aiCfg);
      _modelCache = null;
      return aiCfg;
    },
  };

  const OR_BASE = 'https://openrouter.ai/api/v1';
  function activeBase() {
    if (aiCfg.provider === 'openrouter') return OR_BASE;
    if (aiCfg.provider === 'custom')     return (aiCfg.custom.base || '').replace(/\/+$/, '');
    return '';
  }
  function activeKey() {
    return aiCfg.provider === 'openrouter' ? aiCfg.openrouter.key
         : aiCfg.provider === 'custom'     ? aiCfg.custom.key : '';
  }
  function isConfigured() {
    if (aiCfg.provider === 'openrouter') return !!aiCfg.openrouter.key;
    if (aiCfg.provider === 'custom')     return !!aiCfg.custom.base;
    return true; // ollama: verified by an actual request
  }
  WEB.ai.isConfigured = isConfigured;

  function providerHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const k = activeKey();
    if (k) h['Authorization'] = 'Bearer ' + k;
    if (aiCfg.provider === 'openrouter') {
      h['HTTP-Referer'] = location.origin + location.pathname;
      h['X-Title'] = 'Charactry Web';
    }
    return h;
  }

  const NOT_CONFIGURED = () => T("notConfigured");

  function friendlyError(status, body, fallback) {
    let msg = '';
    try {
      const j = typeof body === 'string' ? JSON.parse(body) : body;
      msg = (j && (j.error?.message || j.error || j.message)) || '';
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
    } catch { /* not JSON */ }
    msg = msg || fallback || T("serverReturned", { status });
    if (status === 401) msg = T("err401") + " " + msg;
    else if (status === 402) msg = T("err402") + " " + msg;
    else if (status === 429) msg = T("err429") + " " + msg;
    return msg;
  }

  /* model list (OpenRouter is public; custom uses <base>/models) */
  let _modelCache = null;
  async function listModels() {
    await aiReady;
    if (_modelCache) return _modelCache;
    let out = [];
    try {
      if (aiCfg.provider === 'ollama') {
        const r = await fetch((aiCfg.ollama.url || AI_DEFAULT.ollama.url).replace(/\/+$/, '') + '/api/tags');
        const j = await r.json();
        out = (j.models || []).map(m => ({ id: m.name, name: m.name, free: true }));
      } else {
        const r = await fetch(activeBase() + '/models', { headers: activeKey() ? { Authorization: 'Bearer ' + activeKey() } : {} });
        const j = await r.json();
        out = (j.data || []).map(m => ({
          id: m.id,
          name: m.name || m.id,
          ctx: m.context_length,
          free: aiCfg.provider === 'openrouter'
            ? (/:free$/.test(m.id) || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0))
            : false,
        }));
      }
    } catch { out = []; }
    out.sort((a, b) => (b.free - a.free) || a.name.localeCompare(b.name));
    if (out.length) _modelCache = out;
    return out;
  }
  WEB.ai.listModels = listModels;

  /* Which model string to send. The app's stock default ("mistral") and
     the other Ollama presets mean nothing to OpenRouter, so the model
     chosen in AI Studio → Setup always wins. */
  function resolveModel(requested) {
    if (aiCfg.provider === 'ollama') return requested || aiCfg.model || 'mistral';
    if (aiCfg.model) return aiCfg.model;
    if (requested && requested.includes('/')) return requested;
    return '';
  }

  /* One chat-completions request, Ollama args in → provider Response out */
  async function providerChat({ model, messages, stream, stop, options, signal }) {
    await aiReady;
    if (!isConfigured()) {
      return new Response(JSON.stringify({ error: NOT_CONFIGURED() }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    const m = resolveModel(model);
    if (!m) {
      return new Response(JSON.stringify({ error: T("noModel") }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const body = { model: m, messages, stream: !!stream };
    if (options?.num_predict > 0)         body.max_tokens = options.num_predict;
    if (options?.temperature != null)     body.temperature = options.temperature;
    if (options?.top_p != null)           body.top_p = options.top_p;
    const stops = (stop || []).filter(s => s && s.trim().length).slice(0, 4);
    if (stops.length) body.stop = stops;

    let resp;
    try {
      resp = await fetch(activeBase() + '/chat/completions', {
        method: 'POST', headers: providerHeaders(), body: JSON.stringify(body), signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return new Response(JSON.stringify({ error: T("cantReach", { msg: e.message }) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: friendlyError(resp.status, txt) }),
        { status: resp.status, headers: { 'Content-Type': 'application/json' } });
    }
    return resp;
  }

  /* OpenAI SSE stream → Ollama NDJSON stream */
  function sseToNdjson(resp, kind) {
    const reader = resp.body.getReader();
    const dec = new TextDecoder(), enc = new TextEncoder();
    let buf = '', finished = false;
    const tokLine = (t) => JSON.stringify(kind === 'chat'
      ? { message: { role: 'assistant', content: t }, done: false }
      : { response: t, done: false }) + '\n';
    const doneLine = () => JSON.stringify(kind === 'chat'
      ? { message: { role: 'assistant', content: '' }, done: true }
      : { response: '', done: true }) + '\n';
    return new Response(new ReadableStream({
      async pull(ctrl) {
        const { done, value } = await reader.read();
        if (done) {
          if (!finished) ctrl.enqueue(enc.encode(doneLine()));
          ctrl.close(); return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        let out = '';
        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data:')) continue;         // also skips ": OPENROUTER PROCESSING"
          const d = line.slice(5).trim();
          if (d === '[DONE]') { if (!finished) { out += doneLine(); finished = true; } continue; }
          try {
            const j = JSON.parse(d);
            if (j.error) { out += JSON.stringify({ error: j.error.message || 'stream error' }) + '\n'; continue; }
            const tok = j.choices?.[0]?.delta?.content;
            if (tok) out += tokLine(tok);
          } catch { /* partial JSON */ }
        }
        if (out) ctrl.enqueue(enc.encode(out));
      },
      cancel() { try { reader.cancel(); } catch {} },
    }), { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
  }

  const jsonResp = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

  /* The fetch shim: ai.js hard-codes http://localhost:11434 in several
     places (chat, lore forge, scene engine…). Everything aimed there is
     redirected according to the chosen provider. */
  const OLLAMA_ORIGIN = 'http://localhost:11434';
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.startsWith(OLLAMA_ORIGIN)) return ollamaShim(url.slice(OLLAMA_ORIGIN.length) || '/', init || {});
    return _fetch(input, init);
  };
  WEB.rawFetch = _fetch;

  async function ollamaShim(path, init) {
    await aiReady;
    if (aiCfg.provider === 'ollama') {
      const base = (aiCfg.ollama.url || AI_DEFAULT.ollama.url).replace(/\/+$/, '');
      return _fetch(base + path, init);
    }
    const p = path.split('?')[0];
    if (p === '/' || p === '') {
      return isConfigured() ? new Response('AI ready', { status: 200 }) : new Response(NOT_CONFIGURED(), { status: 503 });
    }
    if (p === '/api/tags') {
      const models = await listModels();
      return jsonResp({ models: models.map(m => ({ name: m.id })) });
    }
    let body = {};
    try { body = JSON.parse(init.body || '{}'); } catch {}
    const stream = body.stream !== false;
    if (p === '/api/generate') {
      const messages = [{ role: 'user', content: String(body.prompt || '') }];
      const resp = await providerChat({ model: body.model, messages, stream, stop: body.stop, options: body.options, signal: init.signal });
      if (!resp.ok) return resp;
      if (stream) return sseToNdjson(resp, 'generate');
      const j = await resp.json();
      return jsonResp({ response: j.choices?.[0]?.message?.content || '', done: true });
    }
    if (p === '/api/chat') {
      const messages = (body.messages || []).map(m => ({
        role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
        content: String(m.content ?? ''),
      }));
      const resp = await providerChat({ model: body.model, messages, stream, stop: body.stop, options: body.options, signal: init.signal });
      if (!resp.ok) return resp;
      if (stream) return sseToNdjson(resp, 'chat');
      const j = await resp.json();
      return jsonResp({ message: { role: 'assistant', content: j.choices?.[0]?.message?.content || '' }, done: true });
    }
    return jsonResp({ error: 'Unsupported endpoint ' + p }, 404);
  }

  /* electronAPI.ollama* — same shapes as main.js returns */
  const tokenListeners = new Set();
  async function apiGenerate(model, prompt) {
    try {
      const r = await ollamaShim('/api/generate', { body: JSON.stringify({ model, prompt, stream: false }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, status: r.status, error: j.error || T("serverReturned", { status: r.status }) };
      return { ok: true, response: j.response || '' };
    } catch (e) { return { ok: false, error: e.message }; }
  }
  async function apiGenerateStream(model, prompt) {
    try {
      const r = await ollamaShim('/api/generate', { body: JSON.stringify({ model, prompt, stream: true }) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return { ok: false, status: r.status, error: j.error || T("serverReturned", { status: r.status }) };
      }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let full = '', buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const o = JSON.parse(line);
            if (o.error) return { ok: false, error: o.error };
            if (o.response) { full += o.response; tokenListeners.forEach(cb => { try { cb(o.response, full); } catch {} }); }
          } catch {}
        }
      }
      return { ok: true, full };
    } catch (e) { return { ok: false, error: e.message }; }
  }
  async function apiCheck() {
    await aiReady;
    if (aiCfg.provider === 'ollama') {
      try { const r = await _fetch((aiCfg.ollama.url || AI_DEFAULT.ollama.url).replace(/\/+$/, '') + '/', { signal: AbortSignal.timeout(3000) }); return r.status < 500; }
      catch { return false; }
    }
    return isConfigured();
  }
  async function apiListModels() {
    const m = await listModels();
    return aiCfg.provider === 'openrouter' ? m.filter(x => x.free).slice(0, 40).map(x => x.id) : m.map(x => x.id);
  }

  /* ═══════════════════════════════════════════════════════════════
     OPENROUTER "CONNECT" (OAuth PKCE — no server needed)
  ═══════════════════════════════════════════════════════════════ */
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  WEB.startOpenRouterConnect = async function () {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    try { localStorage.setItem('charactry_or_verifier', verifier); } catch {}
    const cb = location.origin + location.pathname;
    location.href = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(cb) +
      '&code_challenge=' + challenge + '&code_challenge_method=S256';
  };
  (async function finishOpenRouterConnect() {
    const qs = new URLSearchParams(location.search);
    const code = qs.get('code');
    let verifier = null;
    try { verifier = localStorage.getItem('charactry_or_verifier'); } catch {}
    if (!code || !verifier) return;
    history.replaceState(null, '', location.pathname);           // hide the code
    try { localStorage.removeItem('charactry_or_verifier'); } catch {}
    try {
      const r = await _fetch(OR_BASE + '/auth/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
      });
      const j = await r.json();
      if (!r.ok || !j.key) throw new Error(j.error?.message || j.error || ('HTTP ' + r.status));
      await WEB.ai.set({ provider: 'openrouter', openrouter: { key: j.key } });
      WEB.pendingNotice = { type: 'success', msg: () => T("oauthOk"), goto: 'aistudio' };
    } catch (e) {
      WEB.pendingNotice = { type: 'error', msg: () => T("oauthFail", { msg: e.message }), goto: 'aistudio' };
    }
  })();

  /* ═══════════════════════════════════════════════════════════════
     PLUGINS — bundled folders + user-installed zips
  ═══════════════════════════════════════════════════════════════ */
  let _bundled = null;
  async function bundledIndex() {
    if (_bundled) return _bundled;
    try { _bundled = (await (await fetch(ROOT + 'plugins/index.json', { cache: 'no-cache' })).json()).plugins || []; }
    catch { _bundled = []; }
    return _bundled;
  }
  WEB.isBundledPlugin = async (id) => (await bundledIndex()).some(p => p.id === id);

  const _manifestText = {};
  async function apiListPlugins() {
    const out = [];
    for (const p of await bundledIndex()) {
      const txt = _manifestText[p.id] || (_manifestText[p.id] = await fetchText(ROOT + `plugins/${p.id}/manifest.json`));
      if (!txt) continue;
      let manifest; try { manifest = JSON.parse(txt); } catch { continue; }
      const meta = (await disk.getItem('pluginmeta:' + p.id)) || {};
      out.push({ id: p.id, manifest: Object.assign(manifest, meta), hasLorebook: p.files.includes('lorebook.json'), bundled: true });
    }
    for (const k of await keysWith('plugin:')) {
      const item = await disk.getItem(k);
      if (!item || !item.manifest) continue;
      out.push({ id: k.slice(7), manifest: item.manifest, hasLorebook: !!item.files['lorebook.json'], bundled: false });
    }
    return out;
  }
  async function apiReadPluginFile(id, filename) {
    if (!SAFE_ID.test(id)) return null;
    if (!/^[a-zA-Z0-9_\-]+\.(json|js|md|html|css|svg)$/.test(filename)) return null;
    const item = await disk.getItem('plugin:' + id);
    if (item) { const f = item.files[filename]; return f && f.t === 'text' ? f.v : null; }
    return fetchText(ROOT + `plugins/${id}/${filename}`);
  }
  async function apiSavePluginManifest(id, manifest) {
    if (!SAFE_ID.test(id)) return false;
    const item = await disk.getItem('plugin:' + id);
    if (item) { item.manifest = manifest; await disk.setItem('plugin:' + id, item); return true; }
    if (!(await WEB.isBundledPlugin(id))) return false;
    await disk.setItem('pluginmeta:' + id, { enabled: manifest.enabled !== false });
    return true;
  }
  WEB.removePlugin = async (id) => { await disk.removeItem('plugin:' + id); };

  /* Build the srcdoc for a plugin iframe. The iframe is same-origin, so it
     shares IndexedDB with the app exactly like a desktop plugin window
     shares it with the main window. */
  const SHIM = '<script>try{window.electronAPI=parent.electronAPI;window.opener=parent;}catch(e){}<\/script>' +
    /* phone layout for plugin pages: stack the side pane above the content */
    '<style id="web-plugin-mobile">@media(max-width:700px){' +
      'html,body{overflow:auto!important;height:auto!important;min-height:100%}#root{height:auto!important;min-height:100vh}' +
      '#body{flex-direction:column!important;overflow:visible!important}' +
      '#char-sidebar,#style-sidebar,#history-panel,#template-list-pane,#body>#sidebar,#body>aside{width:auto!important;max-height:38vh;border-right:0!important;border-left:0!important;border-bottom:1px solid var(--border)}' +
      '#main,#preview-panel,#detail-pane{overflow:visible!important;min-height:60vh}' +
      '#main-grid{grid-template-columns:1fr!important}#stat-row{grid-template-columns:repeat(2,1fr)!important}' +
      'input,select,textarea{font-size:16px!important}' +
    '}</style>';
  async function buildPluginDoc(id) {
    const item = await disk.getItem('plugin:' + id);
    let html, base = '';
    if (item) {
      const f = item.files['index.html'];
      if (!f || f.t !== 'text') return null;
      // Rewrite relative src/href to blob: URLs made from the stored files
      const blobs = {};
      for (const [name, file] of Object.entries(item.files)) {
        const blob = file.t === 'text' ? new Blob([file.v], { type: mimeOf(name) })
          : new Blob([Uint8Array.from(atob(file.v), c => c.charCodeAt(0))], { type: mimeOf(name) });
        blobs[name] = URL.createObjectURL(blob);
      }
      html = f.v.replace(/(\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi, (m, pre, q, val) => {
        if (/^(?:[a-z][a-z0-9+.\-]*:|\/\/|#)/i.test(val)) return m;
        const clean = val.replace(/^\.\//, '').split(/[?#]/)[0];
        return blobs[clean] ? `${pre}${q}${blobs[clean]}${q}` : m;
      });
    } else {
      html = await fetchText(ROOT + `plugins/${id}/index.html`);
      if (!html) return null;
      base = `<base href="${ROOT}plugins/${id}/">`;
    }
    const inject = base + SHIM;
    return /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => m + inject)
      : inject + html;
  }

  let _host = null;
  async function apiOpenPluginWindow(id, manifest) {
    if (!SAFE_ID.test(id)) return false;
    const doc = await buildPluginDoc(id);
    if (!doc) return false;
    closePluginHost(false);
    const w = Math.min(manifest.windowWidth || 900, 1500), h = Math.min(manifest.windowHeight || 650, 1000);
    const host = document.createElement('div');
    host.id = 'web-plugin-host';
    host.innerHTML =
      `<div class="wph-win" style="--wph-w:${w}px;--wph-h:${h}px" role="dialog" aria-label="${(manifest.name || id).replace(/"/g, '&quot;')}">
         <div class="wph-bar"><span class="wph-title"></span>
           <button class="wph-close" aria-label="${T('closePlugin')}" title="${T('closePlugin')} (Esc)">✕</button></div>
         <iframe class="wph-frame" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
       </div>`;
    host.querySelector('.wph-title').textContent = manifest.name || id;
    host.querySelector('.wph-frame').srcdoc = doc;
    host.addEventListener('mousedown', (e) => { if (e.target === host) closePluginHost(true); });
    host.querySelector('.wph-close').onclick = () => closePluginHost(true);
    document.body.appendChild(host);
    document.body.classList.add('web-plugin-open');
    _host = host;
    return true;
  }
  async function syncFromStorage() {
    /* Plugins (e.g. Smart Tags, Templates) write straight to IndexedDB. Pull
       those changes into the app's in-memory arrays so the next saveData()
       doesn't overwrite them with stale copies. */
    try {
      let changed = false;
      const pull = async (key, get, set) => {
        const v = await localforage.getItem(key);
        if (v && JSON.stringify(v) !== JSON.stringify(get())) { set(v); changed = true; }
      };
      /* eslint-disable no-undef */
      await pull('charactry_chars',   () => characters, v => { characters = v; });
      await pull('charactry_folders', () => folders,    v => { folders    = v; });
      await pull('charactry_lore',    () => loreNotes,  v => { loreNotes  = v; });
      if (changed && typeof renderPage === 'function' && typeof currentPage !== 'undefined') renderPage(currentPage);
    } catch { /* app not ready — nothing to sync */ }
  }
  function closePluginHost(sync) {
    if (!_host) return;
    _host.remove(); _host = null;
    document.body.classList.remove('web-plugin-open');
    if (sync) syncFromStorage();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _host) closePluginHost(true); });

  /* ═══════════════════════════════════════════════════════════════
     window.electronAPI
  ═══════════════════════════════════════════════════════════════ */
  const strip = (d) => { const s = Object.assign({}, d); delete s.avatar; delete s.banner; return s; };
  const lorebookId = (x) => SAFE_ID.test(x);

  window.electronAPI = {
    isWeb: true,

    /* menu — the desktop menu bar doesn't exist in the browser */
    onMenuAction: () => {},
    setMenuLang:  () => {},

    /* character sprites & files (stored as data URLs) */
    listSprites: async (charId) => {
      const p = `cf:${charId}:`;
      return (await keysWith(p)).map(k => k.slice(p.length)).filter(n => IMG_EXT.test(n));
    },
    readSprite:    async (charId, file) => (await disk.getItem(`cf:${charId}:${file}`)) || null,
    openSpriteDir: async (charId) => { if (WEB.openSpriteManager) WEB.openSpriteManager(charId); return true; },

    ensureCharDir: async () => 'browser-storage',
    saveCharJSON:  async (id, data) => { await disk.setItem('char:' + id, strip(data)); return true; },
    readCharJSON:  async (id) => (await disk.getItem('char:' + id)) || null,
    readCharFile: async (id, file) => {
      if (!/^[a-zA-Z0-9_\-]+\.(png|jpg|webp|gif|json)$/i.test(file)) return null;
      if (file.endsWith('.json')) { const d = await disk.getItem('char:' + id); return d ? JSON.stringify(d, null, 2) : null; }
      return (await disk.getItem(`cf:${id}:${file}`)) || null;
    },
    saveCharAvatar: async (id, url) => { if (!url || !url.startsWith('data:')) return false; await disk.setItem(`cf:${id}:avatar.png`, url); return true; },
    saveCharBanner: async (id, url) => { if (!url || !url.startsWith('data:')) return false; await disk.setItem(`cf:${id}:banner.png`, url); return true; },
    readCharImage:  async (id, file) => IMG_EXT.test(file) ? ((await disk.getItem(`cf:${id}:${file}`)) || null) : null,
    readCBIcon:     async (id) => (await disk.getItem(`cf:${id}:CB_icon.png`)) || null,
    listAllChars:   async () => (await keysWith('char:')).map(k => k.slice(5)),

    /* Character Brain conversation logs */
    saveBrainLog:   async (id, log) => { await disk.setItem(`brain:${id}:${log.id}`, log); return true; },
    loadBrainLog: async (id) => {
      const out = [];
      for (const k of await keysWith(`brain:${id}:`)) { const v = await disk.getItem(k); if (v) out.push(v); }
      return out.sort((a, b) => b.created - a.created);
    },
    listBrainLogs: async (id) => {
      const out = [];
      for (const k of await keysWith(`brain:${id}:`)) {
        const l = await disk.getItem(k);
        if (l) out.push({ id: l.id, title: l.title || 'Untitled Session', created: l.created, msgCount: (l.messages || []).length });
      }
      return out.sort((a, b) => b.created - a.created);
    },
    deleteBrainLog: async (id, sess) => { await disk.removeItem(`brain:${id}:${sess}`); return true; },

    /* worldbuilding mirror */
    wbSave:    async (col, data) => { await disk.setItem('wb:' + col, data); return true; },
    wbLoad:    async (col) => (await disk.getItem('wb:' + col)) || null,
    wbOpenDir: async () => {},

    /* plugins */
    listPlugins:        apiListPlugins,
    readPluginFile:     apiReadPluginFile,
    savePluginManifest: apiSavePluginManifest,
    openPluginsDir:     async () => { if (WEB.pickPluginZip) WEB.pickPluginZip(); return 'Browser storage (this device)'; },
    openPluginWindow:   apiOpenPluginWindow,

    /* theme (used by theme-pack style plugins) */
    applyTheme: async (vars) => {
      if (!vars || typeof vars !== 'object') return false;
      for (const [k, v] of Object.entries(vars)) {
        if (/^--[a-zA-Z0-9\-]+$/.test(k) && typeof v === 'string' && v.length < 80)
          document.documentElement.style.setProperty(k, v.replace(/[`\\$'"]/g, ''));
      }
      return true;
    },

    /* lorebooks */
    listLorebooks: async () => {
      const out = [];
      for (const k of await keysWith('lb:')) { const v = await disk.getItem(k); if (v) { if (!v.id) v.id = k.slice(3); out.push(v); } }
      return out;
    },
    readLorebook:     async (id) => lorebookId(id) ? ((await disk.getItem('lb:' + id)) || null) : null,
    saveLorebook:     async (id, data) => { if (!lorebookId(id)) return false; await disk.setItem('lb:' + id, data); return true; },
    deleteLorebook:   async (id) => { if (!lorebookId(id)) return false; await disk.removeItem('lb:' + id); return true; },
    openLorebooksDir: async () => {},

    /* static assets, presets, languages */
    readAsset: async (filename) => {
      if (!/^[a-zA-Z0-9_\-]+\.(png|jpg|webp|gif|ico|svg)$/i.test(filename)) return null;
      try { const r = await fetch(ROOT + 'assets/' + filename); return r.ok ? await blobToDataURL(await r.blob()) : null; }
      catch { return null; }
    },
    readPresetsFile: async (f) => /^[a-zA-Z0-9_\-]+\.json$/i.test(f) ? fetchText(ROOT + 'presets/' + f) : null,
    readLangFile: async (code) => {
      if (!SAFE_ID.test(code)) return null;
      await WEB.i18nReady;
      const txt = await fetchText(ROOT + "languages/" + code + ".json");
      if (!txt) return null;
      try {                       // make sure every language can label the Cantonese option
        const j = JSON.parse(txt);
        if (j.languageOptions && !j.languageOptions.yue) { j.languageOptions.yue = "🇭🇰 粵語 (YUE)"; return JSON.stringify(j); }
      } catch {}
      return txt;
    },
    listLangFiles: async () => {
      try { return await (await fetch(ROOT + 'languages/index.json', { cache: 'no-cache' })).json(); } catch { return ['en']; }
    },
    setAppIcon: async (isPLUS) => {
      const href = ROOT + 'assets/' + (isPLUS ? 'charactryplus_transparent.png' : 'charactry_transparent.png');
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.type = 'image/png'; link.href = href;
      document.title = isPLUS ? 'Charactry PLUS — Personal OC Archive & Management' : 'Charactry — Personal OC Archive';
      return true;
    },
    resetDisk: async () => {
      for (const k of await disk.keys()) {
        if (/^(char:|cf:|brain:|wb:|lb:)/.test(k)) await disk.removeItem(k);   // keep plugins + AI connection
      }
      return true;
    },
    getUserDataPath: async () => 'Browser storage (this device)',
    getExePath:      async () => '',

    /* AI — Ollama-shaped API, backed by the chosen provider */
    ollamaGenerate:       apiGenerate,
    ollamaGenerateStream: apiGenerateStream,
    ollamaCheck:          apiCheck,
    ollamaListModels:     apiListModels,
    onOllamaToken:        (cb) => { tokenListeners.add(cb); },
    offOllamaToken:       (cb) => { tokenListeners.delete(cb); },
  };

  /* License safety net. The app keeps the license key, its validation time
     and this browser's device ID inside `settings`. If that object is ever
     saved without them (a stale copy, a partial write, storage hiccup), the
     license would silently vanish — and a fresh device ID would burn one of
     the two device slots. So keep a second copy in localStorage and merge it
     back whenever settings are read without a license. Deactivating (which
     sets plusActivated=false) and "Reset everything" clear the copy. */
  const LIC_KEY = 'charactry_license_backup', DEV_KEY = 'charactry_device_id';
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch {} };
  /* localForage re-wraps its own methods when its storage driver finishes
     starting, which would silently undo overrides made too early. So the
     patches are (re)applied now AND once more when ready() resolves. */
  function patchLocalforage() {
    if (!localforage.setItem.__web) {
      const orig = localforage.setItem.bind(localforage);
      const f = function (key, value, ...rest) {
        if (key === "charactry_settings" && value && typeof value === "object") {
          if (value.plusDeviceId) lsSet(DEV_KEY, value.plusDeviceId);
          if (value.serialCode) {
            lsSet(LIC_KEY, { serialCode: value.serialCode, plusActivated: true, plusValidatedAt: value.plusValidatedAt || 0, plusActivationLimit: value.plusActivationLimit });
          } else if (value.plusActivated === false) {
            lsDel(LIC_KEY);
          }
        }
        return orig(key, value, ...rest);
      };
      f.__web = true; localforage.setItem = f;
    }
    if (!localforage.getItem.__web) {
      const orig = localforage.getItem.bind(localforage);
      const f = function (key, ...rest) {
        const p = orig(key, ...rest);
        if (key !== "charactry_settings") return p;
        return p.then((v) => {
          if (v && typeof v === "object") {        // protect licenses saved before this safety net existed
            if (v.plusDeviceId && !lsGet(DEV_KEY)) lsSet(DEV_KEY, v.plusDeviceId);
            if (v.serialCode && !lsGet(LIC_KEY)) lsSet(LIC_KEY, { serialCode: v.serialCode, plusActivated: true, plusValidatedAt: v.plusValidatedAt || 0, plusActivationLimit: v.plusActivationLimit });
          }
          const lic = lsGet(LIC_KEY), dev = lsGet(DEV_KEY);
          if (!lic && !dev) return v;
          const st = (v && typeof v === "object") ? v : {};
          let out = st, changed = false;
          if (lic && !st.serialCode) { out = Object.assign({}, out, lic); changed = true; }
          if (dev && !st.plusDeviceId) { out = Object.assign({}, out, { plusDeviceId: dev }); changed = true; }
          return changed ? out : v;
        });
      };
      f.__web = true; localforage.getItem = f;
    }
    /* "Reset everything" calls localforage.clear(): also drop the license copy
       and the mirrored characters so deleted characters aren't "recovered".
       (The device id is kept on purpose: same browser = same device.) */
    if (!localforage.clear.__web) {
      const orig = localforage.clear.bind(localforage);
      const f = function () {
        lsDel(LIC_KEY);
        return orig().then(() => window.electronAPI.resetDisk()).catch((e) => { console.warn("clear", e); });
      };
      f.__web = true; localforage.clear = f;
    }
  }
  patchLocalforage();
  localforage.ready().then(patchLocalforage).catch(() => {});

  /* Ask the browser not to evict our data under storage pressure. */
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
})();
