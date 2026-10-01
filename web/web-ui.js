/* ═══════════════════════════════════════════════════════════════════
   Charactry Web — web-ui.js
   Loaded AFTER ai.js. Wraps a few app functions (by re-assigning the
   global function names) to add what a browser needs and a desktop
   doesn't: mobile navigation, AI provider setup, plugin .zip install,
   sprite upload, backup/restore. The app's own code is not edited.
   All text goes through T() → web/i18n.json (10 languages).
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const WEB  = window.CharactryWeb;
  const disk = WEB.disk;
  const T    = WEB.T;
  const esc  = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $    = (sel, root = document) => root.querySelector(sel);
  const say  = (msg, type, ms) => { try { toast(msg, type || 'success', ms || 3000); } catch { console.log(msg); } };

  /* ═══════════ 1. MOBILE / TABLET SHELL ═══════════ */
  function initShell() {
    const left = $('#topbar-left');
    if (left && !$('#web-menu-btn')) {
      const b = document.createElement('button');
      b.id = 'web-menu-btn'; b.type = 'button'; b.setAttribute('aria-label', T('menuOpen'));
      b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      left.insertBefore(b, left.firstChild);
      b.onclick = () => document.body.classList.toggle('web-nav-open');
    }
    if (!$('#web-nav-backdrop')) {
      const d = document.createElement('div');
      d.id = 'web-nav-backdrop';
      d.onclick = () => document.body.classList.remove('web-nav-open');
      document.body.appendChild(d);
    }
    const sb = $('#sidebar');
    if (sb) sb.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-btn') && !e.target.closest('#uni-sidebar-list .uni-sb-toggle'))
        document.body.classList.remove('web-nav-open');
    });
    window.addEventListener('resize', () => { if (innerWidth > 900) document.body.classList.remove('web-nav-open'); });
  }

  /* ═══════════ 2. AI STUDIO — provider setup ═══════════ */
  const origAISetup = window.renderAISetupTab;
  window.renderAISetupTab = function () {
    if (typeof origAISetup === 'function') origAISetup();
    const cont = $('#ai-tab-content');
    if (!cont) return;
    // Drop the two Ollama-specific cards; keep streaming toggle + test card.
    const cards = cont.querySelectorAll(':scope > .card');
    if (cards[0]) cards[0].remove();
    if (cards[1]) cards[1].remove();
    cont.insertAdjacentHTML('afterbegin', '<div id="web-ai-conn"></div><div id="web-ai-model"></div>');
    webRenderAIConn();
    webRenderAIModel();
    const lbl = $('#ai-active-model-label');
    if (lbl) lbl.textContent = WEB.ai.get().model || T('noneChosen');
  };

  const CARD_TITLE = "font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:14px";
  const LBL = 'font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin:14px 0 8px';
  const LBL0 = LBL.replace('margin:14px 0 8px', 'margin:0 0 6px');

  function webRenderAIConn() {
    const el = $('#web-ai-conn'); if (!el) return;
    const c = WEB.ai.get(), p = c.provider;
    const opt = (v, t) => `<option value="${v}" ${p === v ? 'selected' : ''}>${esc(t)}</option>`;
    let body = '';
    if (p === 'openrouter') {
      const has = !!c.openrouter.key;
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">${T('orIntro')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${has
            ? `<span style="font-size:12px;color:var(--success);font-weight:700">${esc(T('connected'))}</span>
               <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.disconnect()">${esc(T('disconnect'))}</button>`
            : `<button class="btn btn-primary" style="font-size:12px;padding:8px 18px" onclick="CharactryWeb.startOpenRouterConnect()">${esc(T('connectBtn'))}</button>
               <a class="btn btn-ghost" style="font-size:12px;padding:6px 14px;text-decoration:none" target="_blank" rel="noopener" href="https://openrouter.ai/keys">${esc(T('getKey'))}</a>`}
        </div>
        ${has ? '' : `
        <div style="${LBL}">${esc(T('pasteKey'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-or-key" type="password" autocomplete="off" placeholder="sk-or-v1-…" style="flex:1;min-width:200px;max-width:360px">
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.saveKey()">${esc(T('saveKey'))}</button>
        </div>`}
        <div style="margin-top:12px;font-size:11px;color:var(--text3);line-height:1.6">${esc(T('orNote'))}</div>`;
    } else if (p === 'custom') {
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">${T('customIntro')}</div>
        <div style="${LBL0}">${esc(T('baseUrl'))}</div>
        <input class="form-input" id="web-cu-base" placeholder="https://api.groq.com/openai/v1" value="${esc(c.custom.base)}" style="max-width:420px">
        <div style="${LBL}">${esc(T('keyOptional'))}</div>
        <input class="form-input" id="web-cu-key" type="password" autocomplete="off" value="${esc(c.custom.key)}" style="max-width:420px">
        <div style="margin-top:12px"><button class="btn btn-primary" style="font-size:12px;padding:6px 16px" onclick="WebAI.saveCustom()">${esc(T('save'))}</button></div>`;
    } else {
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">
          ${T('ollamaIntro', { origin: esc(location.origin) })}
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0;font-family:monospace;font-size:11px;overflow-x:auto">
            Windows (PowerShell): $env:OLLAMA_ORIGINS="${esc(location.origin)}"; ollama serve<br>
            macOS / Linux: OLLAMA_ORIGINS=${esc(location.origin)} ollama serve</div>
          ${esc(T('ollamaNote'))}
        </div>
        <div style="${LBL0}">${esc(T('ollamaAddr'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-ol-url" value="${esc(c.ollama.url)}" style="flex:1;min-width:200px;max-width:320px">
          <button class="btn btn-primary" style="font-size:12px;padding:6px 16px" onclick="WebAI.saveOllama()">${esc(T('save'))}</button>
        </div>`;
    }
    el.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <div style="${CARD_TITLE}">${esc(T('aiConnTitle'))}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <select class="form-input" id="web-ai-provider" style="max-width:300px" onchange="WebAI.setProvider(this.value)">
            ${opt('openrouter', T('provOr'))}${opt('custom', T('provCustom'))}${opt('ollama', T('provOllama'))}
          </select>
          <span style="display:flex;align-items:center;gap:8px;margin-left:auto">
            <span class="ai-status-dot checking" id="web-ai-dot"></span>
            <span style="font-size:12px;color:var(--text2)" id="web-ai-status">${esc(T('checking'))}</span>
            <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px" onclick="WebAI.check()">${esc(T('recheck'))}</button>
          </span>
        </div>
        ${body}
      </div>`;
    WebAI.check();
  }

  let modelFilter = '', freeOnly = true;
  async function webRenderAIModel() {
    const el = $('#web-ai-model'); if (!el) return;
    const c = WEB.ai.get();
    el.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <div style="${CARD_TITLE}">${esc(T('modelTitle'))}</div>
        <div style="font-size:13px;margin-bottom:12px">${esc(T('using'))} <b style="color:var(--accent)" id="web-model-now">${esc(c.model || T('noneChosen'))}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <input class="form-input" id="web-model-search" placeholder="${esc(T('searchModels'))}" value="${esc(modelFilter)}" style="flex:1;min-width:180px;max-width:320px" oninput="WebAI.filter(this.value)">
          ${c.provider === 'openrouter' ? `<label style="font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${freeOnly ? 'checked' : ''} onchange="WebAI.freeOnly(this.checked)"> ${esc(T('freeOnly'))}</label>` : ''}
        </div>
        <div id="web-model-list" style="display:flex;flex-wrap:wrap;gap:8px;max-height:260px;overflow-y:auto;padding:2px"></div>
        <div style="${LBL}">${esc(T('typeId'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-model-custom" placeholder="${c.provider === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct:free' : 'model'}" style="flex:1;min-width:200px;max-width:380px">
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.pickCustom()">${esc(T('useThis'))}</button>
        </div>
      </div>`;
    webFillModelList();
  }
  async function webFillModelList() {
    const list = $('#web-model-list'); if (!list) return;
    const note = (k) => `<span style="font-size:12px;color:var(--text3);font-style:italic">${esc(T(k))}</span>`;
    list.innerHTML = note('loadingModels');
    let models = await WEB.ai.listModels();
    const cfg = WEB.ai.get();
    if (!models.length) { list.innerHTML = note('noModelList'); return; }
    if (cfg.provider === 'openrouter' && freeOnly) models = models.filter(m => m.free);
    const q = modelFilter.trim().toLowerCase();
    if (q) models = models.filter(m => (m.id + ' ' + m.name).toLowerCase().includes(q));
    models = models.slice(0, 80);
    list.innerHTML = models.map(m =>
      `<button class="ai-model-chip${cfg.model === m.id ? ' selected' : ''}" data-id="${esc(m.id)}" title="${esc(m.id)}" onclick="WebAI.pick(this.dataset.id)">${esc(m.name.length > 44 ? m.name.slice(0, 43) + '…' : m.name)}${m.free && cfg.provider === 'openrouter' ? ` <span style="font-size:9px;opacity:.7">${esc(T('freeTag'))}</span>` : ''}</button>`
    ).join('') || note('noMatch');
  }

  window.WebAI = {
    async setProvider(v) { await WEB.ai.set({ provider: v }); webRenderAIConn(); webRenderAIModel(); },
    async saveKey() {
      const k = ($('#web-or-key')?.value || '').trim();
      if (!k) return say(T('toastPasteKey'), 'error');
      await WEB.ai.set({ openrouter: { key: k } });
      say(T('toastKeySaved')); webRenderAIConn(); webRenderAIModel();
    },
    async disconnect() {
      if (!confirm(T('confirmRemoveKey'))) return;
      await WEB.ai.set({ openrouter: { key: '' } }); webRenderAIConn();
    },
    async saveCustom() {
      await WEB.ai.set({ custom: { base: ($('#web-cu-base').value || '').trim(), key: ($('#web-cu-key').value || '').trim() } });
      say(T('toastSaved')); webRenderAIConn(); webRenderAIModel();
    },
    async saveOllama() {
      await WEB.ai.set({ ollama: { url: ($('#web-ol-url').value || '').trim() || 'http://localhost:11434' } });
      say(T('toastSaved')); webRenderAIConn(); webRenderAIModel();
    },
    async pick(id) {
      await WEB.ai.set({ model: id });
      settings.ollamaModel = id;                       // keeps the app's own labels in sync
      localforage.setItem('charactry_settings', settings);
      const now = $('#web-model-now'); if (now) now.textContent = id;
      const lbl = $('#ai-active-model-label'); if (lbl) lbl.textContent = id;
      document.querySelectorAll('#web-model-list .ai-model-chip').forEach(b => b.classList.toggle('selected', b.dataset.id === id));
      say(T('toastModelSet', { model: id }));
    },
    pickCustom() {
      const v = ($('#web-model-custom').value || '').trim();
      if (!v) return say(T('toastTypeModel'), 'error');
      WebAI.pick(v);
    },
    filter(v) { modelFilter = v; webFillModelList(); },
    freeOnly(v) { freeOnly = v; webFillModelList(); },
    async check() {
      const dot = $('#web-ai-dot'), txt = $('#web-ai-status'); if (!dot || !txt) return;
      dot.className = 'ai-status-dot checking'; txt.textContent = T('checking');
      const c = WEB.ai.get();
      let ok = false, msg = '';
      try {
        if (c.provider === 'openrouter') {
          if (!c.openrouter.key) msg = T('stNotConnected');
          else {
            const r = await WEB.rawFetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: 'Bearer ' + c.openrouter.key } });
            ok = r.ok; msg = ok ? T('stOrOk') : (r.status === 401 ? T('stKeyRejected') : T('stOrErr', { status: r.status }));
          }
        } else if (c.provider === 'custom') {
          if (!c.custom.base) msg = T('stEnterBase');
          else { const m = await WEB.ai.listModels(); ok = m.length > 0; msg = ok ? T('stEndpointOk') : T('stEndpointNoList'); }
        } else {
          ok = await window.electronAPI.ollamaCheck(); msg = ok ? T('stOllamaOk') : T('stOllamaNo');
        }
      } catch (e) { msg = T('stCantConnect', { msg: e.message }); }
      dot.className = 'ai-status-dot ' + (ok ? 'ok' : 'err'); txt.textContent = msg;
    },
  };

  /* Reword desktop-only AI messages (the app's own strings mention Ollama) */
  const rewriteAI = (m) => typeof m === 'string' && /ollama (is )?not (running|detected)|Ollama is not running/i.test(m) ? T('aiMsg') : m;
  const origToast = window.toast;
  window.toast = function (msg, ...rest) { return origToast.call(this, rewriteAI(msg), ...rest); };
  const origOcfErr = window.ocfErrorHTML;
  if (origOcfErr) window.ocfErrorHTML = (m) => origOcfErr(rewriteAI(m));
  const origAIStudio = window.renderAIStudio;
  window.renderAIStudio = function (pc) {
    origAIStudio(pc);
    const sub = pc.querySelector('.page-subtitle');
    if (sub) sub.textContent = T('aiSubtitle');
  };

  /* ═══════════ 3. PLUGINS — list, .zip install, remove ═══════════ */
  window.renderPluginList = function () {
    if (!installedPlugins.length) {
      return `<div style="font-size:13px;color:var(--text3);padding:14px 0">${esc(T('noPluginsZip'))}</div>`;
    }
    return installedPlugins.map(p => {
      const m = p.manifest, active = m.enabled !== false;
      const tags = (m.tags || []).map(t => `<span style="background:var(--bg3);color:var(--text3);padding:1px 7px;border-radius:20px;font-size:10px">${esc(t)}</span>`).join('');
      const tier = m.plusOnly ? '<span style="font-size:10px;background:#f0c04022;color:#f0c040;padding:1px 7px;border-radius:20px;border:1px solid #f0c04044">PLUS</span>' : '';
      return `<div class="web-plugin-card" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <b style="color:var(--text);font-size:14px">${esc(m.name || p.id)}</b>
            <span style="font-size:10px;color:var(--text3)">v${esc(m.version || '?')}</span>
            ${tier}
            ${m.brainContext ? '<span style="font-size:10px;background:#6688f522;color:#6688f5;padding:1px 7px;border-radius:20px;border:1px solid #6688f544">🧠 Brain</span>' : ''}
            ${p.hasLorebook ? '<span style="font-size:10px;background:#f0c04022;color:#f0c040;padding:1px 7px;border-radius:20px;border:1px solid #f0c04044">📖 Lorebook</span>' : ''}
            ${tags}
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${esc(m.description || '')}</div>
          ${m.author ? `<div style="font-size:11px;color:var(--text3)">by ${esc(m.author)}${p.bundled ? '' : ' · ' + esc(T('fromZip'))}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;color:var(--text2)">
            <div onclick="togglePlugin('${esc(p.id)}')" style="width:36px;height:20px;border-radius:20px;background:${active ? 'var(--accent)' : 'var(--bg3)'};border:1px solid var(--border);cursor:pointer;position:relative;transition:background .2s">
              <div style="position:absolute;top:2px;${active ? 'right' : 'left'}:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>
            </div>${esc(active ? T('enabled') : T('disabled'))}
          </label>
          ${p.bundled ? '' : `<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;color:var(--danger)" onclick="WebPlugins.remove('${esc(p.id)}')">${esc(T('remove'))}</button>`}
        </div>
      </div>`;
    }).join('');
  };
  window.updatePluginPathDisplay = async function () {
    const box = $('#plugin-path-info');
    if (box) box.textContent = T('pathInfo');
  };
  window.openPluginsFolder = () => WEB.pickPluginZip();
  window.openLorebooksFolder = () => {};

  let jszipPromise = null;
  const loadJSZip = () => jszipPromise || (jszipPromise = new Promise((res, rej) => {
    if (window.JSZip) return res(window.JSZip);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => res(window.JSZip); s.onerror = () => { jszipPromise = null; rej(new Error(T('zipLibFail'))); };
    document.head.appendChild(s);
  }));

  /* .rar (v4 and v5) is read by libarchive.js — WebAssembly served from
     web/vendor/libarchive/, so extraction happens in the browser. */
  let rarLib = null;
  async function loadRarLib() {
    if (rarLib) return rarLib;
    try {
      const base = WEB.ROOT + 'web/vendor/libarchive/';
      const mod = await import(base + 'libarchive.js');
      mod.Archive.init({ workerUrl: base + 'worker-bundle.js' });
      rarLib = mod.Archive;
    } catch (e) { console.warn('[web] rar library', e); throw new Error(T('zipLibFail')); }
    return rarLib;
  }
  const bytesToB64 = async (blob) => {
    const u8 = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  /* Format is detected from the first bytes, not the file name.
     → [{ name, string(), base64() }] for every file in the archive */
  async function openArchive(file) {
    const h = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (h[0] === 0x50 && h[1] === 0x4b) {                                   // "PK"   → zip
      const zip = await (await loadJSZip()).loadAsync(file);
      return Object.values(zip.files).filter(f => !f.dir).map(f => ({ name: f.name, string: () => f.async('string'), base64: () => f.async('base64') }));
    }
    if (h[0] === 0x52 && h[1] === 0x61 && h[2] === 0x72 && h[3] === 0x21) { // "Rar!" → rar 4 / 5
      const Archive = await loadRarLib();
      const ar = await Archive.open(file);
      let encrypted = false;
      try { encrypted = await ar.hasEncryptedData(); } catch {}
      if (encrypted) throw new Error(T('errEncrypted'));
      const cache = new Map();
      const get = (cf) => { if (!cache.has(cf)) cache.set(cf, cf.extract()); return cache.get(cf); };
      return (await ar.getFilesArray()).map(({ file: cf, path }) => ({
        name: String(path || '').replace(/\\/g, '/') + cf.name,
        string: async () => (await get(cf)).text(),
        base64: async () => bytesToB64(await get(cf)),
      }));
    }
    throw new Error(T('errArchiveType'));
  }

  const TEXT_EXT = /\.(html?|css|js|json|svg|md|txt)$/i;
  const BIN_EXT  = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i;
  const LIMITS = { files: 300, total: 30 * 1024 * 1024 };

  WEB.pickPluginZip = function () {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.zip,.rar,application/zip,application/vnd.rar,application/x-rar-compressed';
    inp.onchange = () => { if (inp.files[0]) WebPlugins.install(inp.files[0]); };
    inp.click();
  };

  window.WebPlugins = {
    async install(file) {
      try {
        const entries = (await openArchive(file)).filter(f => !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(f.name));
        // Locate manifest.json at the shallowest depth → that folder is the plugin root
        const mf = entries.filter(f => /(^|\/)manifest\.json$/.test(f.name)).sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
        if (!mf) throw new Error(T('errNoManifest'));
        const root = mf.name.slice(0, mf.name.length - 'manifest.json'.length);
        let manifest;
        try { manifest = JSON.parse(await mf.string()); } catch { throw new Error(T('errBadJson')); }
        if (!manifest.name) throw new Error(T('errNeedName'));

        let id = String(manifest.id || root.replace(/\/$/, '').split('/').pop() || manifest.name)
          .toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!id) throw new Error(T('errNoId'));
        if (await WEB.isBundledPlugin(id)) throw new Error(T('errBuiltin', { id }));
        if (installedPlugins.some(p => p.id === id && !p.bundled) && !confirm(T('confirmReplace', { name: manifest.name }))) return;

        const inRoot = entries.filter(f => f.name.startsWith(root));
        if (inRoot.length > LIMITS.files) throw new Error(T('errTooMany'));
        const files = {}; let total = 0, skipped = 0;
        for (const f of inRoot) {
          const rel = f.name.slice(root.length);
          if (!rel || rel.includes('..') || rel.startsWith('/')) { skipped++; continue; }
          if (TEXT_EXT.test(rel)) { const v = await f.string(); total += v.length; files[rel] = { t: 'text', v }; }
          else if (BIN_EXT.test(rel)) { const v = await f.base64(); total += v.length; files[rel] = { t: 'b64', v }; }
          else { skipped++; continue; }
          if (total > LIMITS.total) throw new Error(T('errTooBig'));
        }
        const by = manifest.author ? T('by', { author: manifest.author }) : '';
        if (!confirm(T('confirmInstall', { name: manifest.name, by }))) return;

        manifest.enabled = manifest.enabled !== false;
        await disk.setItem('plugin:' + id, { manifest, files, installedAt: Date.now() });
        await reloadPluginsAndLorebooks();
        say(T('installedOk', { name: manifest.name }) + (skipped ? T('skippedN', { n: skipped }) : ''), 'success', 4000);
      } catch (e) {
        say(T('installFail', { msg: e.message }), 'error', 6000);
      }
    },
    async remove(id) {
      const p = installedPlugins.find(x => x.id === id);
      if (!confirm(T('confirmRemovePlugin', { name: p ? p.manifest.name : id }))) return;
      await WEB.removePlugin(id);
      await reloadPluginsAndLorebooks();
    },
  };

  /* ═══════════ 4. SETTINGS — patch + Web Data card ═══════════ */
  const origSettings = window.renderSettings;
  window.renderSettings = function (pc) {
    origSettings(pc);
    try { patchSettings(pc); } catch (e) { console.warn('[web] settings patch', e); }
  };
  function patchSettings(pc) {
    const inst = pc.querySelector('button[onclick="openPluginsFolder()"]');
    if (inst) { inst.textContent = T('installBtn'); inst.onclick = () => WEB.pickPluginZip(); }
    pc.querySelector('button[onclick="openLorebooksFolder()"]')?.remove();
    // Cantonese isn't in the desktop dropdown — add it
    const sel = pc.querySelector('#settings-language');
    if (sel && !sel.querySelector('option[value="yue"]')) {
      const o = document.createElement('option');
      o.value = 'yue'; o.textContent = '🇭🇰 粵語 (YUE)';
      if ((settings.language || 'en') === 'yue') o.selected = true;
      sel.appendChild(o);
    }
    const sections = pc.querySelectorAll('.settings-section');
    const about = sections[sections.length - 1];
    if (!about) return;
    about.insertAdjacentHTML('beforebegin', `
      <div class="settings-section" id="web-data-section">
        <div class="settings-section-title">${esc(T('webTitle'))}</div>
        <p style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7">${T('webIntro')}</p>
        <div id="web-storage-info" style="font-size:12px;color:var(--text3);margin-bottom:12px">${esc(T('storageChecking'))}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="WebData.backup()">${esc(T('btnBackup'))}</button>
          <button class="btn btn-ghost" onclick="WebData.pickRestore()">${esc(T('btnRestore'))}</button>
          <button class="btn btn-ghost" id="web-persist-btn" onclick="WebData.persist()" style="display:none">${esc(T('btnPersist'))}</button>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">${esc(T('webNote'))}</div>
      </div>
      <div class="divider"></div>`);
    WebData.refreshInfo();
    if (WEB.version) about.insertAdjacentHTML('beforeend', `<div style="font-size:11px;color:var(--text3);margin-top:6px">${esc(T('versionWeb', { v: WEB.version }))}</div>`);
  }

  window.WebData = {
    async refreshInfo() {
      const box = $('#web-storage-info'); if (!box) return;
      try {
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
        const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
        box.textContent = (est ? T('storageUsing', { used: mb(est.usage), quota: mb(est.quota) }) + ' ' : '') +
          (persisted ? T('persistYes') : T('persistNo'));
        const btn = $('#web-persist-btn'); if (btn && !persisted && navigator.storage?.persist) btn.style.display = '';
      } catch { box.textContent = ''; }
    },
    async persist() {
      const ok = await navigator.storage.persist();
      say(ok ? T('persistGranted') : T('persistDeclined'), ok ? 'success' : 'error', 5000);
      WebData.refreshInfo();
    },
    async backup() {
      try {
        const out = { format: 'charactry-web-backup', version: 1, created: new Date().toISOString(), main: {}, disk: {} };
        const blobs = [];
        const grab = (target) => (v, k) => {
          if (k === 'ai_provider' && target === out.disk) return;
          if (v instanceof Blob) blobs.push(WEB.blobToDataURL(v).then(u => { target[k] = { __charactryBlob: u }; }));
          else target[k] = v;
        };
        await localforage.iterate(grab(out.main));
        await disk.iterate(grab(out.disk));
        await Promise.all(blobs);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
        a.download = 'charactry_web_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        say(T('backupDone'));
      } catch (e) { say(T('backupFail', { msg: e.message }), 'error', 5000); }
    },
    pickRestore() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (d.format !== 'charactry-web-backup') throw new Error(T('notBackup'));
          if (!confirm(T('confirmRestore'))) return;
          const unwrap = (v) => {
            if (v && typeof v === 'object' && v.__charactryBlob) {
              const [head, b64] = v.__charactryBlob.split(',');
              return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: (head.match(/:(.*?);/) || [])[1] || '' });
            }
            return v;
          };
          for (const [k, v] of Object.entries(d.main || {})) await localforage.setItem(k, unwrap(v));
          for (const [k, v] of Object.entries(d.disk || {})) if (k !== 'ai_provider') await disk.setItem(k, unwrap(v));
          say(T('restored')); setTimeout(() => location.reload(), 900);
        } catch (e) { say(T('restoreFail', { msg: e.message }), 'error', 6000); }
      };
      inp.click();
    },
  };

  /* ═══════════ 5. CHARACTER BRAIN SPRITES (replaces the "open folder" button) ═══════════ */
  WEB.openSpriteManager = async function (charId) {
    document.getElementById('web-sprite-mgr')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'web-sprite-mgr'; wrap.className = 'modal-overlay open'; wrap.style.zIndex = 100000;
    wrap.innerHTML = `<div class="modal modal-wide" style="max-width:720px">
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="modal-title">${esc(T('spriteTitle'))}</div>
      <p style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">${T('spriteIntro')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-primary" id="wsm-add">${esc(T('addImages'))}</button>
        <button class="btn btn-ghost" id="wsm-icon">${esc(T('setIcon'))}</button>
      </div>
      <div id="wsm-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px"></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); if (typeof brainLoadSprites === 'function' && typeof _brain !== 'undefined' && _brain.charId === charId) brainLoadSprites(charId); };
    wrap.querySelector('.modal-close').onclick = close;
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });

    const clean = (name) => name.replace(/[\\/]/g, '_').replace(/[^\w.\- ]+/g, '_');
    const paint = async () => {
      const files = await window.electronAPI.listSprites(charId);
      const list = wrap.querySelector('#wsm-list');
      const items = [];
      for (const f of files) items.push([f, await window.electronAPI.readSprite(charId, f)]);
      list.innerHTML = items.map(([f, src]) => `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:6px;text-align:center">
          <img src="${esc(src)}" alt="" style="width:100%;height:90px;object-fit:contain;border-radius:6px;background:var(--bg)">
          <div style="font-size:10px;color:var(--text2);margin:4px 0;word-break:break-all">${esc(f)}</div>
          ${/^(avatar|banner)\.png$/i.test(f) ? '' : `<button class="btn btn-ghost" data-del="${esc(f)}" style="font-size:10px;padding:2px 8px;color:var(--danger)">${esc(T('del'))}</button>`}
        </div>`).join('') || `<span style="font-size:12px;color:var(--text3)">${esc(T('noImages'))}</span>`;
      list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await disk.removeItem(`cf:${charId}:${b.dataset.del}`); paint(); });
    };
    const pick = (multiple, forceName) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif'; inp.multiple = multiple;
      inp.onchange = async () => {
        for (const f of inp.files) await disk.setItem(`cf:${charId}:${forceName || clean(f.name)}`, await WEB.blobToDataURL(f));
        paint();
      };
      inp.click();
    };
    wrap.querySelector('#wsm-add').onclick = () => pick(true);
    wrap.querySelector('#wsm-icon').onclick = () => pick(false, 'CB_icon.png');
    paint();
  };

  /* ═══════════ 6. Theme-pack / card-frame plugin channels (from main.js) ═══════════ */
  try {
    new BroadcastChannel('charactry-theme').onmessage = (e) => {
      if (!e.data || e.data.type !== 'charactry-theme-apply' || !e.data.vars) return;
      window.electronAPI.applyTheme(e.data.vars);
      if (typeof settings !== 'undefined' && typeof saveData === 'function') {
        const v = e.data.vars;
        settings.themeLabel = 'Theme Pack';
        settings.themePackVars = { bg: v['--bg'], bg2: v['--bg2'], bg3: v['--bg3'], sb: v['--sidebar-bg'], card: v['--card'], border: v['--border'], border2: v['--border2'], text: v['--text'], text2: v['--text2'], text3: v['--text3'], accent: v['--accent'], accent2: v['--accent2'] };
        settings.accentColor1 = null; settings.accentColor2 = null;
        saveData();
      }
    };
    new BroadcastChannel('charactry-card-frames').onmessage = async (e) => {
      if (!e.data || e.data.type !== 'card-frame-updated' || !e.data.charId) return;
      const c = await window.electronAPI.readCharJSON(e.data.charId);
      if (!c) return;
      const i = characters.findIndex(x => x.id === e.data.charId);
      if (i >= 0) characters[i] = { ...characters[i], ...c, id: e.data.charId };
      if (typeof saveData === 'function') saveData();   // desktop re-reads the char file next launch; the browser copy must be saved now
      renderPage(currentPage);
    };
  } catch { /* BroadcastChannel unsupported */ }

  /* ═══════════ 7. Boot: shell, OAuth notice, PWA ═══════════ */
  /* Version badge in the top bar (from web/version.json) */
  async function showVersion() {
    await WEB.versionReady;
    if (!WEB.version || $('#web-version')) return;
    const right = $('#topbar-right');
    if (!right) return;
    const pill = document.createElement('span');
    pill.id = 'web-version'; pill.textContent = 'v' + WEB.version + ' · Web';
    pill.title = T('versionWeb', { v: WEB.version });
    right.insertBefore(pill, right.firstChild);
  }

  function boot() {
    initShell();
    showVersion();
    // After returning from OpenRouter, jump to AI Studio and say how it went
    if (WEB.pendingNotice || new URLSearchParams(location.search).has('code')) {
      let tries = 0;
      const t = setInterval(() => {
        const n = WEB.pendingNotice;
        const ready = typeof navigate === 'function' && $('#splash')?.classList.contains('hidden');
        if (n && ready) {
          clearInterval(t);
          const plus = typeof isPLUS !== 'undefined' && isPLUS;
          if (plus) { try { _aiTab = 'setup'; } catch {} navigate(n.goto); }
          const base = typeof n.msg === 'function' ? n.msg() : n.msg;
          say(base + (!plus && n.type === 'success' ? T('aiNeedsPlus') : ''), n.type, 6000);
          WEB.pendingNotice = null;
        } else if (++tries > 120) clearInterval(t);
      }, 500);
    }
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
