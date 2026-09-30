/* ═══════════════════════════════════════════════════════════════════
   Charactry Web — web-ui.js
   Loaded AFTER ai.js. Wraps a few app functions (by re-assigning the
   global function names) to add what a browser needs and a desktop
   doesn't: mobile navigation, AI provider setup, plugin .zip install,
   sprite upload, backup/restore. The app's own code is not edited.
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const WEB  = window.CharactryWeb;
  const disk = WEB.disk;
  const esc  = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $    = (sel, root = document) => root.querySelector(sel);
  const say  = (msg, type, ms) => { try { toast(msg, type || 'success', ms || 3000); } catch { console.log(msg); } };

  /* ═══════════ 1. MOBILE / TABLET SHELL ═══════════ */
  function initShell() {
    const left = $('#topbar-left');
    if (left && !$('#web-menu-btn')) {
      const b = document.createElement('button');
      b.id = 'web-menu-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Open menu');
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
    // Close the drawer when something in the sidebar is chosen
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
    if (lbl) lbl.textContent = WEB.ai.get().model || '(none chosen)';
  };

  const CARD_TITLE = "font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:14px";
  const LBL = 'font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin:14px 0 8px';

  function webRenderAIConn() {
    const el = $('#web-ai-conn'); if (!el) return;
    const c = WEB.ai.get(), p = c.provider;
    const opt = (v, t) => `<option value="${v}" ${p === v ? 'selected' : ''}>${t}</option>`;
    let body = '';
    if (p === 'openrouter') {
      const has = !!c.openrouter.key;
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">
          <b>OpenRouter</b> gives the web version access to many AI models, including free ones (marked <code>:free</code>).
          Connect your own OpenRouter account — the key is stored <b>only in this browser</b> and is sent only to openrouter.ai.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${has
            ? `<span style="font-size:12px;color:var(--success);font-weight:700">✓ Connected</span>
               <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.disconnect()">Disconnect</button>`
            : `<button class="btn btn-primary" style="font-size:12px;padding:8px 18px" onclick="CharactryWeb.startOpenRouterConnect()">Connect with OpenRouter</button>
               <a class="btn btn-ghost" style="font-size:12px;padding:6px 14px;text-decoration:none" target="_blank" rel="noopener" href="https://openrouter.ai/keys">Get a key ↗</a>`}
        </div>
        ${has ? '' : `
        <div style="${LBL}">…or paste an API key</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-or-key" type="password" autocomplete="off" placeholder="sk-or-v1-…" style="flex:1;min-width:200px;max-width:360px">
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.saveKey()">Save key</button>
        </div>`}
        <div style="margin-top:12px;font-size:11px;color:var(--text3);line-height:1.6">
          Free models are rate-limited by OpenRouter (a handful of requests per minute and a daily cap that is higher once your account has a few dollars of credit). If a request is refused, wait a moment or pick another model.
        </div>`;
    } else if (p === 'custom') {
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">
          Any <b>OpenAI-compatible</b> endpoint that allows browser requests (CORS): Groq, Together, Mistral, LM Studio, a self-hosted proxy, …
        </div>
        <div style="${LBL.replace('margin:14px 0 8px', 'margin:0 0 6px')}">Base URL</div>
        <input class="form-input" id="web-cu-base" placeholder="https://api.groq.com/openai/v1" value="${esc(c.custom.base)}" style="max-width:420px">
        <div style="${LBL}">API key (optional for local servers)</div>
        <input class="form-input" id="web-cu-key" type="password" autocomplete="off" value="${esc(c.custom.key)}" style="max-width:420px">
        <div style="margin-top:12px"><button class="btn btn-primary" style="font-size:12px;padding:6px 16px" onclick="WebAI.saveCustom()">Save</button></div>`;
    } else {
      body = `
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">
          Use <b>Ollama running on your own computer</b>. Your browser must be allowed to talk to it:
          start Ollama with <code>OLLAMA_ORIGINS=${esc(location.origin)}</code> set, e.g.
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0;font-family:monospace;font-size:11px;overflow-x:auto">
            Windows (PowerShell): $env:OLLAMA_ORIGINS="${esc(location.origin)}"; ollama serve<br>
            macOS / Linux: OLLAMA_ORIGINS=${esc(location.origin)} ollama serve</div>
          Works in Chrome, Edge and Firefox on the same computer. Safari and phones can't reach a local Ollama — use OpenRouter there.
        </div>
        <div style="${LBL.replace('margin:14px 0 8px', 'margin:0 0 6px')}">Ollama address</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-ol-url" value="${esc(c.ollama.url)}" style="flex:1;min-width:200px;max-width:320px">
          <button class="btn btn-primary" style="font-size:12px;padding:6px 16px" onclick="WebAI.saveOllama()">Save</button>
        </div>`;
    }
    el.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <div style="${CARD_TITLE}">AI Connection</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <select class="form-input" id="web-ai-provider" style="max-width:300px" onchange="WebAI.setProvider(this.value)">
            ${opt('openrouter', 'OpenRouter (recommended)')}${opt('custom', 'Custom OpenAI-compatible endpoint')}${opt('ollama', 'Local Ollama (advanced)')}
          </select>
          <span style="display:flex;align-items:center;gap:8px;margin-left:auto">
            <span class="ai-status-dot checking" id="web-ai-dot"></span>
            <span style="font-size:12px;color:var(--text2)" id="web-ai-status">Checking…</span>
            <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px" onclick="WebAI.check()">Recheck</button>
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
        <div style="${CARD_TITLE}">Active Model</div>
        <div style="font-size:13px;margin-bottom:12px">Using: <b style="color:var(--accent)" id="web-model-now">${esc(c.model || '(none chosen)')}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <input class="form-input" id="web-model-search" placeholder="Search models…" value="${esc(modelFilter)}" style="flex:1;min-width:180px;max-width:320px" oninput="WebAI.filter(this.value)">
          ${c.provider === 'openrouter' ? `<label style="font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${freeOnly ? 'checked' : ''} onchange="WebAI.freeOnly(this.checked)"> Free only</label>` : ''}
        </div>
        <div id="web-model-list" style="display:flex;flex-wrap:wrap;gap:8px;max-height:260px;overflow-y:auto;padding:2px"></div>
        <div style="${LBL}">Or type a model id</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="form-input" id="web-model-custom" placeholder="${c.provider === 'openrouter' ? 'e.g. meta-llama/llama-3.3-70b-instruct:free' : 'model name'}" style="flex:1;min-width:200px;max-width:380px">
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px" onclick="WebAI.pickCustom()">Use this</button>
        </div>
      </div>`;
    webFillModelList();
  }
  async function webFillModelList() {
    const list = $('#web-model-list'); if (!list) return;
    list.innerHTML = '<span style="font-size:12px;color:var(--text3);font-style:italic">Loading models…</span>';
    let models = await WEB.ai.listModels();
    const cfg = WEB.ai.get();
    if (!models.length) {
      list.innerHTML = '<span style="font-size:12px;color:var(--text3);font-style:italic">Couldn’t load a model list — type a model id below.</span>';
      return;
    }
    if (cfg.provider === 'openrouter' && freeOnly) models = models.filter(m => m.free);
    const q = modelFilter.trim().toLowerCase();
    if (q) models = models.filter(m => (m.id + ' ' + m.name).toLowerCase().includes(q));
    models = models.slice(0, 80);
    list.innerHTML = models.map(m =>
      `<button class="ai-model-chip${cfg.model === m.id ? ' selected' : ''}" data-id="${esc(m.id)}" title="${esc(m.id)}" onclick="WebAI.pick(this.dataset.id)">${esc(m.name.length > 44 ? m.name.slice(0, 43) + '…' : m.name)}${m.free && cfg.provider === 'openrouter' ? ' <span style="font-size:9px;opacity:.7">free</span>' : ''}</button>`
    ).join('') || '<span style="font-size:12px;color:var(--text3);font-style:italic">No models match.</span>';
  }

  window.WebAI = {
    async setProvider(v) { await WEB.ai.set({ provider: v }); webRenderAIConn(); webRenderAIModel(); },
    async saveKey() {
      const k = ($('#web-or-key')?.value || '').trim();
      if (!k) return say('Paste your OpenRouter key first.', 'error');
      await WEB.ai.set({ openrouter: { key: k } });
      say('Key saved in this browser.'); webRenderAIConn(); webRenderAIModel();
    },
    async disconnect() {
      if (!confirm('Remove the OpenRouter key from this browser?')) return;
      await WEB.ai.set({ openrouter: { key: '' } }); webRenderAIConn();
    },
    async saveCustom() {
      await WEB.ai.set({ custom: { base: ($('#web-cu-base').value || '').trim(), key: ($('#web-cu-key').value || '').trim() } });
      say('Saved.'); webRenderAIConn(); webRenderAIModel();
    },
    async saveOllama() {
      await WEB.ai.set({ ollama: { url: ($('#web-ol-url').value || '').trim() || 'http://localhost:11434' } });
      say('Saved.'); webRenderAIConn(); webRenderAIModel();
    },
    async pick(id) {
      await WEB.ai.set({ model: id });
      settings.ollamaModel = id;                       // keeps the app's own labels in sync
      localforage.setItem('charactry_settings', settings);
      $('#web-model-now').textContent = id;
      const lbl = $('#ai-active-model-label'); if (lbl) lbl.textContent = id;
      document.querySelectorAll('#web-model-list .ai-model-chip').forEach(b => b.classList.toggle('selected', b.dataset.id === id));
      say('Model set to ' + id);
    },
    pickCustom() {
      const v = ($('#web-model-custom').value || '').trim();
      if (!v) return say('Type a model id first.', 'error');
      WebAI.pick(v);
    },
    filter(v) { modelFilter = v; webFillModelList(); },
    freeOnly(v) { freeOnly = v; webFillModelList(); },
    async check() {
      const dot = $('#web-ai-dot'), txt = $('#web-ai-status'); if (!dot || !txt) return;
      dot.className = 'ai-status-dot checking'; txt.textContent = 'Checking…';
      const c = WEB.ai.get();
      let ok = false, msg = '';
      try {
        if (c.provider === 'openrouter') {
          if (!c.openrouter.key) msg = 'Not connected';
          else {
            const r = await WEB.rawFetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: 'Bearer ' + c.openrouter.key } });
            ok = r.ok; msg = ok ? 'OpenRouter connected ✓' : (r.status === 401 ? 'Key rejected — reconnect' : 'OpenRouter error ' + r.status);
          }
        } else if (c.provider === 'custom') {
          if (!c.custom.base) msg = 'Enter a base URL';
          else { const m = await WEB.ai.listModels(); ok = m.length > 0; msg = ok ? 'Endpoint reachable ✓' : 'Could not list models (still may work)'; }
        } else {
          ok = await window.electronAPI.ollamaCheck(); msg = ok ? 'Ollama is running ✓' : 'Ollama not reachable (check OLLAMA_ORIGINS)';
        }
      } catch (e) { msg = 'Could not connect: ' + e.message; }
      dot.className = 'ai-status-dot ' + (ok ? 'ok' : 'err'); txt.textContent = msg;
    },
  };

  /* Reword desktop-only AI messages */
  const AI_MSG = 'AI is not connected — open AI Studio → Setup to connect OpenRouter.';
  const rewriteAI = (m) => typeof m === 'string' && /ollama (is )?not (running|detected)|Ollama is not running/i.test(m) ? AI_MSG : m;
  const origToast = window.toast;
  window.toast = function (msg, ...rest) { return origToast.call(this, rewriteAI(msg), ...rest); };
  const origOcfErr = window.ocfErrorHTML;
  if (origOcfErr) window.ocfErrorHTML = (m) => origOcfErr(rewriteAI(m));
  const origAIStudio = window.renderAIStudio;
  window.renderAIStudio = function (pc) {
    origAIStudio(pc);
    const sub = pc.querySelector('.page-subtitle');
    if (sub) sub.textContent = 'Powered by OpenRouter (or your own AI endpoint) · Your key stays in this browser';
    const warn = pc.querySelector('.ai-warning-banner div div:last-child');
    if (warn) warn.textContent = warn.textContent.replace('using your own local AI model', 'using your own AI connection');
  };
  const origRunTest = window.aiRunTest;
  window.aiRunTest = async function () {
    await origRunTest();
    const out = $('#ai-test-output');
    if (out) out.textContent = out.textContent.replace(/\n\nMake sure Ollama is running and the selected model is pulled\./, '\n\nCheck the connection and model above.');
  };

  /* ═══════════ 3. PLUGINS — list, .zip install, remove ═══════════ */
  window.renderPluginList = function () {
    if (!installedPlugins.length) {
      return `<div style="font-size:13px;color:var(--text3);padding:14px 0">No plugins installed yet. Use “Install plugin (.zip)” below.</div>`;
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
          <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${esc(m.description || 'No description.')}</div>
          ${m.author ? `<div style="font-size:11px;color:var(--text3)">by ${esc(m.author)}${p.bundled ? '' : ' · installed from .zip'}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;color:var(--text2)">
            <div onclick="togglePlugin('${esc(p.id)}')" style="width:36px;height:20px;border-radius:20px;background:${active ? 'var(--accent)' : 'var(--bg3)'};border:1px solid var(--border);cursor:pointer;position:relative;transition:background .2s">
              <div style="position:absolute;top:2px;${active ? 'right' : 'left'}:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>
            </div>${active ? 'Enabled' : 'Disabled'}
          </label>
          ${p.bundled ? '' : `<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px;color:var(--danger)" onclick="WebPlugins.remove('${esc(p.id)}')">Remove</button>`}
        </div>
      </div>`;
    }).join('');
  };
  window.updatePluginPathDisplay = async function () {
    const box = $('#plugin-path-info');
    if (box) box.textContent = '💾 Plugins are stored in this browser and stay installed after you close the tab.';
  };
  window.openPluginsFolder = () => WEB.pickPluginZip();
  window.openLorebooksFolder = () => {};

  let jszipPromise = null;
  const loadJSZip = () => jszipPromise || (jszipPromise = new Promise((res, rej) => {
    if (window.JSZip) return res(window.JSZip);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => res(window.JSZip); s.onerror = () => { jszipPromise = null; rej(new Error('Could not load the zip library (offline?)')); };
    document.head.appendChild(s);
  }));

  const TEXT_EXT = /\.(html?|css|js|json|svg|md|txt)$/i;
  const BIN_EXT  = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i;
  const LIMITS = { files: 300, total: 30 * 1024 * 1024 };

  WEB.pickPluginZip = function () {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.zip,application/zip';
    inp.onchange = () => { if (inp.files[0]) WebPlugins.install(inp.files[0]); };
    inp.click();
  };

  window.WebPlugins = {
    async install(file) {
      try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(f.name));
        // Locate manifest.json at the shallowest depth → that folder is the plugin root
        const mf = entries.filter(f => /(^|\/)manifest\.json$/.test(f.name)).sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
        if (!mf) throw new Error('No manifest.json found. A plugin needs manifest.json (and usually index.html) in its folder.');
        const root = mf.name.slice(0, mf.name.length - 'manifest.json'.length);
        let manifest;
        try { manifest = JSON.parse(await mf.async('string')); } catch { throw new Error('manifest.json is not valid JSON.'); }
        if (!manifest.name) throw new Error('manifest.json needs a "name".');

        let id = String(manifest.id || root.replace(/\/$/, '').split('/').pop() || manifest.name)
          .toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!id) throw new Error('Could not work out a plugin id.');
        if (await WEB.isBundledPlugin(id)) throw new Error(`“${id}” is one of the built-in plugins and can’t be replaced.`);
        if (installedPlugins.some(p => p.id === id && !p.bundled) && !confirm(`Plugin “${manifest.name}” is already installed. Replace it?`)) return;

        const inRoot = entries.filter(f => f.name.startsWith(root));
        if (inRoot.length > LIMITS.files) throw new Error('This zip has too many files.');
        const files = {}; let total = 0, skipped = 0;
        for (const f of inRoot) {
          const rel = f.name.slice(root.length);
          if (!rel || rel.includes('..') || rel.startsWith('/')) { skipped++; continue; }
          if (TEXT_EXT.test(rel)) { const v = await f.async('string'); total += v.length; files[rel] = { t: 'text', v }; }
          else if (BIN_EXT.test(rel)) { const v = await f.async('base64'); total += v.length; files[rel] = { t: 'b64', v }; }
          else { skipped++; continue; }
          if (total > LIMITS.total) throw new Error('Plugin is larger than 30 MB.');
        }
        if (!confirm(`Install “${manifest.name}”${manifest.author ? ' by ' + manifest.author : ''}?\n\nPlugins run inside Charactry and can read everything saved in it (characters, lore, your license key and AI key). Only install plugins from people you trust.`)) return;

        manifest.enabled = manifest.enabled !== false;
        await disk.setItem('plugin:' + id, { manifest, files, installedAt: Date.now() });
        await reloadPluginsAndLorebooks();
        say(`Plugin “${manifest.name}” installed ✦` + (skipped ? ` (${skipped} unsupported file${skipped > 1 ? 's' : ''} skipped)` : ''), 'success', 4000);
      } catch (e) {
        say('Could not install plugin: ' + e.message, 'error', 6000);
      }
    },
    async remove(id) {
      const p = installedPlugins.find(x => x.id === id);
      if (!confirm(`Remove plugin “${p ? p.manifest.name : id}”? Data the plugin saved on its own stays in the browser.`)) return;
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
    if (inst) { inst.textContent = '📦 Install plugin (.zip)'; inst.onclick = () => WEB.pickPluginZip(); }
    pc.querySelector('button[onclick="openLorebooksFolder()"]')?.remove();
    const sections = pc.querySelectorAll('.settings-section');
    const about = sections[sections.length - 1];
    if (!about) return;
    about.insertAdjacentHTML('beforebegin', `
      <div class="settings-section" id="web-data-section">
        <div class="settings-section-title">🌐 Web version · your data</div>
        <p style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7">
          Everything — characters, worlds, lorebooks, sprites, plugins and settings — is saved in <b>this browser on this device</b>,
          so it is still here when you close the tab and come back. It is <b>not</b> uploaded anywhere.
          Clearing site data, or using a private window, erases it — so download a full backup now and then, and to move to another device.
        </p>
        <div id="web-storage-info" style="font-size:12px;color:var(--text3);margin-bottom:12px">Checking storage…</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="WebData.backup()">⬇ Download full backup</button>
          <button class="btn btn-ghost" onclick="WebData.pickRestore()">⬆ Restore full backup</button>
          <button class="btn btn-ghost" id="web-persist-btn" onclick="WebData.persist()" style="display:none">🔒 Keep my data (persistent storage)</button>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">
          The full backup includes plugin data and Character Brain chats, and your license key — keep the file private. It does not include your AI key.
          Your PLUS license can be active on up to 2 devices; a browser you clear counts as a new device, so “Deactivate” before wiping a browser you use.
        </div>
      </div>
      <div class="divider"></div>`);
    WebData.refreshInfo();
  }

  window.WebData = {
    async refreshInfo() {
      const box = $('#web-storage-info'); if (!box) return;
      try {
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
        const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
        box.textContent = (est ? `Using ${mb(est.usage)} of about ${mb(est.quota)} available. ` : '') +
          (persisted ? '🔒 Persistent storage granted — the browser won’t clear it automatically.' : 'The browser may clear this if the device runs very low on space.');
        const btn = $('#web-persist-btn'); if (btn && !persisted && navigator.storage?.persist) btn.style.display = '';
      } catch { box.textContent = ''; }
    },
    async persist() {
      const ok = await navigator.storage.persist();
      say(ok ? 'Persistent storage granted 🔒' : 'The browser declined — it decides based on how often you use the site. Try installing the app to your home screen.', ok ? 'success' : 'error', 5000);
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
        say('Full backup downloaded ✦');
      } catch (e) { say('Backup failed: ' + e.message, 'error', 5000); }
    },
    pickRestore() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (d.format !== 'charactry-web-backup') throw new Error('This isn’t a Charactry web backup (use “Import backup” for the older character-only file).');
          if (!confirm('Restore this backup? Matching data in this browser will be replaced.')) return;
          const unwrap = (v) => {
            if (v && typeof v === 'object' && v.__charactryBlob) {
              const [head, b64] = v.__charactryBlob.split(',');
              return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: (head.match(/:(.*?);/) || [])[1] || '' });
            }
            return v;
          };
          for (const [k, v] of Object.entries(d.main || {})) await localforage.setItem(k, unwrap(v));
          for (const [k, v] of Object.entries(d.disk || {})) if (k !== 'ai_provider') await disk.setItem(k, unwrap(v));
          say('Backup restored — reloading…'); setTimeout(() => location.reload(), 900);
        } catch (e) { say('Restore failed: ' + e.message, 'error', 6000); }
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
      <div class="modal-title">Sprites &amp; icon</div>
      <p style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:12px">
        Character Brain shows these images as your character talks. Name them after the expression, e.g.
        <code>neutral_eyes_opened_name.png</code>, <code>neutral_eyes_closed_name.png</code>, <code>happy.png</code>, <code>sad.png</code>, <code>angry.png</code>.
        A file called <code>CB_icon.png</code> is used as the small chat-bubble icon.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-primary" id="wsm-add">＋ Add images</button>
        <button class="btn btn-ghost" id="wsm-icon">Set CB_icon.png</button>
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
          ${/^(avatar|banner)\.png$/i.test(f) ? '' : `<button class="btn btn-ghost" data-del="${esc(f)}" style="font-size:10px;padding:2px 8px;color:var(--danger)">Delete</button>`}
        </div>`).join('') || '<span style="font-size:12px;color:var(--text3)">No images yet.</span>';
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
      renderPage(currentPage);
    };
  } catch { /* BroadcastChannel unsupported */ }

  /* ═══════════ 7. Boot: shell, OAuth notice, PWA ═══════════ */
  function boot() {
    initShell();
    // After returning from OpenRouter, jump to AI Studio and say how it went
    if (WEB.pendingNotice || new URLSearchParams(location.search).has('code')) {
      let tries = 0;
      const t = setInterval(() => {
        const n = WEB.pendingNotice;
        const ready = typeof navigate === 'function' && $('#splash')?.classList.contains('hidden');
        if (n && ready) {
          clearInterval(t);
          if (typeof isPLUS !== 'undefined' && isPLUS) { window._aiTab = 'setup'; try { _aiTab = 'setup'; } catch {} navigate(n.goto); }
          say(n.msg + (typeof isPLUS !== 'undefined' && !isPLUS && n.type === 'success' ? ' (AI Studio unlocks with Charactry PLUS.)' : ''), n.type, 6000);
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
