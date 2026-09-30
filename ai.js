/* ═══════════════════════════════════════════════
   ai.js — Charactry AI Studio
   All AI Studio logic: Ollama bridge, OC Forge,
   AU Weaver, Story Spark, and future tools.
   Loaded by index.html via <script src="ai.js">
═══════════════════════════════════════════════ */

/* ── Inject AI Studio CSS ── */
(function(){
  const style = document.createElement("style");
  style.textContent = `
/* ── AI Studio ── */
.ai-tab-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px}
.ai-tab{padding:7px 16px;border-radius:20px;border:1px solid var(--border);font-size:12px;font-weight:700;cursor:pointer;background:transparent;color:var(--text2);font-family:'Nunito',sans-serif;transition:all .15s}
.ai-tab:hover{border-color:var(--accent);color:var(--text)}
.ai-tab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ai-tab.soon{opacity:.45;cursor:default}
.ai-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;transition:background .3s}
.ai-status-dot.ok{background:#10b981;box-shadow:0 0 8px #10b98188}
.ai-status-dot.err{background:#ef4444;box-shadow:0 0 8px #ef444488}
.ai-status-dot.checking{background:#f59e0b;animation:aiPulse .9s infinite alternate}
@keyframes aiPulse{from{opacity:.4}to{opacity:1}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ai-model-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;font-weight:700;cursor:pointer;background:var(--bg2);color:var(--text2);transition:all .15s;font-family:'Nunito',sans-serif}
.ai-model-chip:hover,.ai-model-chip.selected{border-color:var(--accent);color:var(--accent);background:var(--accent-glow)}
.ai-warning-banner{background:linear-gradient(135deg,#1a0a0a,#2a0f0f);border:1.5px solid #ef444455;border-radius:14px;padding:18px 22px;display:flex;align-items:flex-start;gap:14px;margin-bottom:24px}
.ai-test-output{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text2);line-height:1.7;min-height:60px;white-space:pre-wrap;font-family:'Nunito',sans-serif}
</style>
  `;
  document.head.appendChild(style);
})();

/* ═══════════════════════════════════════════════
   AI STUDIO — OLLAMA BRIDGE
═══════════════════════════════════════════════ */

let _aiTab = 'setup';
const AI_TOOLS = [
  { id:'setup',       i18nKey:'aiStudio.tabSetup',       fallback:'⚙ Setup',          soon:false },
  { id:'ocforge',     i18nKey:'aiStudio.tabOcForge',     fallback:'✦ OC Forge',        soon:false },
  { id:'auweaver',    i18nKey:'aiStudio.tabAuWeaver',    fallback:'⟳ AU Weaver',       soon:false },
  { id:'storyspark',  i18nKey:'aiStudio.tabStorySpark',  fallback:'✎ Story Spark',     soon:false },
  { id:'fusionlab',   i18nKey:'aiStudio.tabFusionLab',   fallback:'⬡ Fusion Lab',      soon:false },
  { id:'sceneengine', i18nKey:'aiStudio.tabSceneEngine', fallback:'⚡ Scene Engine',   soon:false },
  { id:'loreforge',   i18nKey:'aiStudio.tabLoreForge',   fallback:'📚 Lore Forge',     soon:false },
  { id:'lorecheck',   i18nKey:'aiStudio.tabLoreCheck',   fallback:'🔍 Lore Check',     soon:false },
  { id:'relspark',    i18nKey:'aiStudio.tabRelSpark',    fallback:'💞 Rel Spark',       soon:false },
  { id:'charbrain',   i18nKey:'aiStudio.tabCharBrain',   fallback:'🧠 Character Brain',soon:false },
];

/* ── Ollama IPC Bridge helpers ──
   In Electron, file:// pages send a null origin which newer Ollama versions
   reject with a 500. We route all Ollama traffic through the main process
   via IPC to bypass CORS entirely. Falls back to direct fetch in web context. */

function _hasElectronOllama() {
  return !!(window.electronAPI?.ollamaGenerate);
}

// Returns an ordered list of models to try: explicit arg → settings → all installed models → ['mistral']
async function _modelCandidates(model) {
  if (model) return [model];
  if (settings.ollamaModel) return [settings.ollamaModel];
  try {
    const models = await ollamaListModels();
    if (models && models.length > 0) return models;
  } catch { /* ignore */ }
  return ['mistral'];
}

function _isMemoryError(msg) {
  return /memory|ram|vram|system memory/i.test(msg || '');
}

/* Core Ollama bridge — tries each installed model in order, skipping ones too large to run */
async function aiGenerate(prompt, model) {
  const candidates = await _modelCandidates(model);
  let lastError = null;
  for (const m of candidates) {
    if (_hasElectronOllama()) {
      const result = await window.electronAPI.ollamaGenerate(m, prompt);
      if (result.ok) return result.response;
      lastError = result.error || ('Ollama returned ' + result.status);
      if (!_isMemoryError(lastError)) throw new Error(lastError); // non-memory errors: fail immediately
      // memory error: try next model
    } else {
      // Web fallback
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt, stream: false })
      });
      if (response.ok) {
        const data = await response.json();
        return data.response;
      }
      let errMsg = 'Ollama returned ' + response.status;
      try { const b = await response.json(); if (b.error) errMsg = b.error; } catch { /* ignore */ }
      if (!_isMemoryError(errMsg)) throw new Error(errMsg);
      lastError = errMsg;
    }
  }
  if (_isMemoryError(lastError)) throw new Error('Not enough available system memory to run this model. Close some applications or switch to a smaller model.');
  throw new Error(lastError || 'No usable Ollama model found. Try pulling a smaller model (e.g. ollama pull tinyllama).');
}

// Streaming version — calls onToken(chunk) for each token, returns full string when done
// Also tries each installed model in order if one is too large to run
async function aiGenerateStream(prompt, onToken, model) {
  const candidates = await _modelCandidates(model);
  let lastError = null;
  for (const m of candidates) {
    if (_hasElectronOllama()) {
      const tokenHandler = (token, full) => onToken(token, full);
      window.electronAPI.onOllamaToken(tokenHandler);
      try {
        const result = await window.electronAPI.ollamaGenerateStream(m, prompt);
        if (result.ok) return result.full;
        lastError = result.error || ('Ollama returned ' + result.status);
        if (!_isMemoryError(lastError)) throw new Error(lastError);
      } finally {
        window.electronAPI.offOllamaToken(tokenHandler);
      }
    } else {
      // Web fallback
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt, stream: true })
      });
      if (!response.ok) {
        let errMsg = 'Ollama returned ' + response.status;
        try { const b = await response.clone().json(); if (b.error) errMsg = b.error; } catch { /* ignore */ }
        if (!_isMemoryError(errMsg)) throw new Error(errMsg);
        lastError = errMsg;
        continue;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.response) { full += obj.response; onToken(obj.response, full); }
            if (obj.done) break;
          } catch { /* partial line, skip */ }
        }
      }
      return full;
    }
  }
  if (_isMemoryError(lastError)) throw new Error('Not enough available system memory to run this model. Close some applications or switch to a smaller model.');
  throw new Error(lastError || 'No usable Ollama model found. Try pulling a smaller model (e.g. ollama pull tinyllama).');
}

async function ollamaCheck() {
  if (_hasElectronOllama()) {
    try { return await window.electronAPI.ollamaCheck(); } catch { return false; }
  }
  try {
    const r = await fetch('http://localhost:11434/', { signal: AbortSignal.timeout(3000) });
    return r.ok || r.status < 500;
  } catch { return false; }
}

async function ollamaListModels() {
  if (_hasElectronOllama()) {
    try { return await window.electronAPI.ollamaListModels(); } catch { return []; }
  }
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.models || []).map(m => m.name);
  } catch { return []; }
}

/* ─────────────────────────────────────────────────────────────
   charMergeFromFile — merges character.json from disk onto
   the in-memory character object so ALL AI features get the
   freshest, most complete data. Non-destructive: only overwrites
   fields that are empty/missing in the in-memory copy.
   Also enriches: reads avatar/banner as data URLs if present.
   Falls back silently if Electron IPC isn't available.
───────────────────────────────────────────────────────────── */
async function charMergeFromFile(char) {
  if (!window.electronAPI?.readCharImage) return char; // web fallback — nothing to do
  try {
    // Try loading character.json from disk
    if (window.electronAPI?.ensureCharDir) {
      // readCharImage with 'character.json' won't work since it's JSON not an image
      // Instead use a dedicated load — fall through to localforage data which is already loaded
      // We enrich by loading avatar/banner image files from disk if not already in memory
    }

    // Load avatar from file if not already present
    if (!char.avatar && window.electronAPI?.readCharImage) {
      const avatarData = await window.electronAPI.readCharImage(char.id, 'avatar.png');
      if (avatarData) char = Object.assign({}, char, { avatar: avatarData });
    }
    // Load banner from file if not already present
    if (!char.banner && window.electronAPI?.readCharImage) {
      const bannerData = await window.electronAPI.readCharImage(char.id, 'banner.png');
      if (bannerData) char = Object.assign({}, char, { banner: bannerData });
    }
  } catch(e) { /* silent — never block generation */ }
  return char;
}

/* ── Render AI Studio ── */
function renderAIStudio(pc) {
  if (typeof isPLUS !== 'undefined' && !isPLUS) { pc.innerHTML = plusLockOverlay('AI Studio'); return; }
  const tabBar = AI_TOOLS.map(tool =>
    `<button class="ai-tab${tool.id===_aiTab?' active':''}${tool.soon?' soon':''}"
      onclick="${tool.soon ? '' : `_aiTab='${tool.id}';renderPage('aistudio')`}"
      ${tool.soon ? 'title="Coming soon"' : ''}>${t(tool.i18nKey)||tool.fallback}${tool.soon ? ' <span style=\'font-size:10px;opacity:.6\'>soon</span>' : ''}</button>`
  ).join('');

  pc.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title" style="display:flex;align-items:center;gap:10px">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12l3 3-3 3v1.5c1.2.7 2 2 2 3.5a4 4 0 0 1-8 0c0-1.5.8-2.8 2-3.5V18l-3-3 3-3V9.5C8.8 8.8 8 7.5 8 6a4 4 0 0 1 4-4z"/>
          </svg>
          ${t('aiStudio.title')||'AI Studio'}
        </div>
        <div class="page-subtitle">${t('aiStudio.subtitle')||'Powered by Ollama · Runs 100% locally on your machine'}</div>
      </div>
    </div>

    <!-- Art warning banner -->
    <div class="ai-warning-banner">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div>
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:#ef4444;margin-bottom:4px">${t('aiStudio.warningTitle')||'AI Art Generation Will NEVER Be Integrated!'}</div>
        <div style="font-size:12px;color:#f87171;line-height:1.7">
          ${t('aiStudio.warningText')||"Charactry's AI Studio is writing-only. It helps you generate bios, lore, AU concepts, prompts and scenes — all as text, using your own local AI model. No image generation. No art AI. Your characters' visual identity stays yours."}
        </div>
      </div>
    </div>

    <div class="ai-tab-bar">${tabBar}</div>
    <div id="ai-tab-content"></div>`;

  if (_aiTab === 'setup')         renderAISetupTab();
  else if (_aiTab === 'ocforge')    renderAIOCForge();
  else if (_aiTab === 'auweaver')   renderAIAUWeaver();
  else if (_aiTab === 'storyspark') renderAIStorySpark();
  else if (_aiTab === 'fusionlab')  renderAIFusionLab();
  else if (_aiTab === 'sceneengine') renderAISceneEngine();
  else if (_aiTab === 'loreforge')   renderAILoreForge();
  else if (_aiTab === 'lorecheck')   renderAILoreCheck();
  else if (_aiTab === 'relspark')    renderAIRelSpark();
  else if (_aiTab === 'charbrain')   renderAICharacterBrain();
}

/* ── Setup Tab ── */
function renderAISetupTab() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;
  const savedModel = settings.ollamaModel || 'mistral';

  cont.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiStudio.ollamaConnection')||'Ollama Connection'}</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div class="ai-status-dot checking" id="ai-dot"></div>
        <div style="font-size:13px;color:var(--text2)" id="ai-status-text">${t('aiStudio.checkingOllama')||'Checking for Ollama…'}</div>
        <button class="btn btn-ghost" style="margin-left:auto;padding:4px 14px;font-size:12px" onclick="aiRecheck()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline;vertical-align:-2px;margin-right:5px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          ${t('aiStudio.recheck')||'Recheck'}
        </button>
      </div>

      <div id="ai-not-installed" style="display:none;background:#1a0f0a;border:1px solid #f5973355;border-radius:10px;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#fb923c;margin-bottom:6px">${t('aiStudio.ollamaNotFound')||'Ollama not found'}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:10px">
          ${t('aiStudio.ollamaNotFoundDesc')||'Ollama runs AI models locally on your computer — no internet, no accounts, no cost. Install it, pull a model, then come back here.'}
        </div>
        <a href="https://ollama.com" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:5px 14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${t('aiStudio.getOllama')||'Get Ollama at ollama.com'}
        </a>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px" id="ai-model-card">
      <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${t('aiStudio.activeModel')||'Active Model'}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6">
        ${t('aiStudio.activeModelHint')||'Choose a model installed on your machine. Lighter models (Mistral, Phi-3) are faster. Heavier ones (LLaMA 3) give richer creative output. Custom lets you type any model name.'}
      </div>

      <!-- Detected installed models -->
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px">${t('aiStudio.installedModels')||'Installed Models'}</div>
      <div id="ai-model-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <span style="font-size:12px;color:var(--text3);font-style:italic">${t('aiStudio.detectingModels')||'Detecting…'}</span>
      </div>

      <!-- Recommended presets -->
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px">${t('aiStudio.recommendedPresets')||'Recommended Presets'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
        ${['mistral','phi3','llama3','gemma2'].map(m=>`
          <button class="ai-model-chip${savedModel===m?' selected':''}" onclick="aiSelectModel('${m}',this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            ${m}
          </button>`).join('')}
      </div>

      <!-- Custom model -->
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">${t('aiStudio.customModelName')||'Custom Model Name'}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="form-input" id="ai-custom-model" placeholder="e.g. dolphin-mistral, codellama…"
          style="flex:1;max-width:300px" value="${!['mistral','phi3','llama3','gemma2'].includes(savedModel)?savedModel:''}">
        <button class="btn btn-ghost" style="padding:6px 14px;font-size:12px" onclick="aiSelectCustomModel()">${t('aiStudio.useThis')||'Use This'}</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">${t('aiStudio.generationSettings')||'Generation Settings'}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${t('aiStudio.streamingResponses')||'Streaming Responses'}</div>
          <div style="font-size:12px;color:var(--text3);line-height:1.6">${t('aiStudio.streamingDesc')||'Text types out live as the AI generates. Feels more alive. Turn off if you prefer to wait for the full result at once.'}</div>
        </div>
        <div onclick="aiToggleStream(this)" id="ai-stream-toggle"
          style="width:44px;height:24px;border-radius:12px;flex-shrink:0;cursor:pointer;transition:background .2s;position:relative;
            background:${(settings.aiStreaming!==false)?'var(--accent)':'var(--bg3)'};border:1.5px solid ${(settings.aiStreaming!==false)?'var(--accent)':'var(--border)'}">
          <div style="position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;
            left:${(settings.aiStreaming!==false)?'22px':'2px'}"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiStudio.testConnection')||'Test Connection'}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text2)">${t('aiStudio.activeModelLabel')||'Active model:'}</span>
        <span style="font-size:12px;font-weight:700;color:var(--accent)" id="ai-active-model-label">${savedModel}</span>
        <button class="btn btn-primary" style="margin-left:auto;padding:6px 16px;font-size:12px;display:flex;align-items:center;gap:6px" onclick="aiRunTest()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${t('aiStudio.runTest')||'Run Test'}
        </button>
      </div>
      <div id="ai-test-output" style="display:none"></div>
    </div>
`;  // What's Coming card removed — all features now live

  // Kick off async checks
  aiRunStatusCheck();
  aiLoadInstalledModels();
}

async function aiRunStatusCheck() {
  const dot  = document.getElementById('ai-dot');
  const txt  = document.getElementById('ai-status-text');
  const warn = document.getElementById('ai-not-installed');
  if (!dot || !txt) return;
  const ok = await ollamaCheck();
  dot.className = 'ai-status-dot ' + (ok ? 'ok' : 'err');
  txt.textContent = ok ? (t('aiStudio.ollamaRunning')||'Ollama is running ✓') : (t('aiStudio.ollamaNotDetected')||'Ollama not detected');
  if (warn) warn.style.display = ok ? 'none' : 'block';
}

async function aiLoadInstalledModels() {
  const list = document.getElementById('ai-model-list');
  if (!list) return;
  const models = await ollamaListModels();
  if (!models.length) {
    list.innerHTML = `<span style="font-size:12px;color:var(--text3);font-style:italic">No models found — pull one with <code style="background:var(--bg3);padding:1px 6px;border-radius:4px">ollama pull mistral</code></span>`;
    return;
  }
  const saved = settings.ollamaModel || 'mistral';
  list.innerHTML = models.map(m => `
    <button class="ai-model-chip${saved===m?' selected':''}" onclick="aiSelectModel('${m}',this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      ${escHTML(m)}
    </button>`).join('');
}

function aiSelectModel(name, el) {
  document.querySelectorAll('.ai-model-chip').forEach(c=>c.classList.remove('selected'));
  el?.classList.add('selected');
  settings.ollamaModel = name;
  localforage.setItem('charactry_settings', settings);
  const lbl = document.getElementById('ai-active-model-label');
  if (lbl) lbl.textContent = name;
  toast(`Model set to ${name}`);
}

function aiSelectCustomModel() {
  const val = document.getElementById('ai-custom-model')?.value.trim();
  if (!val) { toast('Enter a model name first','error'); return; }
  document.querySelectorAll('.ai-model-chip').forEach(c=>c.classList.remove('selected'));
  settings.ollamaModel = val;
  localforage.setItem('charactry_settings', settings);
  const lbl = document.getElementById('ai-active-model-label');
  if (lbl) lbl.textContent = val;
  toast(`Model set to ${val}`);
}

function aiRecheck() {
  const dot = document.getElementById('ai-dot');
  const txt = document.getElementById('ai-status-text');
  if (dot) { dot.className = 'ai-status-dot checking'; }
  if (txt) txt.textContent = t('aiStudio.checkingOllama')||'Checking…';
  aiRunStatusCheck();
  aiLoadInstalledModels();
}

function aiToggleStream(el) {
  const isOn = settings.aiStreaming !== false;
  settings.aiStreaming = !isOn;
  localforage.setItem('charactry_settings', settings);
  // Update toggle visuals in-place
  el.style.background = settings.aiStreaming ? 'var(--accent)' : 'var(--bg3)';
  el.style.borderColor = settings.aiStreaming ? 'var(--accent)' : 'var(--border)';
  const knob = el.querySelector('div');
  if (knob) knob.style.left = settings.aiStreaming ? '22px' : '2px';
  toast(settings.aiStreaming ? 'Streaming on' : 'Streaming off');
}

async function aiRunTest() {
  const out = document.getElementById('ai-test-output');
  if (!out) return;
  const prompt = 'Say hello and introduce yourself as an AI writing assistant for a character creator app called Charactry. Keep it to 2-3 sentences.';
  const useStream = settings.aiStreaming !== false;

  out.style.display = 'block';
  out.style.cssText += ';background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap;font-family:\'Nunito\',sans-serif';

  if (useStream) {
    out.textContent = '';
    try {
      await aiGenerateStream(prompt, (token, full) => { out.textContent = full; });
    } catch(e) {
      out.textContent = '✕ Error: ' + e.message + '\n\nMake sure Ollama is running and the selected model is pulled.';
    }
  } else {
    out.textContent = '⏳ Generating…';
    try {
      out.textContent = await aiGenerate(prompt);
    } catch(e) {
      out.textContent = '✕ Error: ' + e.message + '\n\nMake sure Ollama is running and the selected model is pulled.';
    }
  }
}


/* ═══════════════════════════════════════════════
   AI STUDIO — OC FORGE
═══════════════════════════════════════════════ */

// State persists while tab is open
let _ocf = {
  activeSection: 'name',   // which sub-section is expanded
};

const OCF_SECTIONS = [
  { id:'name',    icon:'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', i18nKey:'aiStudio.ocfName',    fallback:'Name Generator' },
  { id:'eyes',    icon:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', i18nKey:'aiStudio.ocfEyes',    fallback:'Eye Color Generator' },
  { id:'hair',    icon:'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 3c1.2 0 2.3.4 3.2 1.1C13.8 7.3 13 9 13 12s.8 4.7 2.2 5.9C14.3 18.6 13.2 19 12 19c-3.9 0-7-3.1-7-7s3.1-7 7-7z', i18nKey:'aiStudio.ocfHair',    fallback:'Hair Generator' },
  { id:'outfit',  icon:'M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z', i18nKey:'aiStudio.ocfOutfit',  fallback:'Outfit Generator' },
  { id:'species', icon:'M12 2a5 5 0 0 1 5 5c0 5.25-5 13-5 13S7 12.25 7 7a5 5 0 0 1 5-5z', i18nKey:'aiStudio.ocfSpecies', fallback:'Species Generator' },
  { id:'traits',  icon:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', i18nKey:'aiStudio.ocfTraits',  fallback:'Trait Generator' },
  { id:'full',    icon:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', i18nKey:'aiStudio.ocfFull',    fallback:'Full Random OC' },
];

function ocfSpeciesLabel(val) {
  const map = {
    'Demon':                       t('ocf.speciesDemon')||'Demon',
    'Angel':                       t('ocf.speciesAngel')||'Angel',
    'Nephilim':                    t('ocf.speciesNephilim')||'Nephilim',
    'Nephalem':                    t('ocf.speciesNephalem')||'Nephalem',
    'Cambion':                     t('ocf.speciesCambion')||'Cambion',
    'Vampire':                     t('ocf.speciesVampire')||'Vampire',
    'Fae':                         t('ocf.speciesFae')||'Fae',
    'Ghoul':                       t('ocf.speciesGhoul')||'Ghoul',
    'Human':                       t('ocf.speciesHuman')||'Human',
    'Alien':                       t('ocf.speciesAlien')||'Alien',
    'Demihuman — Canine':          t('ocf.speciesDemihumanCanine')||'Demihuman — Canine',
    'Demihuman — Feline':          t('ocf.speciesDemihumanFeline')||'Demihuman — Feline',
    'Demihuman — Vulpine':         t('ocf.speciesDemihumanVulpine')||'Demihuman — Vulpine',
    'Demihuman — Equine':          t('ocf.speciesDemihumanEquine')||'Demihuman — Equine',
    'Demihuman — Cervine':         t('ocf.speciesDemihumanCervine')||'Demihuman — Cervine',
    'Demihuman — Ursine':          t('ocf.speciesDemihumanUrsine')||'Demihuman — Ursine',
    'Demihuman — Rabbit/Lagomorph':t('ocf.speciesDemihumanRabbit')||'Demihuman — Rabbit/Lagomorph',
    'Demihuman — Dragon':          t('ocf.speciesDemihumanDragon')||'Demihuman — Dragon',
    'Demihuman — Reptile':         t('ocf.speciesDemihumanReptile')||'Demihuman — Reptile',
    'Demihuman — Amphibian':       t('ocf.speciesDemihumanAmphibian')||'Demihuman — Amphibian',
    'Demihuman — Avian':           t('ocf.speciesDemihumanAvian')||'Demihuman — Avian',
    'Demihuman — Aquatic Mammal':  t('ocf.speciesDemihumanAquatic')||'Demihuman — Aquatic Mammal',
    'Merfolk — Freshwater':        t('ocf.speciesMerfolkFresh')||'Merfolk — Freshwater',
    'Merfolk — Reef':              t('ocf.speciesMerfolkReef')||'Merfolk — Reef',
    'Merfolk — Deep Sea':          t('ocf.speciesMerfolkDeepSea')||'Merfolk — Deep Sea',
    'Merfolk — Open Ocean':        t('ocf.speciesMerfolkOcean')||'Merfolk — Open Ocean',
    'Anthropomorphic — Canine':    t('ocf.speciesAnthroCanine')||'Anthropomorphic — Canine',
    'Anthropomorphic — Feline':    t('ocf.speciesAnthroFeline')||'Anthropomorphic — Feline',
    'Anthropomorphic — Vulpine':   t('ocf.speciesAnthroVulpine')||'Anthropomorphic — Vulpine',
    'Anthropomorphic — Ursine':    t('ocf.speciesAnthroUrsine')||'Anthropomorphic — Ursine',
    'Anthropomorphic — Avian':     t('ocf.speciesAnthroAvian')||'Anthropomorphic — Avian',
    'Anthropomorphic — Reptile':   t('ocf.speciesAnthroReptile')||'Anthropomorphic — Reptile',
    'Anthropomorphic — Misc':      t('ocf.speciesAnthroMisc')||'Anthropomorphic — Misc',
    'Deity/God':                   t('ocf.speciesDeityGod')||'Deity/God',
  };
  return map[val] || val;
}

function renderAIOCForge() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;
  const speciesKeys = typeof GEN_DATA !== 'undefined' ? Object.keys(GEN_DATA.species) : [];

  const sections = OCF_SECTIONS.map(s => {
    const isOpen = _ocf.activeSection === s.id;
    return `
    <div class="card" style="margin-bottom:14px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:2px 0"
        onclick="ocfToggleSection('${s.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="${s.icon}"/></svg>
        <span style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--text);letter-spacing:.5px;flex:1">${t(s.i18nKey)||s.fallback}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.5" stroke-linecap="round" style="transition:transform .2s;transform:rotate(${isOpen?'180':'0'}deg)"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div style="display:${isOpen?'block':'none'};margin-top:18px" id="ocf-section-${s.id}">
        ${ocfSectionHTML(s.id, speciesKeys)}
      </div>
    </div>`;
  }).join('');

  cont.innerHTML = `
    <div style="font-size:12px;color:var(--text3);margin-bottom:18px;line-height:1.7;display:flex;align-items:flex-start;gap:10px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ${t('aiStudio.ocForgeSubtitle')||'Each section generates with AI using your active Ollama model. You can use the preset controls <b>or</b> write your own custom prompt for full creative control.'}
    </div>
    ${sections}`;
}

function ocfToggleSection(id) {
  _ocf.activeSection = _ocf.activeSection === id ? null : id;
  renderAIOCForge();
}

function ocfSectionHTML(id, speciesKeys) {
  switch(id) {

    case 'name': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('form.style')||'Style'}</div>
          <select class="form-select" id="ocf-name-style">
            <optgroup label="${t('ocf.nameGroupFantasy')||'✦ Fantasy & Folklore'}">
              <option value="fantasy">${t('ocf.nameStyleFantasy')||'Fantasy (General)'}</option>
              <option value="high fantasy">${t('ocf.nameStyleHighFantasy')||'High Fantasy'}</option>
              <option value="dark fantasy">${t('ocf.nameStyleDarkFantasy')||'Dark Fantasy'}</option>
              <option value="mythology">${t('ocf.nameStyleMythology')||'Mythological'}</option>
              <option value="fae/fairy">${t('ocf.nameStyleFae')||'Fae / Fairy'}</option>
              <option value="divine">${t('ocf.nameStyleDivine')||'Divine / Celestial'}</option>
              <option value="demonic">${t('ocf.nameStyleDemonic')||'Demonic / Infernal'}</option>
              <option value="elven">${t('ocf.nameStyleElven')||'Elven'}</option>
              <option value="draconic">${t('ocf.nameStyleDraconic')||'Draconic'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupAesthetic')||'✦ Aesthetic / Vibe'}">
              <option value="gothic">${t('ocf.nameStyleGothic')||'Gothic / Dark'}</option>
              <option value="nature">${t('ocf.nameStyleNature')||'Nature / Earthy'}</option>
              <option value="modern">${t('ocf.nameStyleModern')||'Modern / Realistic'}</option>
              <option value="sci-fi">${t('ocf.nameStyleScifi')||'Sci-Fi / Futuristic'}</option>
              <option value="steampunk">${t('ocf.nameStyleSteampunk')||'Steampunk'}</option>
              <option value="soft/cute">${t('ocf.nameStyleSoftCute')||'Soft / Cute'}</option>
              <option value="edgy">${t('ocf.nameStyleEdgy')||'Edgy / Punk'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupSurprise')||'✦ Surprise'}">
              <option value="any">${t('ocf.nameStyleSurprise')||'Surprise me'}</option>
            </optgroup>
          </select></div>
        <div><div class="form-label">${t('ocf.langCulture')||'Language / Culture'}</div>
          <select class="form-select" id="ocf-name-lang">
            <option value="">${t('ocf.langAny')||'Any'}</option>
            <optgroup label="${t('ocf.nameGroupAsian')||'── Asian'}">
              <option value="Japanese">${t('ocf.langJapanese')||'Japanese'}</option>
              <option value="Chinese (Mandarin)">${t('ocf.langChineseMandarin')||'Chinese (Mandarin)'}</option>
              <option value="Chinese (Cantonese)">${t('ocf.langChineseCantonese')||'Chinese (Cantonese)'}</option>
              <option value="Taiwanese">${t('ocf.langTaiwanese')||'Taiwanese'}</option>
              <option value="Korean">${t('ocf.langKorean')||'Korean'}</option>
              <option value="Vietnamese">${t('ocf.langVietnamese')||'Vietnamese'}</option>
              <option value="Thai">${t('ocf.langThai')||'Thai'}</option>
              <option value="Filipino">${t('ocf.langFilipino')||'Filipino'}</option>
              <option value="Indonesian / Malay">${t('ocf.langIndonesianMalay')||'Indonesian / Malay'}</option>
              <option value="Hindi / Sanskrit">${t('ocf.langHindiSanskrit')||'Hindi / Sanskrit'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupEuropean')||'── European'}">
              <option value="Latin">${t('ocf.langLatin')||'Latin'}</option>
              <option value="French">${t('ocf.langFrench')||'French'}</option>
              <option value="Spanish">${t('ocf.langSpanish')||'Spanish'}</option>
              <option value="Portuguese">${t('ocf.langPortuguese')||'Portuguese'}</option>
              <option value="Italian">${t('ocf.langItalian')||'Italian'}</option>
              <option value="German">${t('ocf.langGerman')||'German'}</option>
              <option value="Dutch / Flemish">${t('ocf.langDutchFlemish')||'Dutch / Flemish'}</option>
              <option value="Nordic / Norse">${t('ocf.langNordicNorse')||'Nordic / Norse'}</option>
              <option value="Celtic / Irish / Welsh">${t('ocf.langCelticIrishWelsh')||'Celtic / Irish / Welsh'}</option>
              <option value="Scottish">${t('ocf.langScottish')||'Scottish'}</option>
              <option value="Russian">${t('ocf.langRussian')||'Russian'}</option>
              <option value="Polish">${t('ocf.langPolish')||'Polish'}</option>
              <option value="Czech / Slovak">${t('ocf.langCzechSlovak')||'Czech / Slovak'}</option>
              <option value="Romanian">${t('ocf.langRomanian')||'Romanian'}</option>
              <option value="Greek">${t('ocf.langGreek')||'Greek'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupAfrican')||'── African'}">
              <option value="Swahili">${t('ocf.langSwahili')||'Swahili'}</option>
              <option value="Yoruba">${t('ocf.langYoruba')||'Yoruba'}</option>
              <option value="Igbo">${t('ocf.langIgbo')||'Igbo'}</option>
              <option value="Zulu / Xhosa">${t('ocf.langZuluXhosa')||'Zulu / Xhosa'}</option>
              <option value="Hausa">${t('ocf.langHausa')||'Hausa'}</option>
              <option value="Ethiopian / Amharic">${t('ocf.langEthiopianAmharic')||'Ethiopian / Amharic'}</option>
              <option value="Egyptian / Arabic">${t('ocf.langEgyptianArabic')||'Egyptian / Arabic'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupMiddleEastern')||'── Middle Eastern'}">
              <option value="Arabic">${t('ocf.langArabic')||'Arabic'}</option>
              <option value="Persian / Farsi">${t('ocf.langPersianFarsi')||'Persian / Farsi'}</option>
              <option value="Turkish">${t('ocf.langTurkish')||'Turkish'}</option>
              <option value="Hebrew">${t('ocf.langHebrew')||'Hebrew'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupAmericas')||'── Americas'}">
              <option value="Native American / Indigenous">${t('ocf.langNativeAmerican')||'Native American / Indigenous'}</option>
              <option value="Aztec / Nahuatl">${t('ocf.langAztecNahuatl')||'Aztec / Nahuatl'}</option>
              <option value="Mayan">${t('ocf.langMayan')||'Mayan'}</option>
              <option value="Quechua / Andean">${t('ocf.langQuechuaAndean')||'Quechua / Andean'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupOceania')||'── Oceania'}">
              <option value="Māori">${t('ocf.langMaori')||'Māori'}</option>
              <option value="Hawaiian">${t('ocf.langHawaiian')||'Hawaiian'}</option>
              <option value="Samoan / Polynesian">${t('ocf.langSamoanPolynesian')||'Samoan / Polynesian'}</option>
              <option value="Aboriginal Australian">${t('ocf.langAboriginalAustralian')||'Aboriginal Australian'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupHistoric')||'── Historic / Ancient'}">
              <option value="Ancient Egyptian">${t('ocf.langAncientEgyptian')||'Ancient Egyptian'}</option>
              <option value="Ancient Greek">${t('ocf.langAncientGreek')||'Ancient Greek'}</option>
              <option value="Ancient Roman">${t('ocf.langAncientRoman')||'Ancient Roman'}</option>
              <option value="Sumerian / Babylonian">${t('ocf.langSumerianBabylonian')||'Sumerian / Babylonian'}</option>
              <option value="Viking / Old Norse">${t('ocf.langVikingNorse')||'Viking / Old Norse'}</option>
              <option value="Medieval European">${t('ocf.langMedievalEuropean')||'Medieval European'}</option>
            </optgroup>
            <optgroup label="${t('ocf.nameGroupCreative')||'── Creative'}">
              <option value="Made-up / Conlang">${t('ocf.langMadeUp')||'Made-up / Conlang'}</option>
              <option value="Phonetically Alien">${t('ocf.langPhoneticAlien')||'Phonetically Alien'}</option>
            </optgroup>
          </select></div>
        <div><div class="form-label">${t('form.gender')||'Gender'}</div>
          <select class="form-select" id="ocf-name-gender">
            <option value="any">${t('ocf.anyGender')||'Any'}</option><option value="masculine">${t('ocf.masculine')||'Masculine'}</option>
            <option value="feminine">${t('ocf.feminine')||'Feminine'}</option><option value="neutral">${t('ocf.neutral')||'Neutral / Unisex'}</option>
          </select></div>
        <div><div class="form-label">${t('form.surname')||'Surname?'}</div>
          <select class="form-select" id="ocf-name-surname">
            <option value="no">${t('ocf.firstNameOnly')||'First name only'}</option><option value="yes">${t('ocf.firstAndSurname')||'First + Surname'}</option>
          </select></div>
        <div><div class="form-label">${t('ocf.variantsMax5')||'Variants (max 5)'}</div>
          <select class="form-select" id="ocf-name-count">
            <option value="1">1</option><option value="2">2</option>
            <option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
          </select></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalOverrides')||'(optional — overrides controls above)'}</span></div>
        <input class="form-input" id="ocf-name-custom" placeholder="${t('ocf.nameCustomPlaceholder')||'e.g. A harsh-sounding demon name with a soft surname…'}">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('name')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genNames')||'Generate Names'}
      </button>
      <div id="ocf-result-name" style="margin-top:16px"></div>`;

    case 'eyes': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('ocf.type')||'Type'}</div>
          <select class="form-select" id="ocf-eyes-type">
            <option value="single">${t('ocf.singleEyeColor')||'Single Eye Color'}</option>
            <option value="both">${t('ocf.bothEyesMatching')||'Both Eyes (matching)'}</option>
            <option value="hetero">${t('ocf.heterochromia')||'Heterochromia'}</option>
          </select></div>
        <div><div class="form-label">${t('ocf.variantsMax5')||'Variants (max 5)'}</div>
          <select class="form-select" id="ocf-eyes-count">
            <option value="1">1</option><option value="2">2</option>
            <option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
          </select></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="ocf-eyes-custom" placeholder="e.g. Glowing eyes that shift color with emotion…">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('eyes')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genEyeColors')||'Generate Eye Colors'}
      </button>
      <div id="ocf-result-eyes" style="margin-top:16px"></div>`;

    case 'hair': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('form.gender')||'Gender'}</div>
          <select class="form-select" id="ocf-hair-gender">
            <option value="any">${t('ocf.anyGender')||'Any'}</option><option value="masculine">${t('ocf.masculine')||'Masculine'}</option>
            <option value="feminine">${t('ocf.feminine')||'Feminine'}</option><option value="androgynous">${t('ocf.androgynous')||'Androgynous'}</option>
          </select></div>
        <div><div class="form-label">${t('ocf.hairLengthLabel')||'Length'}</div>
          <select class="form-select" id="ocf-hair-length">
            <option value="any">${t('ocf.anyGender')||'Any'}</option><option value="short">${t('ocf.hairShort')||'Short'}</option>
            <option value="medium">${t('ocf.hairMedium')||'Medium'}</option><option value="long">${t('ocf.hairLong')||'Long'}</option><option value="extra long">${t('ocf.hairExtraLong')||'Extra Long'}</option>
            <option value="buzzed/shaved">${t('ocf.hairBuzzed')||'Buzzed / Shaved'}</option>
          </select></div>
        <div><div class="form-label">${t('form.colour')||'Color'}</div>
          <select class="form-select" id="ocf-hair-color">
            <option value="any">${t('ocf.anyGender')||'Any'}</option><option value="natural">${t('ocf.hairNatural')||'Natural tones'}</option>
            <option value="vibrant">${t('ocf.hairVibrant')||'Vibrant / Dyed'}</option><option value="pastel">${t('ocf.hairPastel')||'Pastel'}</option>
            <option value="dark">${t('ocf.hairDark')||'Dark / Deep'}</option><option value="white/silver">${t('ocf.hairWhite')||'White / Silver'}</option>
            <option value="multicolor">${t('ocf.hairMulti')||'Multicolor / Gradient'}</option>
          </select></div>
        <div><div class="form-label">${t('ocf.variantsMax5')||'Variants (max 5)'}</div>
          <select class="form-select" id="ocf-hair-count">
            <option value="1">1</option><option value="2">2</option>
            <option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
          </select></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="ocf-hair-custom" placeholder="e.g. Wild unruly hair that defies gravity, deep violet with silver tips…">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('hair')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genHair')||'Generate Hair'}
      </button>
      <div id="ocf-result-hair" style="margin-top:16px"></div>`;

    case 'outfit': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('ocf.genderExpression')||'Gender Expression'}</div>
          <select class="form-select" id="ocf-outfit-gender">
            <option value="any">${t('ocf.anyMixed')||'Any / Mixed'}</option><option value="masculine">${t('ocf.masculine')||'Masculine'}</option>
            <option value="feminine">${t('ocf.feminine')||'Feminine'}</option><option value="androgynous">${t('ocf.androgynous')||'Androgynous'}</option>
          </select></div>
        <div><div class="form-label">${t('ocf.styleVibe')||'Style / Vibe'}</div>
          <select class="form-select" id="ocf-outfit-style">
            <option value="any">${t('ocf.anyGender')||'Any'}</option><option value="casual">${t('ocf.outfitCasual')||'Casual'}</option>
            <option value="formal">${t('ocf.outfitFormal')||'Formal / Elegant'}</option><option value="streetwear">${t('ocf.outfitStreetwear')||'Streetwear'}</option>
            <option value="fantasy/medieval">${t('ocf.outfitFantasy')||'Fantasy / Medieval'}</option><option value="sci-fi/futuristic">${t('ocf.outfitScifi')||'Sci-Fi / Futuristic'}</option>
            <option value="gothic">${t('ocf.outfitGothic')||'Gothic / Dark'}</option><option value="cottagecore">${t('ocf.outfitCottage')||'Cottagecore / Soft'}</option>
            <option value="battle/armored">${t('ocf.outfitBattle')||'Battle / Armored'}</option><option value="school uniform">${t('ocf.outfitSchool')||'School Uniform'}</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="form-label">${t('ocf.shirtTop')||'Shirt / Top'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalHint')||'(optional hint)'}</span></div>
          <input class="form-input" id="ocf-outfit-shirt" placeholder="${t('ocf.outfitShirtPlaceholder')||'e.g. oversized, crop top, hoodie…'}"></div>
        <div><div class="form-label">${t('ocf.pantsBottom')||'Pants / Bottom'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalHint')||'(optional hint)'}</span></div>
          <input class="form-input" id="ocf-outfit-pants" placeholder="${t('ocf.outfitPantsPlaceholder')||'e.g. wide-leg, mini skirt, shorts…'}"></div>
        <div><div class="form-label">${t('ocf.shoes')||'Shoes'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalHint')||'(optional hint)'}</span></div>
          <input class="form-input" id="ocf-outfit-shoes" placeholder="${t('ocf.outfitShoesPlaceholder')||'e.g. platform boots, barefoot…'}"></div>
        <div><div class="form-label">${t('ocf.accessories')||'Accessories'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalHint')||'(optional hint)'}</span></div>
          <input class="form-input" id="ocf-outfit-acc" placeholder="${t('ocf.outfitAccPlaceholder')||'e.g. choker, rings, cape…'}"></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optionalOverridesAll')||'(optional — overrides all above)'}</span></div>
        <input class="form-input" id="ocf-outfit-custom" placeholder="${t('ocf.outfitCustomPlaceholder')||'e.g. A villain dressed in tattered finery with gold accents…'}">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('outfit')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genOutfit')||'Generate Outfit'}
      </button>
      <div id="ocf-result-outfit" style="margin-top:16px"></div>`;

    case 'species': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('ocf.type')||'Category'}</div>
          <select class="form-select" id="ocf-species-cat">
            <option value="any">${t('ocf.anySurprise')||'Any / Surprise me'}</option>
            ${speciesKeys.filter(k => k !== 'Fae — Court').map(k=>`<option value="${escAttr(k)}">${escHTML(ocfSpeciesLabel(k))}</option>`).join('')}
          </select></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="ocf-species-custom" placeholder="${t('ocf.speciesCustomPlaceholder')||'e.g. A deep-sea creature that can take humanoid form…'}">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('species')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genSpecies')||'Generate Species'}
      </button>
      <div id="ocf-result-species" style="margin-top:16px"></div>`;

    case 'traits': return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('ocf.variantsMax5')||'Variants (max 5)'}</div>
          <select class="form-select" id="ocf-traits-count">
            <option value="1">1</option><option value="2">2</option>
            <option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
          </select></div>
        <div><div class="form-label">${t('ocf.tone')||'Tone'}</div>
          <select class="form-select" id="ocf-traits-tone">
            <option value="any">${t('ocf.toneAny')||'Any mix'}</option><option value="positive">${t('ocf.tonePositive')||'Mostly positive'}</option>
            <option value="negative">${t('ocf.toneFlaws')||'Mostly flaws'}</option><option value="complex">${t('ocf.toneComplex')||'Complex / contradictory'}</option>
            <option value="dark">${t('ocf.toneDark')||'Dark / morally grey'}</option>
          </select></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="form-label">${t('ocf.customPrompt')||'Custom Prompt'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="ocf-traits-custom" placeholder="${t('ocf.traitsCustomPlaceholder')||'e.g. Traits for a villain who genuinely believes they\'re the hero…'}">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ocfGenerate('traits')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${t('ocf.genTraits')||'Generate Traits'}
      </button>
      <div id="ocf-result-traits" style="margin-top:16px"></div>`;

    case 'full': return `
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.7">
        ${t('ocf.fullDesc')||'Generates a complete character snapshot — name, species, eye color, hair, outfit, and a set of traits — all in one shot. Set a gender or leave it random. Add a custom concept to steer the whole generation.'}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
        <div><div class="form-label">${t('form.gender')||'Gender'}</div>
          <select class="form-select" id="ocf-full-gender">
            <option value="random">${t('ocf.randomGender')||'Random'}</option><option value="masculine">${t('ocf.masculine')||'Masculine'}</option>
            <option value="feminine">${t('ocf.feminine')||'Feminine'}</option><option value="neutral">${t('ocf.neutralNonbinary')||'Neutral / Nonbinary'}</option>
          </select></div>
      </div>
      <div style="margin-bottom:14px">
        <div class="form-label">${t('ocf.conceptDirection')||'Concept / Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="ocf-full-custom" placeholder="${t('ocf.fullOcCustomPlaceholder')||'e.g. A brooding sea demon with a soft side, pirate aesthetic…'}">
      </div>
      <button class="btn btn-primary" style="display:flex;align-items:center;gap:8px" onclick="ocfGenerate('full')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${t('ocf.genFullOC')||'Generate Full OC'}
      </button>
      <div id="ocf-result-full" style="margin-top:16px"></div>`;

    default: return '';
  }
}

/* ── Build prompts ── */
function ocfBuildPrompt(section) {
  const v = id => document.getElementById(id)?.value || '';
  const custom = v(`ocf-${section}-custom`);

  if (section === 'name') {
    if (custom) return `Generate ${v('ocf-name-count')} unique character names. ${custom}. ${v('ocf-name-surname')==='yes'?'Include a surname for each.':'First name only.'} Return ONLY a numbered list of names, nothing else.`;
    const lang = v('ocf-name-lang') ? `Use ${v('ocf-name-lang')} naming conventions and phonetics.` : '';
    return `Generate ${v('ocf-name-count')} unique fictional character names. Style/vibe: ${v('ocf-name-style')}. Gender feel: ${v('ocf-name-gender')}. ${lang} ${v('ocf-name-surname')==='yes'?'Include a surname for each.':'First name only.'} Return ONLY a numbered list of names, no explanations.`;
  }

  if (section === 'eyes') {
    const type = v('ocf-eyes-type');
    if (type === 'hetero') {
      if (custom) return `Generate ${v('ocf-eyes-count')} heterochromia eye color combinations for a fictional character. ${custom}.
For each variant use EXACTLY this format:
VARIANT [number]: [combination name]
LEFT: [left eye description]
RIGHT: [right eye description]

Repeat for each variant. No other text.`;
      return `Generate ${v('ocf-eyes-count')} creative heterochromia eye color combinations for a fictional character. Be vivid — include texture, shimmer, glow, or fantasy effects.
Use EXACTLY this format for each variant:
VARIANT [number]: [evocative combination name]
LEFT: [left eye description, 1-2 sentences]
RIGHT: [right eye description, 1-2 sentences]

Repeat the VARIANT/LEFT/RIGHT block for each variant. No separator lines. No other text.`;
    }
    if (custom) return `Generate ${v('ocf-eyes-count')} unique fictional eye color descriptions for a character. ${custom}. Return ONLY a numbered list, one per line, no explanations.`;
    const typeDesc = type==='both' ? 'both eyes the same color (describe the color vividly)' : 'a single eye color';
    return `Generate ${v('ocf-eyes-count')} creative fictional eye color descriptions with ${typeDesc}. Be vivid — include texture, shimmer, or glow if fitting. Return ONLY a numbered list, one short description per line, no explanations.`;
  }

  if (section === 'hair') {
    if (custom) return `Generate ${v('ocf-hair-count')} unique hair descriptions for a fictional character. ${custom}. Each should include color AND style (e.g. mullet, pixie, bob, waves, braids). Return ONLY a numbered list, one per line.`;
    const hairGender = v('ocf-hair-gender');
    const genderHint = hairGender === 'any' ? '' : ` Gender expression: ${hairGender} — bias the style choices accordingly (e.g. masculine = undercuts, fades, slicked back, mullets; feminine = buns, braids, curls; androgynous = any).`;
    return `Generate ${v('ocf-hair-count')} unique hair descriptions for a fictional character.${genderHint} Length: ${v('ocf-hair-length')}. Color palette: ${v('ocf-hair-color')}. Each result MUST include both the hair color AND a specific style name (e.g. tousled mullet, sleek bob, messy bun, twin braids). Return ONLY a numbered list, one per line, no explanations.`;
  }

  if (section === 'outfit') {
    if (custom) return `Describe a complete outfit for a fictional character: ${custom}. Include shirt/top, pants/bottom, shoes, and accessories. Be specific with materials, colors, and details. Return as a single cohesive outfit description.`;
    const parts = [
      v('ocf-outfit-shirt') ? `Top hint: ${v('ocf-outfit-shirt')}` : '',
      v('ocf-outfit-pants') ? `Bottom hint: ${v('ocf-outfit-pants')}` : '',
      v('ocf-outfit-shoes') ? `Shoes hint: ${v('ocf-outfit-shoes')}` : '',
      v('ocf-outfit-acc')   ? `Accessories hint: ${v('ocf-outfit-acc')}` : '',
    ].filter(Boolean).join('. ');
    return `Design a complete outfit for a fictional character. Gender expression: ${v('ocf-outfit-gender')}. Style/vibe: ${v('ocf-outfit-style')}. ${parts}. Describe the shirt/top, pants/skirt/bottom, shoes, and accessories specifically. Include colors, materials, and small details. Return as a flowing descriptive paragraph.`;
  }

  if (section === 'species') {
    const cat = v('ocf-species-cat');
    if (custom) return `Create a unique fictional species or subspecies for a character. ${custom}. Give it a name and 2-3 sentences of flavor description covering what makes them unique. Return: Name on first line, then the description.`;
    const catHint = cat === 'any' ? 'any category (be creative)' : cat;
    return `Create a unique fictional species or subspecies in the category: ${catHint}. Give it an evocative name and 2-3 sentences describing what makes them distinct — their nature, abilities, or lore. Return: the species name on the first line, then the description below it.`;
  }

  if (section === 'traits') {
    if (custom) return `Generate ${v('ocf-traits-count')} personality traits for a fictional character. ${custom}. Return ONLY a numbered list of single-word or short-phrase traits, nothing else.`;
    return `Generate ${v('ocf-traits-count')} personality traits for a fictional character. Tone: ${v('ocf-traits-tone')}. Mix strengths and flaws naturally. Return ONLY a numbered list of concise trait names (1-4 words each), no explanations.`;
  }

  if (section === 'full') {
    const gender = v('ocf-full-gender') === 'random' ? pickRandom(['masculine','feminine','neutral']) : v('ocf-full-gender');
    const concept = v('ocf-full-custom');
    return `Create a complete fictional character profile. Gender expression: ${gender}. ${concept ? 'Concept: ' + concept + '.' : ''}
Return your response in EXACTLY this format with these exact headers:

NAME: [character name and surname]
SPECIES: [species name]
EYES: [eye color description]
HAIR: [hair color and style]
OUTFIT: [one sentence outfit description]
TRAITS: [3-5 traits separated by commas]
CONCEPT: [2-3 sentence backstory/personality hook]

Do not add any other text outside this format.`;
  }

  return '';
}

/* ── Generate ── */
async function ocfGenerate(section) {
  const resultEl = document.getElementById(`ocf-result-${section}`);
  if (!resultEl) return;

  const ok = await ollamaCheck();
  if (!ok) {
    resultEl.innerHTML = ocfErrorHTML('Ollama is not running. Start it and make sure a model is pulled.');
    return;
  }

  const prompt = ocfBuildPrompt(section);
  const useStream = settings.aiStreaming !== false; // default true
  const extra = section === 'eyes' ? (document.getElementById('ocf-eyes-type')?.value || '') : '';

  if (useStream) {
    // Show live stream box
    resultEl.innerHTML = ocfStreamHTML(section);
    const liveEl = document.getElementById('ocf-stream-live');
    const statusEl = document.getElementById('ocf-stream-status');
    let raw = '';
    try {
      raw = await aiGenerateStream(prompt, (token, full) => {
        if (!liveEl) return;
        liveEl.textContent = full;
        liveEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      if (statusEl) statusEl.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Done — formatting…</span>`;
      // Small pause so user sees the "Done" state before it renders
      await new Promise(r => setTimeout(r, 280));
      resultEl.innerHTML = ocfRenderResult(section, raw.trim(), extra);
    } catch(e) {
      resultEl.innerHTML = ocfErrorHTML(e.message);
    }
  } else {
    resultEl.innerHTML = ocfLoadingHTML();
    try {
      const raw = await aiGenerate(prompt);
      resultEl.innerHTML = ocfRenderResult(section, raw.trim(), extra);
    } catch(e) {
      resultEl.innerHTML = ocfErrorHTML(e.message);
    }
  }
}

function ocfStreamHTML(section) {
  const model = settings.ollamaModel || 'mistral';
  return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg3)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" style="animation:spin 1s linear infinite;flex-shrink:0"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:.5px;font-family:'Cinzel',serif">CHARACTRY AI</span>
        <span style="font-size:10px;color:var(--text3);margin-left:2px">· ${escHTML(model)}</span>
        <div id="ocf-stream-status" style="display:flex;align-items:center;gap:5px;margin-left:auto;font-size:11px;color:var(--text3)">
          <span>${t('common.generating')||'Generating'}</span><span style="animation:aiPulse .6s infinite alternate">▮</span>
        </div>
      </div>
      <div id="ocf-stream-live" style="padding:16px;font-size:13px;color:var(--text2);line-height:1.9;white-space:pre-wrap;min-height:60px;font-family:'Nunito',sans-serif;max-height:400px;overflow-y:auto"></div>
    </div>`;
}

function ocfLoadingHTML() {
  return `<div style="display:flex;align-items:center;gap:10px;padding:14px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" style="animation:spin 1s linear infinite;flex-shrink:0">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    <span style="font-size:13px;color:var(--text2)">${t('common.generatingWith')||'Generating with'} <b>${settings.ollamaModel||'mistral'}</b>…</span>
  </div>`;
}

function ocfErrorHTML(msg) {
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:14px;background:#1a0a0a;border:1px solid #ef444455;border-radius:10px">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span style="font-size:12px;color:#f87171;line-height:1.6">${escHTML(msg)}</span>
  </div>`;
}

function ocfRenderResult(section, raw, extra) {
  if (section === 'full') return ocfRenderFullOC(raw);

  // Heterochromia — grouped card per variant
  if (section === 'eyes' && extra === 'hetero') {
    // Split the raw text into blocks by VARIANT N: header
    const blocks = raw.split(/(?=VARIANT\s*\d+:)/i).map(b => b.trim()).filter(Boolean);
    if (!blocks.length) return ocfRawResult(raw);

    const cards = blocks.map(block => {
      // Title: everything after "VARIANT N:"
      const titleM = block.match(/VARIANT\s*\d+:\s*(.+)/i);
      // LEFT: capture everything from LEFT: up to RIGHT: (multiline)
      const leftM  = block.match(/LEFT:\s*([\s\S]+?)(?=RIGHT:|$)/i);
      // RIGHT: capture everything from RIGHT: to end of block
      const rightM = block.match(/RIGHT:\s*([\s\S]+?)$/i);
      if (!titleM && !leftM && !rightM) return null;
      const title = titleM ? titleM[1].trim() : 'Heterochromia';
      const left  = leftM  ? leftM[1].trim()  : '';
      const right = rightM ? rightM[1].trim()  : '';
      if (!left && !right) return null;
      const allText = [title, left ? 'Left: ' + left : '', right ? 'Right: ' + right : ''].filter(Boolean).join('\n');
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border);background:var(--bg3)">
          <span style="font-size:13px;font-weight:700;color:var(--accent)">${escHTML(title)}</span>
          <button class="btn btn-ghost" style="padding:2px 9px;font-size:11px;flex-shrink:0" onclick="copyText(${JSON.stringify(allText)})">${t('common.copy')||'Copy'}</button>
        </div>
        ${left ? `<div style="padding:10px 16px;border-bottom:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">${t('ocf.leftEye')||'Left Eye'}</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.7">${escHTML(left)}</div>
        </div>` : ''}
        ${right ? `<div style="padding:10px 16px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">${t('ocf.rightEye')||'Right Eye'}</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.7">${escHTML(right)}</div>
        </div>` : ''}
      </div>`;
    }).filter(Boolean);
    if (!cards.length) return ocfRawResult(raw);
    return `<div style="display:flex;flex-direction:column;gap:10px">${cards.join('')}</div>`;
  }

  // Standard numbered list (name, eyes non-hetero, hair, traits)
  if (['name','eyes','hair','traits'].includes(section)) {
    const lines = raw.split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/,'').trim())
      .filter(l => l.length > 2);
    if (!lines.length) return ocfRawResult(raw);
    return `<div style="display:flex;flex-direction:column;gap:8px">
      ${lines.map(l=>`
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:11px 16px">
          <span style="font-size:14px;font-weight:600;color:var(--text)">${escHTML(l)}</span>
          <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;flex-shrink:0;margin-left:10px" onclick="copyText('${escAttr(l)}')">${t('common.copy')||'Copy'}</button>
        </div>`).join('')}
    </div>`;
  }

  // Species and outfit — single block result
  return ocfRawResult(raw);
}

function ocfRawResult(raw) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px">
    <div style="font-size:13px;color:var(--text);line-height:1.8;white-space:pre-wrap">${escHTML(raw)}</div>
    <button class="btn btn-ghost" style="margin-top:10px;padding:3px 10px;font-size:11px" onclick="copyText(${JSON.stringify(raw)})">${t('common.copyAll')||'Copy All'}</button>
  </div>`;
}

function ocfRenderFullOC(raw) {
  // Parse the structured format
  const get = key => {
    const m = raw.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const name    = get('NAME');
  const species = get('SPECIES');
  const eyes    = get('EYES');
  const hair    = get('HAIR');
  const outfit  = get('OUTFIT');
  const traits  = get('TRAITS');
  const concept = raw.match(/CONCEPT:\s*([\s\S]+?)(?=\n[A-Z]+:|$)/i)?.[1]?.trim();

  // Fallback to raw if parsing failed
  if (!name && !species) return ocfRawResult(raw);

  const row = (icon, label, val, col='var(--text)') => val ? `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><path d="${icon}"/></svg>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;font-weight:700;margin-bottom:2px">${label}</div>
        <div style="font-size:13px;color:${col};font-weight:600">${escHTML(val)}</div>
      </div>
      <button class="btn btn-ghost" style="padding:2px 8px;font-size:10px;flex-shrink:0" onclick="copyText('${escAttr(val)}')">${t('common.copy')||'Copy'}</button>
    </div>` : '';

  const traitTags = traits ? traits.split(',').map(t=>t.trim()).filter(Boolean)
    .map(t=>`<span class="tag" style="color:var(--accent);border-color:var(--accent);padding:4px 12px">${escHTML(t)}</span>`).join('') : '';

  return `<div class="card" style="background:var(--bg2);border:1.5px solid var(--accent)">
    <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:14px">${escHTML(name||'Generated OC')}</div>
    ${row('M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z',t('ocf.speciesLabel')||'Species',species,'var(--accent)')}
    ${row('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',t('ocf.eyeColorLabel')||'Eye Color',eyes,'var(--text)')}
    ${row('M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10',t('ocf.hairLabel')||'Hair',hair,'var(--text)')}
    ${row('M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z',t('ocf.outfitLabel')||'Outfit',outfit,'var(--text)') }
    ${traits ? `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:10px;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;font-weight:700;margin-bottom:8px">${t('ocf.traitsLabel')||'Traits'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${traitTags}</div>
    </div>` : ''}
    ${concept ? `<div style="padding:10px 0">
      <div style="font-size:10px;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;font-weight:700;margin-bottom:6px">${t('ocf.conceptLabel')||'Concept'}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.8">${escHTML(concept)}</div>
    </div>` : ''}
    <button class="btn btn-ghost" style="margin-top:8px;font-size:11px" onclick="copyText(${JSON.stringify(raw)})">${t('common.copyAll')||'Copy All'}</button>
  </div>`;
}

/* ═══════════════════════════════════════════════
   AI STUDIO — AU WEAVER
═══════════════════════════════════════════════ */

const AUW_GENRES = [
  { group: '✦ Fantasy & Folklore', options: [
    'High Fantasy','Dark Fantasy','Fairy Tale Retelling','Mythology & Legend',
    'Fae Realm','Sword & Sorcery','Isekai / Portal Fantasy','Cultivation / Xianxia',
    'Wuxia','Gothic Fantasy','Cozy Fantasy','Grimdark','Magical Realism',
  ]},
  { group: '✦ Sci-Fi & Futuristic', options: [
    'Space Opera','Cyberpunk','Post-Apocalyptic','Dystopia','Solarpunk',
    'Biopunk','Mecha / Giant Robots','Hard Sci-Fi','Alien First Contact',
    'Time Travel','Parallel Dimensions','AI Uprising','Generation Ship',
  ]},
  { group: '✦ Modern & Contemporary', options: [
    'Slice of Life','Contemporary Drama','Found Family','College / Academy',
    'Celebrity & Idol Industry','Underground Scene','Secret Society',
    'Small Town Mystery','Big City Hustle','Sports Rivalry','Heist Crew',
  ]},
  { group: '✦ Horror & Thriller', options: [
    'Psychological Horror','Supernatural Horror','Cosmic Horror / Eldritch',
    'Gothic Horror','Survival Horror','Body Horror','Cult & Paranoia',
    'True Crime Thriller','Paranormal Investigation','Haunted House',
  ]},
  { group: '✦ Historical & Period', options: [
    'Victorian Era','Feudal Japan / Edo Period','Ancient Rome','Ancient Egypt',
    'Pirate Golden Age','Wild West','Warring States China','Medieval Europe',
    'Renaissance','Roaring Twenties','Cold War Espionage','WWII Resistance',
  ]},
  { group: '✦ Romance & Drama', options: [
    'Enemies to Lovers','Rivals to Lovers','Fake Dating','Slow Burn',
    'Forbidden Love','Second Chance Romance','Royal & Commoner',
    'Arranged Marriage','Star-Crossed','Love Triangle','Hurt / Comfort',
  ]},
  { group: '✦ Action & Adventure', options: [
    'Bounty Hunters','Assassin Underground','Monster Hunting Guild',
    'Revolutionary War','Heist Syndicate','Road Trip','Survival Island',
    'Gladiatorial Arena','Sky Pirates','Treasure Hunt',
  ]},
  { group: '✦ Genre Mashups', options: [
    'Romantic Fantasy','Sci-Fi Horror','Historical Fantasy','Dark Romance',
    'Cozy Mystery','Paranormal Romance','Dystopian Romance','Cosmic Horror Comedy',
    'Slice-of-Life Fantasy','Action Romance',
  ]},
];

/* Maps AUW group names to translated display labels at render time */
function auwGroupLabel(group) {
  const map = {
    '✦ Fantasy & Folklore':    t('aiTool.auwGroupFantasy')||'✦ Fantasy & Folklore',
    '✦ Sci-Fi & Futuristic':   t('aiTool.auwGroupScifi')||'✦ Sci-Fi & Futuristic',
    '✦ Modern & Contemporary': t('aiTool.auwGroupModern')||'✦ Modern & Contemporary',
    '✦ Horror & Thriller':     t('aiTool.auwGroupHorror')||'✦ Horror & Thriller',
    '✦ Historical & Period':   t('aiTool.auwGroupHistorical')||'✦ Historical & Period',
    '✦ Romance & Drama':       t('aiTool.auwGroupRomance')||'✦ Romance & Drama',
    '✦ Action & Adventure':    t('aiTool.auwGroupAction')||'✦ Action & Adventure',
    '✦ Genre Mashups':         t('aiTool.auwGroupMashup')||'✦ Genre Mashups',
  };
  return map[group] || group;
}

let _auw = {
  genreGroup: '',
  genre: '',
  charId: '',
  depth: 'full',
};

function renderAIAUWeaver() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;

  const charOptions = characters.length
    ? characters.map(c => `<option value="${c.id}">${escHTML(c.name)}${c.species ? ' · ' + escHTML(c.species) : ''}</option>`).join('')
    : `<option value="" disabled>${t('aiTool.noCharsYet')||'No characters yet — add some first!'}</option>`;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">

      <div class="card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiTool.auwTitle')||'⟳ AU Weaver'}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:18px">
          ${t('aiTool.auwDesc')||'Pick a genre and a character. The AI reads their traits, species, personality, backstory — and builds a fully tailored Alternate Universe concept around them specifically.'}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div class="form-label">${t('aiTool.auwGenreCategory')||'Genre Category'}</div>
              <select class="form-select" id="auw-genre-group" onchange="auwSyncGenre(this.value)">
                <option value="">${t('aiTool.auwPickCategory')||'— Pick a category —'}</option>
                ${AUW_GENRES.map(g=>`<option value="${escAttr(g.group)}">${escHTML(auwGroupLabel(g.group))}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="form-label">${t('aiTool.auwGenreSetting')||'Genre / Setting'}</div>
              <select class="form-select" id="auw-genre" onchange="_auw.genre=this.value">
                <option value="">${t('aiTool.auwPickCategoryFirst')||'— Pick a category first —'}</option>
              </select>
            </div>
          </div>

          <div>
            <div class="form-label">${t('aiTool.characterOptional')||'Character'}</div>
            <select class="form-select" id="auw-char" onchange="_auw.charId=this.value">
              <option value="">${t('aiTool.pickChar')||'— Pick a character —'}</option>
              ${charOptions}
            </select>
          </div>

          <div>
            <div class="form-label">${t('aiTool.auwOutputDepth')||'Output Depth'}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="auw-depth-btns">
              ${[
                ['quick',   t('aiTool.auwQuickLabel')||'⚡ Quick Concept',  t('aiTool.auwQuickDesc')||'Core premise + a few key beats'],
                ['full',    t('aiTool.auwFullLabel')||'✦ Full Breakdown',   t('aiTool.auwFullDesc')||'Premise, tone, conflict, role, world details, plot hooks'],
                ['chapter', t('aiTool.auwChapterLabel')||'✎ Opening Scene', t('aiTool.auwChapterDesc')||'Full breakdown + a short narrative opening scene'],
              ].map(([val, label, desc]) => `
                <div onclick="auwSetDepth('${val}')" data-depth="${val}"
                  style="flex:1;min-width:160px;cursor:pointer;border-radius:10px;padding:10px 14px;
                    border:1.5px solid ${_auw.depth===val?'var(--accent)':'var(--border)'};
                    background:${_auw.depth===val?'var(--accent-glow)':'var(--bg2)'};
                    transition:all .15s">
                  <div style="font-size:12px;font-weight:700;color:${_auw.depth===val?'var(--accent)':'var(--text)'};margin-bottom:3px">${label}</div>
                  <div style="font-size:11px;color:var(--text3);line-height:1.5">${desc}</div>
                </div>`).join('')}
            </div>
          </div>

          <div>
            <div class="form-label">${t('aiTool.extraDirection')||'Extra Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
            <input class="form-input" id="auw-extra" placeholder="${t('aiTool.auwExtraPlaceholder')||'e.g. Make it a slow burn enemies-to-lovers, add a mentor figure, lean into tragedy…'}">
          </div>

          <button class="btn btn-primary" style="display:flex;align-items:center;gap:8px;align-self:flex-start" onclick="auwGenerate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('aiTool.auwBtn')||'Weave AU'}
          </button>
        </div>
      </div>

      <div id="auw-result"></div>
    </div>`;
}

function auwSyncGenre(groupLabel) {
  _auw.genreGroup = groupLabel;
  _auw.genre = '';
  const sel = document.getElementById('auw-genre');
  if (!sel) return;
  const group = AUW_GENRES.find(g => g.group === groupLabel);
  if (!group) { sel.innerHTML = `<option value="">${t('aiTool.auwPickCategoryFirst')||'— Pick a category first —'}</option>`; return; }
  sel.innerHTML = `<option value="">${t('aiTool.auwPickGenre')||'— Pick a genre —'}</option>` +
    group.options.map(o => `<option value="${escAttr(o)}">${escHTML(o)}</option>`).join('');
}

function auwSetDepth(val) {
  _auw.depth = val;
  document.querySelectorAll('[data-depth]').forEach(el => {
    const active = el.dataset.depth === val;
    el.style.borderColor  = active ? 'var(--accent)' : 'var(--border)';
    el.style.background   = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.querySelector('div').style.color = active ? 'var(--accent)' : 'var(--text)';
  });
}

function auwBuildCharSummary(char) {
  // Build a readable relationships string
  let relsStr = null;
  if (char.relationships && char.relationships.length) {
    relsStr = char.relationships
      .map(r => {
        const name = r.targetName || r.targetId;
        const target = r.targetId ? characters.find(c => c.id === r.targetId) : null;
        const targetSpecies = target?.species ? ` (${target.species})` : '';
        const notes = r.notes ? ` — "${r.notes}"` : '';
        return `${r.type} with ${name}${targetSpecies}${notes}`;
      }).join('; ');
  }

  const fields = [
    ['Name',        char.name],
    ['Species',     char.species],
    ['Age',         char.age],
    ['Gender',      char.gender],
    ['Pronouns',    char.pronouns],
    ['Alignment',   char.alignment],
    ['Occupation',  char.occupation],
    ['Hair',        char.hair],
    ['Eyes',        char.eyes],
    ['Body Type',   char.bodytype],
    ['Skin / Complexion', char.skin],
    ['Distinguishing Features', char.features],
    ['Outfit / Style', char.outfit],
    ['Traits',      [char.traits, char.personalityDesc].filter(Boolean).join('\n')],
    ['Strengths',   char.strengths],
    ['Weaknesses',  char.weaknesses],
    ['Likes',       char.likes],
    ['Dislikes',    char.dislikes],
    ['Habits',      char.habits],
    ['Abilities',   char.abilities],
    ['Relationships', relsStr],
    ['Backstory',   char.backstory ? char.backstory.slice(0, 500) + (char.backstory.length > 500 ? '…' : '') : null],
    ['Quotes',      char.quotes ? char.quotes.slice(0, 200) : null],
  ].filter(([, v]) => v && String(v).trim());
  return fields.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function auwBuildPrompt(char, genre, depth, extra) {
  const charBlock = auwBuildCharSummary(char);
  const extraLine = extra ? `\nExtra direction from the author: ${extra}` : '';

  const appearanceNote = `AU APPEARANCE: [Describe how ${char.name} looks in this AU. Consider whether their original appearance translates literally, gets reinterpreted (e.g. dragon scales → tattoos, sharp teeth → sharp fashion), or changes entirely to fit the setting. Be specific: hair, eyes, clothing style, any standout physical details.]`;

  const baseInstructions = {
    quick: `Write a punchy 3-4 sentence AU concept. Include: a vivid setting description, how this character fits into it, what they look like in this AU, and one compelling hook or conflict.`,
    full: `Write a full AU breakdown with clearly labeled sections:
AU TITLE: [creative title]
PREMISE: [2-3 sentences — the world and the character's place in it]
TONE: [the emotional/narrative tone]
SETTING: [the world, era, or environment in detail]
CHARACTER ROLE: [who ${char.name} is in this AU — their position, arc, and how their traits translate]
${appearanceNote}
CORE CONFLICT: [the central dramatic tension]
PLOT HOOKS: [3 compelling story hooks, as a numbered list]
WORLD DETAIL: [one unique and specific detail about this AU's world that makes it feel alive]`,
    chapter: `Write a full AU breakdown AND a short opening scene.

First, the breakdown with clearly labeled sections:
AU TITLE: [creative title]
PREMISE: [2-3 sentences]
TONE: [the emotional/narrative tone]
SETTING: [the world, era, or environment]
CHARACTER ROLE: [who ${char.name} is in this AU]
${appearanceNote}
CORE CONFLICT: [the central dramatic tension]
PLOT HOOKS: [3 story hooks, numbered list]
WORLD DETAIL: [one vivid world-specific detail]

Then:
OPENING SCENE:
[Write a 150-200 word opening scene featuring ${char.name} in this AU. Third person. Atmospheric. Weave in their AU appearance naturally. Drop us right into the world.]`,
  };

  return `You are a creative writing assistant for a character creator app called Charactry.

Here is a character:
${charBlock}

Genre / AU type requested: ${genre}${extraLine}

${baseInstructions[depth] || baseInstructions.full}

Write only the AU content. No preamble, no meta-commentary. Be specific — use details from the character's actual traits, species, appearance, and backstory to make this AU feel personally crafted for them.`;
}

async function auwGenerate() {
  const genre  = (document.getElementById('auw-genre')?.value || '').trim();
  const charId = document.getElementById('auw-char')?.value || '';
  const extra  = (document.getElementById('auw-extra')?.value || '').trim();
  const depth  = _auw.depth || 'full';
  const resultEl = document.getElementById('auw-result');
  if (!resultEl) return;

  if (!genre) { toast('Pick a genre first!'); return; }
  if (!charId) { toast('Pick a character first!'); return; }
  let char = characters.find(c => c.id === charId);
  if (!char) { toast('Character not found.'); return; }
  char = await charMergeFromFile(char);

  const ok = await ollamaCheck();
  if (!ok) { resultEl.innerHTML = ocfErrorHTML('Ollama is not running. Start it and make sure a model is pulled.'); return; }

  const prompt = auwBuildPrompt(char, genre, depth, extra);
  const useStream = settings.aiStreaming !== false;

  if (useStream) {
    resultEl.innerHTML = ocfStreamHTML('auweaver');
    const liveEl  = document.getElementById('ocf-stream-live');
    const statEl  = document.getElementById('ocf-stream-status');
    let raw = '';
    try {
      raw = await aiGenerateStream(prompt, (token, full) => {
        if (liveEl) { liveEl.textContent = full; liveEl.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
      });
      if (statEl) statEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>Done — rendering…</span>`;
      await new Promise(r => setTimeout(r, 280));
      resultEl.innerHTML = auwRenderResult(char, genre, depth, raw.trim());
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  } else {
    resultEl.innerHTML = ocfLoadingHTML();
    try {
      const raw = await aiGenerate(prompt);
      resultEl.innerHTML = auwRenderResult(char, genre, depth, raw.trim());
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  }
}

function auwRenderResult(char, genre, depth, raw) {
  // Try to parse labeled sections for full/chapter depth
  const get = (key) => {
    const m = raw.match(new RegExp(`${key}:\\s*([\\s\\S]+?)(?=\\n[A-Z ]+:|$)`, 'i'));
    return m ? m[1].trim() : null;
  };

  const title      = get('AU TITLE') || `${genre} AU`;
  const premise    = get('PREMISE');
  const tone       = get('TONE');
  const setting    = get('SETTING');
  const role       = get('CHARACTER ROLE');
  const appearance = get('AU APPEARANCE');
  const conflict   = get('CORE CONFLICT');
  const world      = get('WORLD DETAIL');
  const scene      = get('OPENING SCENE');

  // Plot hooks — grab numbered list items
  const hooksRaw = get('PLOT HOOKS') || '';
  const hooks = hooksRaw.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/,'').trim()).filter(l => l.length > 4);

  const hasStructure = premise || tone || setting || role;

  // Avatar / char pill
  const avatarHTML = char.avatar
    ? `<img src="${char.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--accent);flex-shrink:0">${escHTML((char.name||'?')[0])}</div>`;

  const infoRow = (label, val) => val ? `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
      <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">${label}</div>
      <div style="font-size:13px;color:var(--text);line-height:1.6">${escHTML(val)}</div>
    </div>` : '';

  const copyAll = () => resultEl ? '' : '';

  return `
    <div class="card" style="border-left:3px solid var(--accent)">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:0">
          <div style="font-family:'Cinzel',serif;font-size:20px;font-weight:700;color:var(--accent);margin-bottom:6px">${escHTML(title)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${avatarHTML}
            <div style="font-size:12px;color:var(--text2)">
              <b>${escHTML(char.name)}</b>${char.species ? ` · <span style="color:var(--text3)">${escHTML(char.species)}</span>` : ''}
            </div>
            <span class="tag" style="background:var(--accent-glow);color:var(--accent);border-color:var(--accent)">${escHTML(genre)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" onclick="copyText(${JSON.stringify(raw)})">${t('aiTool.copyRaw')||'Copy Raw'}</button>
          <span id="auw-save-data" data-name="${escAttr(title)}" data-desc="${escAttr((premise||raw).slice(0,400))}" style="display:none"></span>
          <button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="auwSaveUniverseFromEl()">${t('aiTool.saveAsUniverse')||'✦ Save as Universe'}</button>
        </div>
      </div>

      ${hasStructure ? `
        <!-- Premise block -->
        ${premise ? `<div style="font-size:13px;color:var(--text2);line-height:1.8;margin-bottom:16px;padding:14px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">${escHTML(premise)}</div>` : ''}

        <!-- Info grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:${hooks.length||scene?'16px':'0'}">
          ${infoRow(t('aiTool.tone')||'Tone', tone)}
          ${infoRow(t('aiTool.setting')||'Setting', setting)}
          ${infoRow(t('aiTool.coreConflict')||'Core Conflict', conflict)}
          ${infoRow(t('aiTool.worldDetail')||'World Detail', world)}
        </div>

        <!-- Character role -->
        ${role ? `
        <div style="background:var(--accent-glow);border:1px solid var(--accent);border-radius:10px;padding:12px 16px;margin-bottom:${appearance||hooks.length||scene?'16px':'0'}">
          <div style="font-size:10px;font-weight:800;color:var(--accent);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px">✦ ${escHTML(char.name)}${t('aiTool.auwCharRole')||"'s Role"}</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.7">${escHTML(role)}</div>
        </div>` : ''}

        <!-- AU Appearance -->
        ${appearance ? `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:${hooks.length||scene?'16px':'0'}">
          <div style="padding:10px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase">${t('aiTool.auAppearance')||'AU Appearance'}</div>
            <button class="btn btn-ghost" style="padding:2px 9px;font-size:11px;margin-left:auto" onclick="copyText(${JSON.stringify(appearance)})">${t('common.copy')||'Copy'}</button>
          </div>
          <div style="padding:12px 16px;font-size:13px;color:var(--text2);line-height:1.8">${escHTML(appearance)}</div>
        </div>` : ''}

        <!-- Plot hooks -->
        ${hooks.length ? `
        <div style="margin-bottom:${scene?'16px':'0'}">
          <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">${t('aiTool.plotHooks')||'Plot Hooks'}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${hooks.map((h,i)=>`
            <div style="display:flex;gap:10px;align-items:flex-start;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
              <span style="font-size:12px;font-weight:800;color:var(--accent);flex-shrink:0;margin-top:1px">${i+1}</span>
              <span style="font-size:13px;color:var(--text2);line-height:1.6">${escHTML(h)}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Opening scene -->
        ${scene ? `
        <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="padding:10px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase">${t('aiTool.openingSceneLabel')||'✎ Opening Scene'}</div>
            <button class="btn btn-ghost" style="padding:2px 9px;font-size:11px" onclick="copyText(${JSON.stringify(scene)})">${t('common.copy')||'Copy'}</button>
          </div>
          <div style="padding:16px;font-size:13px;color:var(--text2);line-height:1.9;font-style:italic;white-space:pre-wrap">${escHTML(scene)}</div>
        </div>` : ''}

      ` : `
        <!-- Raw fallback if parsing failed -->
        <div style="font-size:13px;color:var(--text2);line-height:1.9;white-space:pre-wrap">${escHTML(raw)}</div>
      `}
    </div>`;
}

function auwSaveUniverse(name, desc) {
  const u = { id:uid(), name, type:'Alternative Universe', color:'#a78bfa', theme:'', desc, timeline:[] };
  universes.push(u);
  saveData(); updateUniSelector(); updateUniSidebar();
  toast(`Universe "${name}" saved!`);
  navigate('universes');
}

// Called from the save button — reads data off a hidden element to avoid inline JSON escaping issues
function auwSaveUniverseFromEl() {
  const el = document.getElementById('auw-save-data');
  if (!el) return;
  const name = el.dataset.name || 'AU';
  const desc = el.dataset.desc || '';
  auwSaveUniverse(name, desc);
}

/* ═══════════════════════════════════════════════
   AI STUDIO — STORY SPARK
═══════════════════════════════════════════════ */

let _ss = { tool: 'prompts' }; // active sub-tool
let _ssSaved = { prompts: [], lore: [], phrases: [] }; // saved results

function renderAIStorySpark() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;

  const tools = [
    { id:'prompts', icon:'✍', label:t('aiTool.ssPromptsTool')||'Writing Prompts', desc:t('aiTool.ssPromptsDesc')||'Plot ideas & twists tailored to your character' },
    { id:'lore',    icon:'📖', label:t('aiTool.ssLoreTool')||'Lore Expander',     desc:t('aiTool.ssLoreDesc')||'Deepen or invent lore for a specific character'  },
    { id:'phrases', icon:'💬', label:t('aiTool.ssPhrasesTool')||'Echo Lines',     desc:t('aiTool.ssPhrasesDesc')||'In-character phrases, quotes & one-liners'       },
  ];

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">

      <!-- Sub-tool picker -->
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${tools.map(t=>`
          <div onclick="ssSetTool('${t.id}')" data-sstool="${t.id}"
            style="flex:1;min-width:160px;cursor:pointer;border-radius:12px;padding:12px 16px;
              border:1.5px solid ${_ss.tool===t.id?'var(--accent)':'var(--border)'};
              background:${_ss.tool===t.id?'var(--accent-glow)':'var(--bg2)'};
              transition:all .15s">
            <div style="font-size:16px;margin-bottom:4px">${t.icon}</div>
            <div style="font-size:12px;font-weight:700;color:${_ss.tool===t.id?'var(--accent)':'var(--text)'};margin-bottom:3px">${t.label}</div>
            <div style="font-size:11px;color:var(--text3);line-height:1.5">${t.desc}</div>
          </div>`).join('')}
      </div>

      <!-- Tool content -->
      <div id="ss-tool-content"></div>

      <!-- Saved results -->
      <div class="card" id="ss-saved-card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">
          ${t('aiTool.ssSavedPrefix')||'Saved'} ${tools.find(to=>to.id===_ss.tool)?.label || ''}
        </div>
        <div id="ss-saved-list"></div>
      </div>
    </div>`;

  ssRenderTool();
  ssRenderSaved();
}

function ssSetTool(id) {
  _ss.tool = id;
  // Update pill states
  document.querySelectorAll('[data-sstool]').forEach(el => {
    const active = el.dataset.sstool === id;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background  = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.querySelectorAll('div')[1].style.color = active ? 'var(--accent)' : 'var(--text)';
  });
  // Update saved label
  const labels = {
    prompts: t('aiTool.ssPromptsTool')||'Writing Prompts',
    lore:    t('aiTool.ssLoreTool')||'Lore Expander',
    phrases: t('aiTool.ssPhrasesTool')||'Echo Lines'
  };
  const savedCard = document.getElementById('ss-saved-card');
  if (savedCard) savedCard.querySelector('div').textContent = `${t('aiTool.ssSavedPrefix')||'Saved'} ${labels[id]||id}`;
  ssRenderTool();
  ssRenderSaved();
}

function ssCharOptions() {
  return `<option value="">${t('aiTool.noChar')||'— No character —'}</option>` +
    characters.map(c => `<option value="${c.id}">${escHTML(c.name)}${c.species?' · '+escHTML(c.species):''}</option>`).join('');
}

function ssRenderTool() {
  const cont = document.getElementById('ss-tool-content');
  if (!cont) return;

  if (_ss.tool === 'prompts') {
    cont.innerHTML = `
      <div class="card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiTool.ssWPTitle')||'✍ Writing Prompts'}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
          ${t('aiTool.ssWPBody')||'Get plot ideas, scene starters, and plot twists. Pick a character and the AI reads everything about them — or go generic for universal prompts.'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <div class="form-label">${t('aiTool.characterOptional')||'Character'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
            <select class="form-select" id="ss-prompts-char">${ssCharOptions()}</select>
          </div>
          <div>
            <div class="form-label">${t('aiTool.ssPromptType')||'Type'}</div>
            <select class="form-select" id="ss-prompts-type">
              <option value="any">${t('aiTool.wpTypeAny')||'Any / Surprise me'}</option>
              <option value="plot">${t('aiTool.wpTypePlot')||'Plot Concept'}</option>
              <option value="twist">${t('aiTool.wpTypeTwist')||'Plot Twist'}</option>
              <option value="scene">${t('aiTool.wpTypeScene')||'Scene Starter'}</option>
              <option value="conflict">${t('aiTool.wpTypeConflict')||'Conflict / Tension'}</option>
              <option value="darkmoment">${t('aiTool.wpTypeDark')||'Dark Moment'}</option>
              <option value="fluff">${t('aiTool.wpTypeFluff')||'Fluff / Soft Moment'}</option>
              <option value="action">${t('aiTool.wpTypeAction')||'Action Beat'}</option>
              <option value="dialogue">${t('aiTool.wpTypeDialogue')||'Dialogue Spark'}</option>
              <option value="aftermath">${t('aiTool.wpTypeAftermath')||'Aftermath Scene'}</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px">
          <div class="form-label">${t('aiTool.extraDirection')||'Extra Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
          <input class="form-input" id="ss-prompts-extra" placeholder="${t('aiTool.ssExtraPlaceholder')||'e.g. Something involving betrayal, or a reunion after years apart…'}">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ssGenerate('prompts')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('aiTool.ssGenerate')||'Generate'}
          </button>
        </div>
        <div id="ss-result-prompts" style="margin-top:16px"></div>
      </div>`;

  } else if (_ss.tool === 'lore') {
    cont.innerHTML = `
      <div class="card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiTool.ssLoreTitle')||'📖 Lore Expander'}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
          ${t('aiTool.ssLoreBody')||'Pick a character and an aspect of their lore to expand — or invent entirely. The AI reads their full profile including custom tabs, relationships, and backstory.'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <div class="form-label">${t('aiTool.characterOptional')||'Character'}</div>
            <select class="form-select" id="ss-lore-char">${ssCharOptions()}</select>
          </div>
          <div>
            <div class="form-label">${t('aiTool.ssLoreFocus')||'Lore Focus'}</div>
            <select class="form-select" id="ss-lore-focus">
              <option value="origin">${t('aiTool.loreFocusOrigin')||'Origin Story / Backstory Expansion'}</option>
              <option value="powers">${t('aiTool.loreFocusPowers')||'Abilities & Powers Deep-Dive'}</option>
              <option value="relationships">${t('aiTool.loreFocusRelationships')||'Relationship History'}</option>
              <option value="worldplace">${t('aiTool.loreFocusWorldplace')||'Their Place in the World / Society'}</option>
              <option value="secret">${t('aiTool.loreFocusSecret')||'A Secret They\'re Hiding'}</option>
              <option value="trauma">${t('aiTool.loreFocusTrauma')||'A Defining Trauma or Wound'}</option>
              <option value="desire">${t('aiTool.loreFocusDesire')||'Their Deepest Desire'}</option>
              <option value="fear">${t('aiTool.loreFocusFear')||'What They Fear Most'}</option>
              <option value="legend">${t('aiTool.loreFocusLegend')||'How Others See / Speak of Them'}</option>
              <option value="future">${t('aiTool.loreFocusFuture')||'A Possible Future'}</option>
              <option value="custom">${t('aiTool.loreFocusCustom')||'Custom (use extra direction below)'}</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px">
          <div class="form-label">${t('aiTool.extraDirection')||'Extra Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
          <input class="form-input" id="ss-lore-extra" placeholder="e.g. Focus on their relationship with their father, tie it to their powers…">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ssGenerate('lore')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('aiTool.ssExpandLore')||'Expand Lore'}
          </button>
        </div>
        <div id="ss-result-lore" style="margin-top:16px"></div>
      </div>`;

  } else if (_ss.tool === 'phrases') {
    cont.innerHTML = `
      <div class="card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiTool.ssPhrasesTitle')||'💬 Echo Lines'}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
          ${t('aiTool.ssPhrasesBody')||'Generate in-character quotes, phrases, and one-liners. The AI reads your character\'s voice, traits, and personality to write lines that actually sound like them.'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <div class="form-label">${t('aiTool.characterOptional')||'Character'}</div>
            <select class="form-select" id="ss-phrases-char">${ssCharOptions()}</select>
          </div>
          <div>
            <div class="form-label">${t('aiTool.ssPhraseType')||'Phrase Type'}</div>
            <select class="form-select" id="ss-phrases-type">
              <option value="any">${t('aiTool.phraseTypeAny')||'Any / Mixed'}</option>
              <option value="combat">${t('aiTool.phraseTypeCombat')||'Combat / Battle Cry'}</option>
              <option value="villain">${t('aiTool.phraseTypeVillain')||'Villain Monologue Line'}</option>
              <option value="soft">${t('aiTool.phraseTypeSoft')||'Soft / Tender Moment'}</option>
              <option value="sarcastic">${t('aiTool.phraseTypeSarcastic')||'Sarcastic / Witty'}</option>
              <option value="threatening">${t('aiTool.phraseTypeThreatening')||'Threatening / Cold'}</option>
              <option value="motivational">${t('aiTool.phraseTypeMotivational')||'Motivational / Rallying'}</option>
              <option value="vulnerable">${t('aiTool.phraseTypeVulnerable')||'Vulnerable / Confession'}</option>
              <option value="catchphrase">${t('aiTool.phraseTypeCatchphrase')||'Catchphrase / Signature Line'}</option>
              <option value="last_words">${t('aiTool.phraseTypeLastWords')||'Last Words / Dying Moment'}</option>
              <option value="greeting">${t('aiTool.phraseTypeGreeting')||'How They Greet People'}</option>
              <option value="taunt">${t('aiTool.phraseTypeTaunt')||'Taunt / Provocation'}</option>
            </select>
          </div>
          <div>
            <div class="form-label">${t('ocf.variantsMax5')||'Variants (max 5)'}</div>
            <select class="form-select" id="ss-phrases-count">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px">
          <div class="form-label">${t('aiTool.ssContextDir')||'Context / Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
          <input class="form-input" id="ss-phrases-extra" placeholder="e.g. They're talking to their rival, or after a loss, or trying to comfort someone…">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" style="display:flex;align-items:center;gap:7px" onclick="ssGenerate('phrases')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('aiTool.ssGenerateLines')||'Generate Lines'}
          </button>
        </div>
        <div id="ss-result-phrases" style="margin-top:16px"></div>
      </div>`;
  }
}

// Full char summary including custom tabs (same structure as AU Weaver but includes customTabs)
function ssBuildCharSummary(char) {
  const relsStr = (char.relationships||[]).length
    ? char.relationships.map(r => {
        const target = r.targetId ? characters.find(c=>c.id===r.targetId) : null;
        const sp = target?.species ? ` (${target.species})` : '';
        const notes = r.notes ? ` — "${r.notes}"` : '';
        return `${r.type} with ${r.targetName||r.targetId}${sp}${notes}`;
      }).join('; ')
    : null;

  // Custom tabs — include all tab names + their section content
  let customTabsStr = null;
  if ((char.customTabs||[]).length) {
    customTabsStr = char.customTabs.map(tab => {
      const sections = (tab.sections||[]).filter(s=>s.content?.trim());
      if (!sections.length) return null;
      return `[${tab.name}]\n${sections.map(s=>`${s.name}: ${s.content}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
  }

  const fields = [
    ['Name',                   char.name],
    ['Species',                char.species],
    ['Age',                    char.age],
    ['Gender',                 char.gender],
    ['Pronouns',               char.pronouns],
    ['Alignment',              char.alignment],
    ['Occupation',             char.occupation],
    ['Hair',                   char.hair],
    ['Eyes',                   char.eyes],
    ['Body Type',              char.bodytype],
    ['Skin',                   char.skin],
    ['Distinguishing Features',char.features],
    ['Outfit',                 char.outfit],
    ['Traits',                 [char.traits, char.personalityDesc].filter(Boolean).join('\n')],
    ['Strengths',              char.strengths],
    ['Weaknesses',             char.weaknesses],
    ['Likes',                  char.likes],
    ['Dislikes',               char.dislikes],
    ['Habits',                 char.habits],
    ['Abilities',              char.abilities],
    ['Relationships',          relsStr],
    ['Backstory',              char.backstory ? char.backstory.slice(0,600)+(char.backstory.length>600?'…':'') : null],
    ['Quotes',                 char.quotes ? char.quotes.slice(0,300) : null],
    ['Additional Lore',        customTabsStr],
  ].filter(([,v])=>v&&String(v).trim());
  return fields.map(([k,v])=>`${k}: ${v}`).join('\n');
}

function ssBuildPrompt(tool) {
  const charId = document.getElementById(`ss-${tool}-char`)?.value;
  const char   = charId ? characters.find(c=>c.id===charId) : null;
  const extra  = document.getElementById(`ss-${tool}-extra`)?.value?.trim() || '';
  const extraLine = extra ? `\nExtra direction: ${extra}` : '';

  if (tool === 'prompts') {
    const type = document.getElementById('ss-prompts-type')?.value || 'any';
    const typeLabels = {
      any:'any type (surprise me)', plot:'a plot concept', twist:'a plot twist',
      scene:'a scene starter', conflict:'a conflict or tension beat',
      darkmoment:'a dark or painful moment', fluff:'a soft or tender moment',
      action:'an action beat', dialogue:'a dialogue spark', aftermath:'an aftermath scene',
    };
    const charBlock = char ? `\nCharacter:\n${ssBuildCharSummary(char)}\n\nMake the prompts specific to this character — use their name, traits, relationships, and lore.` : '\nNo specific character — write universal prompts.';
    return `You are a creative writing assistant for a character creator app called Charactry.
Generate 3 distinct writing prompts of type: ${typeLabels[type]||'any'}.${charBlock}${extraLine}

Format: Return ONLY a numbered list of 3 prompts. Each prompt should be 1-3 sentences. Vivid, specific, and emotionally charged. No preamble.`;
  }

  if (tool === 'lore') {
    const focus = document.getElementById('ss-lore-focus')?.value || 'origin';
    if (!char) return null; // lore requires a character
    const focusLabels = {
      origin:'their origin story and backstory expansion',
      powers:'their abilities and powers in depth',
      relationships:'their relationship history and dynamics',
      worldplace:'their place and role in the world or society',
      secret:'a secret they are hiding',
      trauma:'a defining trauma or emotional wound',
      desire:'their deepest desire or hidden goal',
      fear:'what they fear most and why',
      legend:'how others speak of or perceive them',
      future:'a possible or alternate future for them',
      custom:'the topic specified in extra direction',
    };
    const charBlock = ssBuildCharSummary(char);
    return `You are a creative writing assistant for a character creator app called Charactry.

Character:
${charBlock}

Task: Write an immersive lore expansion focused on: ${focusLabels[focus]||focus}.${extraLine}

Write 2-4 paragraphs of rich, specific lore that feels consistent with the character's established traits, species, relationships, and backstory. Write in a narrative/worldbuilding tone — not bullet points. Be inventive but stay true to who this character is. No preamble or meta-commentary.
Use the character's correct pronouns throughout. Do not repeat phrases.`;
  }

  if (tool === 'phrases') {
    const type  = document.getElementById('ss-phrases-type')?.value || 'any';
    const count = document.getElementById('ss-phrases-count')?.value || '3';
    const typeLabels = {
      any:'any type (mixed)', combat:'combat / battle cry', villain:'villain monologue line',
      soft:'soft or tender moment', sarcastic:'sarcastic or witty', threatening:'threatening or cold',
      motivational:'motivational or rallying', vulnerable:'vulnerable confession',
      catchphrase:'signature catchphrase', last_words:'last words or dying moment',
      greeting:'how they greet people', taunt:'taunt or provocation',
    };
    const charBlock = char ? ssBuildCharSummary(char) : null;
    const charSection = charBlock
      ? `Character:\n${charBlock}\n\nWrite lines that sound EXACTLY like this character — match their voice, vocabulary, speech patterns, and emotional register implied by their traits, quotes, and lore.`
      : 'No specific character — write compelling generic lines.';
    return `You are a creative writing assistant for a character creator app called Charactry.

${charSection}

Generate ${count} in-character ${typeLabels[type]||'mixed'} lines.${extraLine}

Rules:
- Each line should feel distinct and memorable
- No quotation marks around the lines
- Return ONLY a numbered list of ${count} lines, nothing else
- Short and punchy (1-2 sentences max each)`;
  }

  return null;
}

async function ssGenerate(tool) {
  const resultEl = document.getElementById(`ss-result-${tool}`);
  if (!resultEl) return;

  // Validate character required for lore
  if (tool === 'lore') {
    const charId = document.getElementById('ss-lore-char')?.value;
    if (!charId) { toast('Lore Expander needs a character!'); return; }
  }

  const ok = await ollamaCheck();
  if (!ok) { resultEl.innerHTML = ocfErrorHTML('Ollama is not running. Start it and pull a model first.'); return; }

  const charId = document.getElementById(`ss-${tool}-char`)?.value;
  let char   = charId ? characters.find(c=>c.id===charId) : null;
  if (char) char = await charMergeFromFile(char);

  const prompt = ssBuildPrompt(tool);
  const useStream = settings.aiStreaming !== false;

  if (useStream) {
    resultEl.innerHTML = ocfStreamHTML(tool);
    const liveEl = document.getElementById('ocf-stream-live');
    const statEl = document.getElementById('ocf-stream-status');
    let raw = '';
    try {
      raw = await aiGenerateStream(prompt, (token, full) => {
        if (liveEl) { liveEl.textContent = full; liveEl.scrollIntoView({block:'nearest',behavior:'smooth'}); }
      });
      if (statEl) statEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>${t('aiTool.cbDone')||'Done'}</span>`;
      await new Promise(r=>setTimeout(r,200));
      resultEl.innerHTML = ssRenderResult(tool, raw.trim(), char);
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  } else {
    resultEl.innerHTML = ocfLoadingHTML();
    try {
      const raw = await aiGenerate(prompt);
      resultEl.innerHTML = ssRenderResult(tool, raw.trim(), char);
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  }
}

function ssRenderResult(tool, raw, char) {
  // Prompts & Phrases — numbered list → individual cards with save/copy/reroll
  if (tool === 'prompts' || tool === 'phrases') {
    const lines = raw.split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/,'').trim())
      .filter(l => l.length > 4);
    if (!lines.length) return ssRawResult(tool, raw);

    const accentCol = tool === 'phrases' ? 'var(--accent)' : 'var(--text)';
    const icon = tool === 'phrases' ? '"' : '✦';

    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${lines.map((l,i) => `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="padding:13px 16px;font-size:13px;color:${accentCol};line-height:1.8;font-style:${tool==='phrases'?'italic':'normal'}">
            ${tool==='phrases'?`<span style="font-size:18px;color:var(--accent);opacity:.5;margin-right:4px">"</span>`:''}${escHTML(l)}${tool==='phrases'?`<span style="font-size:18px;color:var(--accent);opacity:.5;margin-left:4px">"</span>`:''}
          </div>
          <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);background:var(--bg3)">
            <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px" onclick="copyText(${JSON.stringify(l)})">${t('common.copy')||'Copy'}</button>
            <button class="btn btn-primary" style="padding:3px 10px;font-size:11px" onclick="ssSave('${tool}', ${JSON.stringify(l)})">★ ${t('common.save')||'Save'}</button>
          </div>
        </div>`).join('')}
      <button class="btn btn-ghost" style="align-self:flex-start;font-size:12px;display:flex;align-items:center;gap:6px;margin-top:4px" onclick="ssGenerate('${tool}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.96"/></svg>
        ${t('common.reroll')||'Re-roll'}
      </button>
    </div>`;
  }

  // Lore — prose block with save/copy/reroll
  if (tool === 'lore') {
    return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        ${char ? `<div style="padding:10px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
          ${char.avatar
            ? `<img src="${char.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">`
            : `<div style="width:24px;height:24px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--accent)">${escHTML((char.name||'?')[0])}</div>`}
          <span style="font-size:11px;font-weight:700;color:var(--text2)">${escHTML(char.name)}</span>
          <span style="font-size:10px;color:var(--text3);margin-left:auto">${t('aiTool.loreExpansion')||'Lore Expansion'}</span>
        </div>` : ''}
        <div style="padding:16px;font-size:13px;color:var(--text2);line-height:1.9;white-space:pre-wrap">${escHTML(raw)}</div>
        <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);background:var(--bg3)">
          <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px" onclick="copyText(${JSON.stringify(raw)})">${t('common.copy')||'Copy'}</button>
          <button class="btn btn-primary" style="padding:3px 10px;font-size:11px" onclick="ssSave('lore', ${JSON.stringify(raw)})">★ ${t('common.save')||'Save'}</button>
          <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;margin-left:auto;display:flex;align-items:center;gap:5px" onclick="ssGenerate('lore')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.96"/></svg>
            ${t('common.reroll')||'Re-roll'}
          </button>
        </div>
      </div>`;
  }

  return ssRawResult(tool, raw);
}

function ssRawResult(tool, raw) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px">
    <div style="font-size:13px;color:var(--text2);line-height:1.8;white-space:pre-wrap;margin-bottom:12px">${escHTML(raw)}</div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px" onclick="copyText(${JSON.stringify(raw)})">${t('common.copy')||'Copy'}</button>
      <button class="btn btn-primary" style="padding:3px 10px;font-size:11px" onclick="ssSave('${tool}', ${JSON.stringify(raw)})">★ ${t('common.save')||'Save'}</button>
      <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;margin-left:auto;display:flex;align-items:center;gap:5px" onclick="ssGenerate('${tool}')">${t('common.reroll')||'Re-roll'}</button>
    </div>
  </div>`;
}

function ssSave(tool, text) {
  _ssSaved[tool] = _ssSaved[tool] || [];
  if (_ssSaved[tool].includes(text)) { toast('Already saved!'); return; }
  _ssSaved[tool].push(text);
  toast('Saved!');
  ssRenderSaved();
}

function ssDeleteSaved(tool, i) {
  _ssSaved[tool].splice(i, 1);
  ssRenderSaved();
}

function ssRenderSaved() {
  const list = document.getElementById('ss-saved-list');
  if (!list) return;
  const tool = _ss.tool;
  const items = _ssSaved[tool] || [];
  if (!items.length) {
    list.innerHTML = `<div style="font-size:13px;color:var(--text3)">${t('aiTool.ssNothingSaved')||'Nothing saved yet — hit ★ Save on any result to keep it here.'}</div>`;
    return;
  }
  const isLore = tool === 'lore';
  list.innerHTML = items.map((text, i) => `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start">
      <div style="flex:1;font-size:13px;color:var(--text);line-height:1.7;${isLore?'':'font-style:italic;'}">${escHTML(text)}</div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost" style="padding:2px 8px;font-size:11px" onclick="copyText(${JSON.stringify(text)})">${t('common.copy')||'Copy'}</button>
        <button class="btn btn-danger" style="padding:2px 8px;font-size:11px" onclick="ssDeleteSaved('${tool}',${i})">✕</button>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════
   AI STUDIO — FUSION LAB
═══════════════════════════════════════════════ */

// Hex color helpers
function flBlendHex(h1, h2, t = 0.5) {
  const p = s => parseInt(s, 16);
  const r = Math.round(p(h1.slice(1,3)) * (1-t) + p(h2.slice(1,3)) * t);
  const g = Math.round(p(h1.slice(3,5)) * (1-t) + p(h2.slice(3,5)) * t);
  const b = Math.round(p(h1.slice(5,7)) * (1-t) + p(h2.slice(5,7)) * t);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

// Convert hex to HSL for smarter blending
function flHexToHSL(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

function flHSLToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  return '#' + [f(0),f(8),f(4)].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

// Smart palette: blend in HSL space, generate 3 harmonious colors
function flSmartPalette(charA, charB) {
  const c1 = charA.color1 || '#7c3aed';
  const c2 = charB.color1 || '#a78bfa';
  const [h1,s1,l1] = flHexToHSL(c1);
  const [h2,s2,l2] = flHexToHSL(c2);
  // Blend hue through shortest arc
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const blendH = (h1 + dh * 0.5 + 360) % 360;
  const blendS = Math.round((s1 + s2) / 2);
  const blendL = Math.round((l1 + l2) / 2);
  const primary  = flHSLToHex(blendH, blendS, Math.max(blendL, 40));
  const light    = flHSLToHex(blendH, Math.max(blendS - 15, 20), Math.min(blendL + 20, 80));
  const deep     = flHSLToHex((blendH + 30) % 360, blendS, Math.max(blendL - 15, 25));
  // If chars have a second color, blend those too for accent
  const a2 = charA.color2, b2 = charB.color2;
  const accent = (a2 && b2) ? flBlendHex(a2, b2) : flHSLToHex((blendH + 180) % 360, blendS, blendL);
  return { primary, light, deep, accent };
}

// Find children: characters who have a relationship pointing to both A and B as parents
function flFindChildren(charA, charB) {
  return characters.filter(c => {
    if (c.id === charA.id || c.id === charB.id) return false;
    const rels = c.relationships || [];
    const parentTypes = ['parent','mother','father','mom','dad','guardian','adopted parent','adoptive'];
    const hasA = rels.some(r => {
      const tId = r.targetId === charA.id || r.targetName?.toLowerCase() === charA.name.toLowerCase();
      const tType = parentTypes.some(pt => (r.type||'').toLowerCase().includes(pt));
      return tId && tType;
    });
    const hasB = rels.some(r => {
      const tId = r.targetId === charB.id || r.targetName?.toLowerCase() === charB.name.toLowerCase();
      const tType = parentTypes.some(pt => (r.type||'').toLowerCase().includes(pt));
      return tId && tType;
    });
    // Also check from parent side: A or B has a child relationship TO this character
    const aHasChild = (charA.relationships||[]).some(r =>
      (r.targetId === c.id || r.targetName?.toLowerCase() === c.name.toLowerCase()) &&
      ['child','son','daughter','kid','adopted'].some(ct => (r.type||'').toLowerCase().includes(ct))
    );
    const bHasChild = (charB.relationships||[]).some(r =>
      (r.targetId === c.id || r.targetName?.toLowerCase() === c.name.toLowerCase()) &&
      ['child','son','daughter','kid','adopted'].some(ct => (r.type||'').toLowerCase().includes(ct))
    );
    return (hasA && hasB) || (aHasChild && bHasChild) || (hasA && bHasChild) || (hasB && aHasChild);
  });
}

function flBuildFullCharBlock(char) {
  const relsStr = (char.relationships||[]).length
    ? char.relationships.map(r => {
        const target = r.targetId ? characters.find(c=>c.id===r.targetId) : null;
        const sp = target?.species ? ` (${target.species})` : '';
        const notes = r.notes ? ` — "${r.notes}"` : '';
        return `${r.type} with ${r.targetName||r.targetId}${sp}${notes}`;
      }).join('; ')
    : null;

  let customTabsStr = null;
  if ((char.customTabs||[]).length) {
    customTabsStr = char.customTabs.map(tab => {
      const secs = (tab.sections||[]).filter(s=>s.content?.trim());
      if (!secs.length) return null;
      return `[${tab.name}]\n${secs.map(s=>`${s.name}: ${s.content}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
  }

  const fields = [
    ['Name',         char.name],
    ['Species',      char.species],
    ['Age',          char.age],
    ['Gender',       char.gender],
    ['Pronouns',     char.pronouns],
    ['Alignment',    char.alignment],
    ['Occupation',   char.occupation],
    ['Hair',         char.hair],
    ['Eyes',         char.eyes],
    ['Body Type',    char.bodytype],
    ['Skin',         char.skin],
    ['Features',     char.features],
    ['Outfit',       char.outfit],
    ['Traits',       [char.traits, char.personalityDesc].filter(Boolean).join('\n')],
    ['Strengths',    char.strengths],
    ['Weaknesses',   char.weaknesses],
    ['Likes',        char.likes],
    ['Dislikes',     char.dislikes],
    ['Habits',       char.habits],
    ['Abilities',    char.abilities],
    ['Relationships',relsStr],
    ['Backstory',    char.backstory ? char.backstory.slice(0,500)+(char.backstory.length>500?'…':'') : null],
    ['Quotes',       char.quotes ? char.quotes.slice(0,200) : null],
    ['Additional Lore', customTabsStr],
  ].filter(([,v])=>v&&String(v).trim());
  return fields.map(([k,v])=>`  ${k}: ${v}`).join('\n');
}

function flBuildPrompt(charA, charB, children, mode, extra, carrier='unknown') {
  const childBlock = children.length
    ? `\nKnown Children / Kids of this pair:\n${children.map(c=>`--- ${c.name} ---\n${flBuildFullCharBlock(c)}`).join('\n\n')}`
    : '';

  const rel = (charA.relationships||[]).find(r =>
    r.targetId === charB.id || r.targetName?.toLowerCase() === charB.name.toLowerCase()
  ) || (charB.relationships||[]).find(r =>
    r.targetId === charA.id || r.targetName?.toLowerCase() === charA.name.toLowerCase()
  );
  const relLine = rel ? `\nEstablished relationship: ${charA.name} and ${charB.name} are "${rel.type}"${rel.notes?` (note: ${rel.notes})`:''}` : '';

  const extraLine = extra ? `\nAuthor's direction: ${extra}` : '';

  const modeInstructions = {
    full: `Create a full fusion character profile with these clearly labeled sections:

FUSION NAME: [a creative name that blends elements of both characters' names or aesthetics]
FUSION SPECIES: [a creative hybrid or blended species — consider both their species, lore, and abilities]
AGE: [a reasonable fused age with a brief note on how fusion affects their age]
DOMINANT SOUL: [which character's personality/energy is more dominant and why]
PERSONALITY: [3-5 traits that are a genuine blend — show how conflicting traits merge, compromise, or create tension. Be specific to these characters, not generic.]
APPEARANCE: [detailed description — hair, eyes, skin, features, outfit. Blend both characters' actual aesthetics intelligently. If one is a dragon and one is human, think about how those features translate — scales as skin patterns, slit pupils, etc. Be creative and specific.]
ABILITIES: [2-4 fused abilities — blend their actual abilities, account for how they might synergize or conflict]
VOICE & SPEECH: [how they talk — blend both characters' speech patterns, quotes, and habits]
LORE: [2-3 sentences of rich, specific origin/lore for this fusion. Reference their actual backstories and relationship.]
INNER CONFLICT: [the core tension living inside this fusion — what do the two souls disagree on? What threatens to tear them apart?]
PALETTE NOTE: [describe in words what the fusion's color palette feels like — e.g. "deep violet bleeds into warm amber, accented by cold silver"]`,

    quick: `Write a punchy fusion summary with:
FUSION NAME: [blended name]
FUSION SPECIES: [hybrid species]
PERSONALITY: [3 blended traits]
APPEARANCE: [2-3 sentences on their look]
LORE: [1-2 sentences of origin]
INNER CONFLICT: [one sentence]`,

    kid: `Imagine the biological or spiritual "child" that could exist between these two characters — not a fusion of their bodies, but a new character who inherited from both.
${carrier === 'a' ? `CARRIER: ${charA.name} carried and birthed this child. Reflect this in the lore — physical traits, emotional bond, and early upbringing lean toward ${charA.name}.` : carrier === 'b' ? `CARRIER: ${charB.name} carried and birthed this child. Reflect this in the lore — physical traits, emotional bond, and early upbringing lean toward ${charB.name}.` : 'CARRIER: Unknown or unspecified — do not assume who carried.'}

CHILD NAME: [a name that could plausibly belong to both families/species]
SPECIES: [inherited or hybrid species]
AGE: [suggested age — young adult or child depending on context]
APPEARANCE: [detailed — what did they inherit from each parent? Be specific about hair, eyes, features]
PERSONALITY: [4-5 traits inherited or developed in reaction to both parents]
ABILITIES: [2-3 abilities — inherited, developed, or a mix]
RELATIONSHIP WITH PARENTS: [how do they relate to ${charA.name} and ${charB.name}? Love, tension, distance?]
LORE: [2-3 sentences — their origin, what it means to be born of these two specifically]
${children.length ? `\nNote: This pair already has ${children.length} known child/children. Consider how this new character fits alongside them.` : ''}`,
  };

  return `You are a creative writing assistant for a character creator app called Charactry.

CHARACTER A:
${flBuildFullCharBlock(charA)}

CHARACTER B:
${flBuildFullCharBlock(charB)}
${relLine}${childBlock}${extraLine}

${modeInstructions[mode] || modeInstructions.full}

Be deeply specific — use actual details from both characters' appearances, traits, abilities, lore, and relationship. Do NOT write generic fusion content. No preamble, no meta-commentary.
Use CORRECT pronouns for both characters exactly as stated in their profiles above — do not assume gender from names.
Do NOT repeat the same phrase or detail twice in your response.`;
}

function renderAIFusionLab() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;

  if (characters.length < 2) {
    cont.innerHTML = `<div class="card" style="text-align:center;padding:48px">
      <div style="font-size:40px;margin-bottom:12px">⬡</div>
      <div style="font-size:15px;color:var(--text2);margin-bottom:6px">${t('aiTool.flNeed2Chars')||'Need at least two characters'}</div>
      <div style="font-size:13px;color:var(--text3)">${t('aiTool.flAdd2First')||'Add some characters first, then come back.'}</div>
    </div>`;
    return;
  }

  const opts = characters.map(c =>
    `<option value="${c.id}">${escHTML(c.name)}${c.species?' · '+escHTML(c.species):''}${c.favorite?' ★':''}</option>`
  ).join('');

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="card">
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">${t('aiTool.flTitle')||'⬡ Fusion Lab'}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:18px">
          ${t('aiTool.flDesc')||'The AI reads both characters completely — appearance, personality, abilities, lore, relationships, and custom tabs — and creates a deeply tailored fusion. If the pair has children, it reads them too.'}
        </div>

        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:flex-end;margin-bottom:16px">
          <div>
            <div class="form-label">${t('form.characterA')||'Character A'}</div>
            <select class="form-select" id="fl-char-a" onchange="flCheckChildren()">${opts}</select>
          </div>
          <div style="font-size:22px;color:var(--accent);padding-bottom:8px;text-align:center">⬡</div>
          <div>
            <div class="form-label">${t('form.characterB')||'Character B'}</div>
            <select class="form-select" id="fl-char-b" onchange="flCheckChildren()">${opts}</select>
          </div>
        </div>

        <!-- Children notice — shown dynamically -->
        <div id="fl-children-notice" style="display:none;margin-bottom:14px"></div>

        <!-- Mode -->
        <div style="margin-bottom:14px">
          <div class="form-label">${t('aiTool.flFusionType')||'Fusion Type'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="fl-mode-btns">
            ${[
              ['full',  t('aiTool.flFullFusion')||'⬡ Full Fusion',     t('aiTool.flFullDesc')||'Complete profile — appearance, personality, abilities, lore, inner conflict'],
              ['quick', t('aiTool.flQuickFusion')||'⚡ Quick Fusion',   t('aiTool.flQuickDesc')||'Fast summary — name, species, personality, look, lore'],
              ['kid',   t('aiTool.flKidFusion')||'🌱 Conceived Child',  t('aiTool.flKidDesc')||'A new character born of / inspired by both — not a fusion but an offspring'],
            ].map(([val, label, desc], i) => `
              <div onclick="flSetMode('${val}')" data-flmode="${val}"
                style="flex:1;min-width:160px;cursor:pointer;border-radius:10px;padding:10px 14px;
                  border:1.5px solid ${i===0?'var(--accent)':'var(--border)'};
                  background:${i===0?'var(--accent-glow)':'var(--bg2)'};transition:all .15s">
                <div style="font-size:12px;font-weight:700;color:${i===0?'var(--accent)':'var(--text)'};margin-bottom:3px">${label}</div>
                <div style="font-size:11px;color:var(--text3);line-height:1.5">${desc}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Carrier row — only shown in Conceived Child mode -->
        <div id="fl-carrier-row" style="display:none;margin-bottom:14px">
          <div class="form-label">${t('aiTool.flWhoCarried')||'Who Carried?'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px" id="fl-carrier-btns">
            ${[
              ['unknown', t('aiTool.flCarrierUnknown')||'❓ Unknown',    t('aiTool.flCarrierUnknownDesc')||'Not specified'],
              ['a',       t('aiTool.flCarrierA')||'◈ Character A',       t('aiTool.flCarrierADesc')||'Carried by Character A'],
              ['b',       t('aiTool.flCarrierB')||'◈ Character B',       t('aiTool.flCarrierBDesc')||'Carried by Character B'],
            ].map(([val, label, desc]) => `
              <div onclick="flSetCarrier('${val}')" data-flcarrier="${val}"
                style="flex:1;min-width:120px;cursor:pointer;border-radius:8px;padding:8px 12px;
                  border:1.5px solid ${val==='unknown'?'var(--accent)':'var(--border)'};
                  background:${val==='unknown'?'var(--accent-glow)':'var(--bg2)'};transition:all .15s">
                <div style="font-size:12px;font-weight:700;color:${val==='unknown'?'var(--accent)':'var(--text)'};margin-bottom:2px">${label}</div>
                <div style="font-size:10px;color:var(--text3)">${desc}</div>
              </div>`).join('')}
          </div>
        </div>

        <div style="margin-bottom:16px">
          <div class="form-label">${t('aiTool.extraDirection')||'Extra Direction'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
          <input class="form-input" id="fl-extra" placeholder="${t('aiTool.flExtraPlaceholder')||'e.g. Make the fusion tragic, lean into their conflict, the child rebels against both parents…'}">
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" style="display:flex;align-items:center;gap:8px" onclick="flGenerate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('aiTool.flFuseBtn')||'Fuse'}
          </button>
          <button class="btn btn-ghost" style="font-size:13px" onclick="flRandomPair()">${t('aiTool.flRandomPair')||'🎲 Random Pair'}</button>
          <button class="btn btn-ghost" style="font-size:12px;border-color:rgba(240,192,64,.3);color:var(--accent)" onclick="flShowDNA()">${t('aiTool.flTraitDNA')||'🧬 Trait DNA'}</button>
        </div>
      </div>

      <div id="fl-result"></div>
      <div id="fl-dna-panel" style="display:none"></div>
    </div>`;

  // Pre-select different chars
  const selA = document.getElementById('fl-char-a');
  const selB = document.getElementById('fl-char-b');
  if (selA && selB && characters.length >= 2) {
    selA.value = characters[0].id;
    selB.value = characters[1].id;
  }
  flCheckChildren();
  window._flMode = 'full';
  window._flCarrier = 'unknown';
  // Wire char selects to also refresh DNA panel
  ['fl-char-a','fl-char-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { document.getElementById('fl-dna-panel').style.display='none'; });
  });
}


function flShowDNA() {
  const idA = document.getElementById('fl-char-a')?.value;
  const idB = document.getElementById('fl-char-b')?.value;
  const panel = document.getElementById('fl-dna-panel');
  if (!panel || !idA || !idB || idA === idB) return;
  const charA = characters.find(c=>c.id===idA);
  const charB = characters.find(c=>c.id===idB);
  if (!charA || !charB) return;

  // Fields to compare for trait overlap
  const FIELDS = [
    ['Traits / Personality', 'traits'],
    ['Species', 'species'],
    ['Alignment', 'alignment'],
    ['Likes', 'likes'],
    ['Dislikes', 'dislikes'],
    ['Strengths', 'strengths'],
    ['Weaknesses', 'weaknesses'],
    ['Abilities', 'abilities'],
    ['Hair', 'hair'],
    ['Eyes', 'eyes'],
  ];

  // Extract keywords from a field value (split on commas, semicolons, spaces)
  function keywords(val) {
    if (!val) return new Set();
    return new Set(
      String(val).toLowerCase()
        .split(/[,;/\n\-]+/)
        .map(s => s.trim())
        .filter(s => s.length > 2 && s.length < 40)
    );
  }

  const rows = FIELDS.map(([label, key]) => {
    const aSet = keywords(charA[key]);
    const bSet = keywords(charB[key]);
    const shared = [...aSet].filter(x => bSet.has(x));
    const aOnly  = [...aSet].filter(x => !bSet.has(x));
    const bOnly  = [...bSet].filter(x => !aSet.has(x));
    if (!aSet.size && !bSet.size) return null;
    return { label, key, shared, aOnly, bOnly, aRaw: charA[key], bRaw: charB[key] };
  }).filter(Boolean);

  const sharedCount = rows.filter(r => r.shared.length > 0).length;

  function pill(txt, col) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:${col}22;color:${col};border:1px solid ${col}44;margin:2px">${escHTML(txt)}</span>`;
  }

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card" style="margin-top:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--text2);letter-spacing:1px;text-transform:uppercase">🧬 Trait DNA — Heritable Overlap</div>
        <div style="font-size:11px;color:var(--text3)">${sharedCount} field${sharedCount!==1?'s':''} with overlap</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;text-align:center;padding:0 4px">
        <div style="color:var(--purple2)">${escHTML(charA.name||'A')}</div>
        <div style="color:var(--accent)">SHARED ✦</div>
        <div style="color:#10b981">${escHTML(charB.name||'B')}</div>
      </div>
      ${rows.map(r => `
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;padding:8px 4px;border-bottom:1px solid var(--border);align-items:start">
          <div>
            <div style="font-size:9px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${escHTML(r.label)}</div>
            <div>${r.aOnly.slice(0,5).map(t=>pill(t,'#a78bfa')).join('')}${r.aOnly.length>5?`<span style="font-size:10px;color:var(--text3)">+${r.aOnly.length-5}</span>`:''}</div>
            ${!r.aOnly.length && r.aRaw ? `<div style="font-size:10px;color:var(--text3)">${escHTML(String(r.aRaw).slice(0,60))}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:0 4px">
            ${r.shared.length ? r.shared.slice(0,4).map(t=>`<span style="display:block;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(240,192,64,.15);color:var(--accent);border:1px solid rgba(240,192,64,.3);white-space:nowrap;text-align:center">${escHTML(t)}</span>`).join('')
              : '<span style="font-size:10px;color:var(--text3);font-style:italic">—</span>'}
          </div>
          <div>
            <div style="font-size:9px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${escHTML(r.label)}</div>
            <div>${r.bOnly.slice(0,5).map(t=>pill(t,'#10b981')).join('')}${r.bOnly.length>5?`<span style="font-size:10px;color:var(--text3)">+${r.bOnly.length-5}</span>`:''}</div>
            ${!r.bOnly.length && r.bRaw ? `<div style="font-size:10px;color:var(--text3)">${escHTML(String(r.bRaw).slice(0,60))}</div>` : ''}
          </div>
        </div>`).join('')}
      <div style="margin-top:12px;padding:10px 14px;background:rgba(240,192,64,.06);border:1px solid rgba(240,192,64,.2);border-radius:10px;font-size:11px;color:var(--text3);line-height:1.6">
        ${t('aiTool.flTraitDNAPre')||'✦ Shared traits indicate what a child or fusion might naturally inherit. Unique traits show where they diverge. Use'} <b style="color:var(--accent)">${t('aiTool.flKidFusion')||'Conceived Child'}</b> ${t('aiTool.flTraitDNAPost')||'mode above to generate an offspring that draws from both sides.'}
      </div>
    </div>`;
}

function flSetMode(val) {
  window._flMode = val;
  document.querySelectorAll('[data-flmode]').forEach(el => {
    const active = el.dataset.flmode === val;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background  = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.querySelector('div').style.color = active ? 'var(--accent)' : 'var(--text)';
  });
  // Show/hide the carrier row only for Conceived Child mode
  const row = document.getElementById('fl-carrier-row');
  if (row) row.style.display = val === 'kid' ? '' : 'none';
}

function flSetCarrier(val) {
  window._flCarrier = val;
  document.querySelectorAll('[data-flcarrier]').forEach(el => {
    const active = el.dataset.flcarrier === val;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background  = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.querySelector('div').style.color = active ? 'var(--accent)' : 'var(--text)';
  });
}

function flCheckChildren() {
  const idA = document.getElementById('fl-char-a')?.value;
  const idB = document.getElementById('fl-char-b')?.value;
  const notice = document.getElementById('fl-children-notice');
  if (!notice || !idA || !idB || idA === idB) { if(notice) notice.style.display='none'; return; }
  const charA = characters.find(c=>c.id===idA);
  const charB = characters.find(c=>c.id===idB);
  if (!charA || !charB) return;
  const kids = flFindChildren(charA, charB);
  if (!kids.length) { notice.style.display='none'; return; }
  notice.style.display = 'block';
  const avatars = kids.map(k => k.avatar
    ? `<img src="${k.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)55">`
    : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent)">${escHTML((k.name||'?')[0])}</div>`
  ).join('');
  notice.innerHTML = `
    <div style="background:var(--accent-glow);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">
      <div style="display:flex;gap:4px">${avatars}</div>
      <div style="font-size:12px;color:var(--accent)">
        <b>${kids.length} known ${kids.length===1?'child':'children'} detected:</b>
        <span style="color:var(--text2);margin-left:4px">${kids.map(k=>escHTML(k.name)).join(', ')}</span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-left:auto">The AI will read their files too ✦</div>
    </div>`;
}

function flRandomPair() {
  if (characters.length < 2) return;
  const shuffled = [...characters].sort(() => Math.random() - 0.5);
  document.getElementById('fl-char-a').value = shuffled[0].id;
  document.getElementById('fl-char-b').value = shuffled[1].id;
  flCheckChildren();
}

async function flGenerate() {
  const idA = document.getElementById('fl-char-a')?.value;
  const idB = document.getElementById('fl-char-b')?.value;
  const extra = document.getElementById('fl-extra')?.value?.trim() || '';
  const resultEl = document.getElementById('fl-result');
  if (!resultEl) return;

  if (!idA || !idB) { toast('Pick two characters!'); return; }
  if (idA === idB) { toast("A character can't fuse with themselves... probably."); return; }

  let charA = characters.find(c=>c.id===idA);
  let charB = characters.find(c=>c.id===idB);
  if (!charA || !charB) return;
  [charA, charB] = await Promise.all([charMergeFromFile(charA), charMergeFromFile(charB)]);

  const ok = await ollamaCheck();
  if (!ok) { resultEl.innerHTML = ocfErrorHTML('Ollama is not running.'); return; }

  const rawChildren = flFindChildren(charA, charB);
  const children = await Promise.all(rawChildren.map(c => charMergeFromFile(c)));
  const mode    = window._flMode    || 'full';
  const carrier = window._flCarrier || 'unknown';
  const prompt  = flBuildPrompt(charA, charB, children, mode, extra, carrier);
  const palette = flSmartPalette(charA, charB);
  const useStream = settings.aiStreaming !== false;

  if (useStream) {
    resultEl.innerHTML = ocfStreamHTML('fusionlab');
    const liveEl = document.getElementById('ocf-stream-live');
    const statEl = document.getElementById('ocf-stream-status');
    let raw = '';
    try {
      raw = await aiGenerateStream(prompt, (token, full) => {
        if (liveEl) { liveEl.textContent = full; liveEl.scrollIntoView({block:'nearest',behavior:'smooth'}); }
      });
      if (statEl) statEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>Done — rendering…</span>`;
      await new Promise(r=>setTimeout(r,280));
      resultEl.innerHTML = flRenderResult(charA, charB, children, mode, palette, raw.trim());
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  } else {
    resultEl.innerHTML = ocfLoadingHTML();
    try {
      const raw = await aiGenerate(prompt);
      resultEl.innerHTML = flRenderResult(charA, charB, children, mode, palette, raw.trim());
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  }
}

function flRenderResult(charA, charB, children, mode, palette, raw) {
  const { primary, light, deep, accent } = palette;
  const grad = `linear-gradient(135deg, ${primary}, ${deep})`;
  const gradSoft = `linear-gradient(135deg, ${primary}22, ${deep}18)`;

  // Parser
  const get = key => {
    const m = raw.match(new RegExp(`${key}:\\s*([\\s\\S]+?)(?=\\n[A-Z &\\/]+:|$)`, 'i'));
    return m ? m[1].trim() : null;
  };

  const isKid = mode === 'kid';
  const nameKey   = isKid ? 'CHILD NAME' : 'FUSION NAME';
  const specKey   = isKid ? 'SPECIES'    : 'FUSION SPECIES';

  const fusionName    = get(nameKey)    || (isKid ? 'Unnamed Child' : 'Unnamed Fusion');
  const fusionSpecies = get(specKey)    || '';
  const fusionAge     = get('AGE')      || '';
  const dominant      = get('DOMINANT SOUL') || get('DOMINANT') || '';
  const personality   = get('PERSONALITY')   || '';
  const appearance    = get('APPEARANCE')    || '';
  const abilities     = get('ABILITIES')     || '';
  const voice         = get('VOICE & SPEECH') || get('VOICE')  || '';
  const lore          = get('LORE')           || '';
  const conflict      = get('INNER CONFLICT') || '';
  const paletteNote   = get('PALETTE NOTE')   || '';
  const parentRel     = get('RELATIONSHIP WITH PARENTS') || '';

  const hasStructure = fusionName && (personality || appearance || lore);

  // Trait pills from personality text
  const traitPills = personality
    ? personality.split(/[,\n]/).map(t=>t.replace(/^\d+[\.\)]\s*/,'').trim()).filter(t=>t.length>1&&t.length<60)
        .map(t=>`<span style="background:${primary}22;color:${primary};border:1px solid ${primary}44;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700">${escHTML(t)}</span>`).join('')
    : '';

  const abilityPills = abilities
    ? abilities.split(/[,\n]/).map(a=>a.replace(/^\d+[\.\)–\-]\s*/,'').trim()).filter(a=>a.length>1&&a.length<80)
        .map(a=>`<span style="background:${accent}22;color:${accent};border:1px solid ${accent}44;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700">✦ ${escHTML(a)}</span>`).join('')
    : '';

  function avaEl(c) {
    return c.avatar
      ? `<img src="${c.avatar}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${primary}55;flex-shrink:0">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--bg3);border:2px solid ${primary}55;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--text2);flex-shrink:0">${escHTML((c.name||'?')[0])}</div>`;
  }

  const infoBlock = (label, val) => val ? `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
      <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">${label}</div>
      <div style="font-size:13px;color:var(--text);line-height:1.6">${escHTML(val)}</div>
    </div>` : '';

  // Palette swatches with copy-on-click
  const swatchRow = [primary, light, deep, accent].map(col => `
    <div onclick="copyText('${col}');toast('Copied ${col}!')"
      title="${col} — click to copy"
      style="width:40px;height:40px;border-radius:9px;background:${col};
        box-shadow:0 3px 12px ${col}66;cursor:pointer;transition:transform .1s;flex-shrink:0"
      onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'">
    </div>`).join('');

  const childrenNote = children.length ? `
    <div style="font-size:11px;color:var(--text3);margin-top:6px">
      ✦ AI read ${children.length} known ${children.length===1?'child':'children'}: ${children.map(k=>escHTML(k.name)).join(', ')}
    </div>` : '';

  // Saved state for reroll button
  const saveId = `fl-save-${Date.now()}`;

  return `
    <div style="border-radius:16px;overflow:hidden;border:1px solid ${primary}44;box-shadow:0 0 40px ${primary}18">

      <!-- Gradient header -->
      <div style="background:${grad};padding:22px 26px 18px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 18px,rgba(255,255,255,.03) 18px,rgba(255,255,255,.03) 19px)"></div>
        <div style="position:relative;z-index:1">
          <div style="font-size:10px;letter-spacing:2px;font-weight:800;color:rgba(255,255,255,.65);margin-bottom:6px">${isKid?'🌱 CONCEIVED CHILD':'⬡ AI FUSION RESULT'}</div>
          <div style="font-family:'Cinzel',serif;font-size:26px;font-weight:700;color:#fff;line-height:1.1;text-shadow:0 2px 12px rgba(0,0,0,.4)">${escHTML(fusionName)}</div>
          ${fusionSpecies ? `<div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;font-style:italic">${escHTML(fusionSpecies)}</div>` : ''}
        </div>
      </div>

      <!-- Parent row -->
      <div style="background:var(--bg2);padding:12px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">${avaEl(charA)}<div><div style="font-weight:700;font-size:13px">${escHTML(charA.name)}</div><div style="font-size:11px;color:var(--text3)">${escHTML(charA.species||'?')}</div></div></div>
        <div style="font-size:20px;color:${primary};font-weight:700;margin:0 6px">${isKid?'🌱':'⬡'}</div>
        <div style="display:flex;align-items:center;gap:8px">${avaEl(charB)}<div><div style="font-weight:700;font-size:13px">${escHTML(charB.name)}</div><div style="font-size:11px;color:var(--text3)">${escHTML(charB.species||'?')}</div></div></div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px" onclick="flGenerate()">🔀 ${t('common.reroll')||'Re-roll'}</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px" onclick="copyText(${JSON.stringify(raw)})">${t('aiTool.copyRaw')||'Copy Raw'}</button>
        </div>
      </div>
      ${childrenNote ? `<div style="padding:8px 24px;background:var(--bg2);border-bottom:1px solid var(--border)">${childrenNote}</div>` : ''}

      <!-- Body -->
      <div style="padding:20px 24px;background:var(--card);display:flex;flex-direction:column;gap:16px">

        ${hasStructure ? `

          <!-- Stats grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
            ${infoBlock(isKid?(t('aiTool.flSpecies')||'SPECIES'):(t('aiTool.flFusedSpecies')||'FUSED SPECIES'), fusionSpecies)}
            ${infoBlock(t('aiTool.flAge')||'AGE', fusionAge)}
            ${!isKid ? infoBlock(t('aiTool.flDominantSoul')||'DOMINANT SOUL', dominant) : ''}
            ${isKid ? infoBlock(t('aiTool.flParentRel')||'RELATIONSHIP WITH PARENTS', parentRel) : ''}
          </div>

          <!-- Appearance -->
          ${appearance ? `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
            <div style="padding:9px 14px;background:var(--bg3);border-bottom:1px solid var(--border)">
              <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase">${t('aiTool.flAppearanceLabel')||'Appearance'}</div>
            </div>
            <div style="padding:12px 16px;font-size:13px;color:var(--text2);line-height:1.8">${escHTML(appearance)}</div>
          </div>` : ''}

          <!-- Personality -->
          ${traitPills ? `
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">${t('aiTool.flPersonalityBlend')||'Personality Blend'}</div>
            <div style="display:flex;flex-wrap:wrap;gap:7px">${traitPills}</div>
          </div>` : ''}

          <!-- Abilities -->
          ${abilityPills ? `
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">${isKid?(t('aiTool.flAbilities')||'Abilities'):(t('aiTool.flFusedAbilities')||'Fused Abilities')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:7px">${abilityPills}</div>
          </div>` : ''}

          <!-- Voice -->
          ${voice ? `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 16px">
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px">${t('aiTool.flVoiceSpeech')||'Voice & Speech'}</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.7;font-style:italic">${escHTML(voice)}</div>
          </div>` : ''}

          <!-- Lore -->
          ${lore ? `
          <div style="background:${gradSoft};border:1px solid ${primary}33;border-radius:12px;padding:14px 16px">
            <div style="font-size:10px;letter-spacing:1.5px;color:${primary};font-weight:800;margin-bottom:7px">${t('aiTool.flLoreLabel')||'✦ LORE'}</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.8">${escHTML(lore)}</div>
          </div>` : ''}

          <!-- Inner conflict -->
          ${conflict ? `
          <div style="background:#1a0a0a;border:1px solid #ef444433;border-radius:10px;padding:12px 16px">
            <div style="font-size:10px;font-weight:800;color:#ef4444aa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px">${isKid?(t('aiTool.flCoreTension')||'Core Tension'):(t('aiTool.flInnerConflict')||'Inner Conflict')}</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.7">${escHTML(conflict)}</div>
          </div>` : ''}

          <!-- Palette -->
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">${t('aiTool.flFusionPalette')||'Fusion Palette'} <span style="font-weight:400;font-size:10px">${t('aiTool.flClickCopyHex')||'— click to copy hex'}</span></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${swatchRow}
              ${paletteNote ? `<div style="font-size:12px;color:var(--text3);line-height:1.6;flex:1;min-width:160px;font-style:italic">"${escHTML(paletteNote)}"</div>` : ''}
            </div>
          </div>

        ` : `
          <!-- Raw fallback -->
          <div style="font-size:13px;color:var(--text2);line-height:1.9;white-space:pre-wrap">${escHTML(raw)}</div>
        `}
      </div>
    </div>`;
}


/* =====================================================
   SCENE ENGINE
===================================================== */
function renderAISceneEngine() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;

  if (characters.length < 1) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div>
      <div class="empty-title">${t('aiTool.seNoChars')||'No characters yet'}</div>
      <div class="empty-desc">${t('aiTool.seNoCharsDesc')||'Add at least one character to use the Scene Engine.'}</div></div>`;
    return;
  }

  const opts = characters.map(c =>
    `<option value="${c.id}">${escHTML(c.name)}${c.species?' ('+escHTML(c.species)+')':''}</option>`
  ).join('');

  const sceneTypes = [
    ['dialogue',  t('aiTool.seDialogueLabel')||'💬 Dialogue',       t('aiTool.seDialogueDesc')||'Back-and-forth conversation — banter, tension, confession, or conflict'],
    ['action',    t('aiTool.seActionLabel')||'⚔ Action',            t('aiTool.seActionDesc')||'A kinetic scene — fight, chase, survival, a moment of high stakes'],
    ['slice',     t('aiTool.seSliceLabel')||'🌙 Slice of Life',     t('aiTool.seSliceDesc')||'Low-stakes intimacy — a quiet moment, daily life, character texture'],
    ['emotional', t('aiTool.seEmotionalLabel')||'💔 Emotional',     t('aiTool.seEmotionalDesc')||'An intense emotional beat — argument, reunion, grief, breakthrough'],
    ['mystery',   t('aiTool.seMysteryLabel')||'🔍 Mystery/Tension', t('aiTool.seMysteryDesc')||'Slow burn dread, investigation, or a reveal neither expected'],
  ];

  const lengthOpts = [
    ['short',  t('aiTool.seShort')||'Short (~250 words)'],
    ['medium', t('aiTool.seMedium')||'Medium (~500 words)'],
    ['long',   t('aiTool.seLong')||'Long (~750 words)'],
  ];

  cont.innerHTML = `
    <div style="max-width:700px">
      <div style="margin-bottom:20px">
        <div style="font-family:'Cinzel',serif;font-size:17px;font-weight:700;margin-bottom:6px">${t('aiTool.seTitle')||'⚡ Scene Engine'}</div>
        <div style="font-size:13px;color:var(--text3);line-height:1.6">
          ${t('aiTool.seDesc')||'Drop your characters in and get a fully written scene — using their actual personalities, relationships, backstories, and lore as the source material.'}
        </div>
      </div>

      <!-- Character selectors -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">${t('aiTool.seCharsSection')||'Characters'}</div>

        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:flex-end;margin-bottom:12px">
          <div>
            <div class="form-label">${t('form.characterA')||'Character A'} <span style="color:var(--text3);font-weight:400">${t('aiTool.charARequired')||'(required)'}</span></div>
            <select class="form-select" id="se-char-a" onchange="seUpdatePreviews()">
              <option value="">${t('aiTool.sePickChar')||'— Pick a character —'}</option>
              ${opts}
            </select>
          </div>
          <div style="font-size:20px;color:var(--accent);padding-bottom:8px;text-align:center">⚡</div>
          <div>
            <div class="form-label">${t('form.characterB')||'Character B'} <span style="color:var(--text3);font-weight:400">${t('aiTool.charBOptional')||'(optional)'}</span></div>
            <select class="form-select" id="se-char-b" onchange="seUpdatePreviews()">
              <option value="">${t('aiTool.seSoloScene')||'— Solo scene —'}</option>
              ${opts}
            </select>
          </div>
        </div>

        <!-- Character previews -->
        <div style="display:flex;gap:10px" id="se-previews"></div>
      </div>

      <!-- Scene type -->
      <div style="margin-bottom:16px">
        <div class="form-label">${t('aiTool.seSceneType')||'Scene Type'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="se-type-btns">
          ${sceneTypes.map(([val, label, desc], i) => `
            <div onclick="seSetType('${val}')" data-setype="${val}"
              style="flex:1;min-width:150px;cursor:pointer;border-radius:10px;padding:9px 13px;
                border:1.5px solid ${i===0?'var(--accent)':'var(--border)'};
                background:${i===0?'var(--accent-glow)':'var(--bg2)'};transition:all .15s">
              <div style="font-size:12px;font-weight:700;color:${i===0?'var(--accent)':'var(--text)'};margin-bottom:2px">${label}</div>
              <div style="font-size:11px;color:var(--text3);line-height:1.4">${desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Scene length + POV -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          <div class="form-label">${t('aiTool.seLength')||'Length'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${lengthOpts.map(([val, label], i) => `
              <div onclick="seSetLength('${val}')" data-selength="${val}"
                style="flex:1;text-align:center;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
                  border:1.5px solid ${i===1?'var(--accent)':'var(--border)'};
                  background:${i===1?'var(--accent-glow)':'var(--bg2)'};color:${i===1?'var(--accent)':'var(--text2)'};transition:all .15s">
                ${label}
              </div>`).join('')}
          </div>
        </div>
        <div>
          <div class="form-label">${t('aiTool.sePOV')||'POV'}</div>
          <select class="form-select" id="se-pov">
            <option value="third_close">${t('aiTool.sePOVThirdClose')||'Third person close (intimate)'}</option>
            <option value="third_omni">${t('aiTool.sePOVThirdOmni')||'Third person omniscient'}</option>
            <option value="first_a">${t('aiTool.sePOVFirstA')||'First person — Character A'}</option>
            <option value="first_b">${t('aiTool.sePOVFirstB')||'First person — Character B'}</option>
            <option value="second">${t('aiTool.sePOVSecond')||'Second person (you)'}</option>
          </select>
        </div>
        <div>
          <div class="form-label">${t('aiTool.seOutputStyle')||'Output Style'}</div>
          <select class="form-select" id="se-output-style">
            <option value="narrative">${t('aiTool.seNarrative')||'📖 Narrative — prose paragraphs'}</option>
            <option value="script">${t('aiTool.seScript')||'🎬 Script — dialogue with name labels'}</option>
          </select>
        </div>
      </div>

      <!-- Tone tags -->
      <div style="margin-bottom:16px">
        <div class="form-label">${t('aiTool.seToneTags')||'Tone Tags'} <span style="font-weight:400;color:var(--text3)">${t('aiTool.seToneTagsHint')||'(pick any)'}</span></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap" id="se-tone-tags">
          ${[
            ['angsty', t('aiTool.seToneAngsty')||'angsty'],
            ['slow burn', t('aiTool.seToneSlowBurn')||'slow burn'],
            ['found family', t('aiTool.seToneFoundFamily')||'found family'],
            ['enemies to lovers', t('aiTool.seToneEnemiesToLovers')||'enemies to lovers'],
            ['hurt/comfort', t('aiTool.seToneHurtComfort')||'hurt/comfort'],
            ['darkfic', t('aiTool.seToneDarkfic')||'darkfic'],
            ['fluff', t('aiTool.seToneFluff')||'fluff'],
            ['bittersweet', t('aiTool.seToneBittersweet')||'bittersweet'],
            ['cracky', t('aiTool.seToneCracky')||'cracky'],
            ['poetic', t('aiTool.seTonePoetic')||'poetic'],
            ['cinematic', t('aiTool.seToneCinematic')||'cinematic'],
            ['raw & emotional', t('aiTool.seToneRawEmotional')||'raw & emotional'],
            ['tense', t('aiTool.seToneTense')||'tense'],
            ['hopeful', t('aiTool.seToneHopeful')||'hopeful'],
            ['melancholic', t('aiTool.seToneMelancholic')||'melancholic'],
            ['playful', t('aiTool.seTonePlayful')||'playful'],
          ].map(([val, label]) => `<span onclick="seToggleTone(this,'${val}')" data-tone="${val}"
              style="padding:3px 11px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;cursor:pointer;color:var(--text2);transition:all .15s">${label}</span>`
            ).join('')}
        </div>
      </div>

      <!-- Setting / direction -->
      <div style="margin-bottom:16px">
        <div class="form-label">${t('aiTool.seSettingContext')||'Setting / Context'} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <input class="form-input" id="se-setting" placeholder="${t('aiTool.seSettingPlaceholder')||'e.g. After a battle, in a crumbling library, years after they last spoke…'}">
      </div>

      <div style="margin-bottom:20px">
        <div class="form-label">${t('aiTool.seAuthorDir')||"Author's Direction"} <span style="font-weight:400;color:var(--text3)">${t('ocf.optional')||'(optional)'}</span></div>
        <textarea class="form-textarea" id="se-extra" style="min-height:70px"
          placeholder="${t('aiTool.seAuthorDirPlaceholder')||'e.g. Focus on the moment they realise something has changed. End on an unresolved beat.'}"></textarea>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="display:flex;align-items:center;gap:8px" onclick="seGenerate()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${t('aiTool.seGenBtn')||'Generate Scene'}
        </button>
        <button class="btn btn-ghost" style="font-size:13px" onclick="seRandomize()">${t('aiTool.seRandomize')||'🎲 Randomize'}</button>
      </div>
    </div>

    <div id="se-result" style="margin-top:24px"></div>`;

  // Init defaults
  window._seType   = 'dialogue';
  window._seLength = 'medium';
  window._seTones  = new Set();

  requestAnimationFrame(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    seUpdatePreviews();
  });
}

function seSetType(val) {
  window._seType = val;
  document.querySelectorAll('[data-setype]').forEach(el => {
    const active = el.dataset.setype === val;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background  = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.querySelector('div').style.color = active ? 'var(--accent)' : 'var(--text)';
  });
}

function seSetLength(val) {
  window._seLength = val;
  document.querySelectorAll('[data-selength]').forEach(el => {
    const active = el.dataset.selength === val;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background  = active ? 'var(--accent-glow)' : 'var(--bg2)';
    el.style.color       = active ? 'var(--accent)'      : 'var(--text2)';
  });
}

function seToggleTone(el, tone) {
  if (!window._seTones) window._seTones = new Set();
  const on = window._seTones.has(tone);
  if (on) {
    window._seTones.delete(tone);
    el.style.background   = 'transparent';
    el.style.borderColor  = 'var(--border)';
    el.style.color        = 'var(--text2)';
  } else {
    window._seTones.add(tone);
    el.style.background   = 'var(--accent-glow)';
    el.style.borderColor  = 'var(--accent)';
    el.style.color        = 'var(--accent)';
  }
}

function seUpdatePreviews() {
  const idA = document.getElementById('se-char-a')?.value;
  const idB = document.getElementById('se-char-b')?.value;
  const wrap = document.getElementById('se-previews');
  if (!wrap) return;
  const prev = id => {
    if (!id) return '';
    const c = characters.find(x => x.id === id);
    if (!c) return '';
    const ava = c.avatar
      ? `<img src="${c.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)44;flex-shrink:0">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--bg3);border:2px solid var(--accent)44;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--text2);flex-shrink:0">${escHTML((c.name||'?')[0])}</div>`;
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg3);border-radius:8px;padding:6px 10px">
      ${ava}
      <div>
        <div style="font-size:12px;font-weight:700">${escHTML(c.name)}</div>
        <div style="font-size:10px;color:var(--text3)">${escHTML([c.species,c.pronouns].filter(Boolean).join(' · '))}</div>
      </div>
    </div>`;
  };
  wrap.innerHTML = prev(idA) + (idB ? prev(idB) : '');
}

function seRandomize() {
  const shuffled = [...characters].sort(() => Math.random() - .5);
  const selA = document.getElementById('se-char-a');
  const selB = document.getElementById('se-char-b');
  if (selA && shuffled[0]) selA.value = shuffled[0].id;
  if (selB && shuffled[1]) selB.value = shuffled[1].id;
  seUpdatePreviews();
  const types   = ['dialogue','action','slice','emotional','mystery'];
  const lengths = ['short','medium','long'];
  seSetType(types[Math.floor(Math.random()*types.length)]);
  seSetLength(lengths[Math.floor(Math.random()*lengths.length)]);
  toast('Randomized!', 'info', 1800);
}

function seBuildPrompt(charA, charB, sceneType, sceneLength, pov, tones, setting, extra, outputStyle='narrative') {
  const typeDesc = {
    dialogue:  'character-driven dialogue scene — witty, revealing, loaded with subtext',
    action:    'kinetic action/confrontation scene with tension and momentum',
    slice:     'slice-of-life quiet moment — domestic, tender, ordinary made meaningful',
    emotional: 'raw emotional scene — vulnerability, conflict, grief, or breakthrough',
    mystery:   'mystery/tension scene — something is hidden, wrong, or building',
  };
  const povDesc = {
    third_close:'third-person close (stay tightly inside one character\'s head)',
    third_omni: 'third-person omniscient (float freely between perspectives)',
    first_a:    `first-person as ${charA.name}`,
    first_b:    charB ? `first-person as ${charB.name}` : `first-person as ${charA.name}`,
    second:     'second-person (the reader is "you")',
  };
  const wordTargets = { short:'200–300', medium:'400–550', long:'650–800' };

  // Age-aware voice hint for each character
  function ageHint(c) {
    const n = parseInt(c.age);
    if (!isNaN(n)) {
      if (n < 1)  return `${c.name} is a baby — no words, only sounds, gestures, expressions.`;
      if (n <= 3) return `${c.name} is a toddler — 1-3 word sentences, mispronounces things, very simple.`;
      if (n <= 6) return `${c.name} is a young child — short sentences, innocent, curious, easily distracted.`;
      if (n <= 12)return `${c.name} is a child — playful, blunt, energetic.`;
      if (n <= 17)return `${c.name} is a teenager.`;
    }
    if (c.age) {
      const a = c.age.toLowerCase();
      if (/baby|infant|newborn/.test(a)) return `${c.name} is a baby — no words, only sounds and expressions.`;
      if (/toddler/.test(a)) return `${c.name} is a toddler — very few words, simple.`;
      if (/child|kid/.test(a)) return `${c.name} is a child — playful, innocent, energetic.`;
    }
    return null;
  }

  const ageHints = [charA, charB].filter(Boolean).map(ageHint).filter(Boolean);
  const ageBlock = ageHints.length ? `\nAGE-SPECIFIC VOICE:\n${ageHints.map(h=>`- ${h}`).join('\n')}` : '';

  // Output format block — CRITICAL, stated early
  const formatBlock = outputStyle === 'script'
    ? `OUTPUT FORMAT — SCRIPT STYLE (MANDATORY):
Every line must be: CHARACTERNAME: (optional action beat) dialogue
Scene directions go in [brackets] on their own line.
NO flowing prose. NO narrative paragraphs. Pure script only.
Example:
EZREAL: (glancing away) You didn't have to come.
SETSUEN: (softly) I know.`
    : `OUTPUT FORMAT — NARRATIVE PROSE (MANDATORY):
Write in flowing prose. NO name labels before dialogue. NO script formatting.
Target: ${wordTargets[sceneLength]||'500–700'} words across 5 well-developed paragraphs.
Each paragraph blends action and dialogue naturally. Vary sentence length.
Do NOT start consecutive paragraphs the same way.`;

  const charBlock = c => {
    const relToOther = charB ? (c.relationships||[]).find(r =>
      r.targetId === (c.id===charA.id ? charB : charA).id ||
      r.targetName?.toLowerCase() === (c.id===charA.id ? charB : charA).name?.toLowerCase()
    ) : null;
    const fields = [
      ['Name',         c.name],
      ['Species',      c.species],
      ['Age',          c.age],
      ['Gender',       c.gender],
      ['Pronouns',     c.pronouns],
      ['Personality',  [c.traits, c.personalityDesc].filter(Boolean).join('\n')],
      ['Strengths',    c.strengths],
      ['Weaknesses',   c.weaknesses],
      ['Likes',        c.likes],
      ['Dislikes',     c.dislikes],
      ['Habits',       c.habits],
      ['Speech style', c.quotes ? `Voice samples: "${c.quotes.slice(0,300)}"` : null],
      ['Abilities',    c.abilities],
      ['Appearance',   [c.hair, c.eyes, c.features].filter(Boolean).join('; ')],
      ['Outfit',       c.outfit],
      ['Backstory',    c.backstory ? c.backstory.slice(0,500)+(c.backstory.length>500?'…':'') : null],
      ['Occupation',   c.occupation],
      [`Relationship with ${charB ? (c.id===charA.id?charB.name:charA.name) : 'others'}`,
        relToOther ? `${relToOther.type}${relToOther.notes?' — "'+relToOther.notes+'"':''}` : null],
    ].filter(([,v]) => v && String(v).trim());
    return `=== ${c.name} ===\n` + fields.map(([k,v]) => `${k}: ${v}`).join('\n');
  };

  const charSection = charB ? `${charBlock(charA)}\n\n${charBlock(charB)}` : charBlock(charA);
  const toneStr    = tones.size ? `Tone: ${[...tones].join(', ')}` : '';
  const settingStr = setting ? `Setting: ${setting}` : '';
  const extraStr   = extra   ? `Author's direction: ${extra}` : '';
  const soloOrDuo  = charB
    ? `Write a scene featuring ${charA.name} and ${charB.name}.`
    : `Write a solo scene featuring ${charA.name}.`;

  return `You are a creative fiction writer. Follow ALL instructions below exactly.

${formatBlock}${ageBlock}

SCENE INSTRUCTIONS:
${soloOrDuo}
Scene type: ${typeDesc[sceneType]||sceneType}
POV: ${povDesc[pov]||pov}
Target length: ${wordTargets[sceneLength]||'500–700'} words
${toneStr}
${settingStr}
${extraStr}

CHARACTER DATA (use these deeply — specific details, not generic):
${charSection}

CRAFT RULES:
- Use each character's actual speech habits and personality — not generic versions.
${charB ? `- Let their relationship dynamic drive the subtext.` : ''}
- Use CORRECT PRONOUNS for every character at all times — they are stated in the character data above.
- Do NOT invent new characters, relationships, or backstory details not present in the character data.
- Do NOT repeat the same phrases, sentences, or beats within the scene.
- No chapter headings, no meta-commentary, no preamble. Start the scene immediately.
- End in a way that feels complete but not over-explained.
- FOLLOW THE OUTPUT FORMAT stated above. It is not optional.

Write the scene now:`;
}


async function seGenerate() {
  const idA     = document.getElementById('se-char-a')?.value;
  const idB     = document.getElementById('se-char-b')?.value;
  const pov         = document.getElementById('se-pov')?.value          || 'third_close';
  const outputStyle = document.getElementById('se-output-style')?.value  || 'narrative';
  const setting = document.getElementById('se-setting')?.value?.trim() || '';
  const extra   = document.getElementById('se-extra')?.value?.trim()   || '';
  const resultEl = document.getElementById('se-result');
  if (!resultEl) return;

  if (!idA) { toast('Pick at least one character!', 'warn'); return; }
  if (idA === idB) { toast('Pick two different characters!', 'warn'); return; }

  const charA  = characters.find(c => c.id === idA);
  let   charB  = idB ? characters.find(c => c.id === idB) : null;
  if (!charA) return;

  // Merge full character data from file (same as Fusion Lab, OC Forge, etc.)
  const merged = await Promise.all([
    charMergeFromFile(charA),
    charB ? charMergeFromFile(charB) : Promise.resolve(null),
  ]);
  const richA = merged[0];
  const richB = merged[1];

  const sceneType   = window._seType   || 'dialogue';
  const sceneLength = window._seLength || 'medium';
  const tones       = window._seTones  || new Set();

  const ok = await ollamaCheck();
  if (!ok) { resultEl.innerHTML = ocfErrorHTML('Ollama is not running.'); return; }

  const prompt = seBuildPrompt(richA, richB, sceneType, sceneLength, pov, tones, setting, extra, outputStyle);

  if (settings.aiStreaming !== false) {
    resultEl.innerHTML = ocfStreamHTML('sceneengine');
    const liveEl = document.getElementById('ocf-stream-live');
    const statEl = document.getElementById('ocf-stream-status');
    let raw = '';
    try {
      raw = await aiGenerateStream(prompt, (token, full) => {
        if (liveEl) { liveEl.textContent = full; liveEl.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
      });
      if (statEl) statEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>Done — rendering…</span>`;
      await new Promise(r => setTimeout(r, 280));
      resultEl.innerHTML = seRenderResult(richA, richB, sceneType, sceneLength, tones, raw.trim(), prompt);
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  } else {
    resultEl.innerHTML = ocfLoadingHTML();
    try {
      const raw = await aiGenerate(prompt);
      resultEl.innerHTML = seRenderResult(richA, richB, sceneType, sceneLength, tones, raw.trim(), prompt);
    } catch(e) { resultEl.innerHTML = ocfErrorHTML(e.message); }
  }
}

function seRenderResult(charA, charB, sceneType, sceneLength, tones, raw, prompt) {
  const typeLabels = { dialogue:'💬 Dialogue', action:'⚔ Action', slice:'🌙 Slice of Life', emotional:'💔 Emotional', mystery:'🔍 Mystery/Tension' };
  const title = charB ? `${charA.name} & ${charB.name}` : charA.name;
  const sub   = [typeLabels[sceneType]||sceneType, ...[...tones].slice(0,3)].join(' · ');

  function avaEl(c) {
    return c.avatar
      ? `<img src="${c.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.25);flex-shrink:0">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0">${escHTML((c.name||'?')[0])}</div>`;
  }

  const wordCount = raw.split(/\s+/).filter(Boolean).length;

  return `
    <div style="border-radius:16px;overflow:hidden;border:1px solid var(--accent)33;box-shadow:0 0 40px var(--accent)0d">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,var(--accent2),var(--accent));padding:18px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 18px,rgba(255,255,255,.03) 18px,rgba(255,255,255,.03) 19px)"></div>
        <div style="position:relative;z-index:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;gap:-8px">
            ${avaEl(charA)}
            ${charB ? `<div style="margin-left:-10px">${avaEl(charB)}</div>` : ''}
          </div>
          <div>
            <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.3)">${escHTML(title)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">${escHTML(sub)}</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 11px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="seGenerate()">🔀 ${t('common.reroll')||'Re-roll'}</button>
            <button class="btn btn-ghost" style="font-size:11px;padding:4px 11px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="copyText(${JSON.stringify(raw)})">${t('common.copy')||'Copy'}</button>
          </div>
        </div>
      </div>

      <!-- Scene body -->
      <div style="background:var(--card);padding:24px 28px;border-bottom:1px solid var(--border)">
        <div style="font-size:14px;color:var(--text);line-height:2;white-space:pre-wrap;font-family:'Nunito',sans-serif">${escHTML(raw)}</div>
      </div>

      <!-- Footer -->
      <div style="background:var(--bg2);padding:10px 22px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--text3)">~${wordCount} ${t('aiTool.seWords')||'words'}</div>
        <div style="font-size:11px;color:var(--text3)">·</div>
        <div style="font-size:11px;color:var(--text3)">${escHTML([...tones].join(', ')||(t('aiTool.seNoToneTags')||'no tone tags'))}</div>
      </div>
    </div>`;
}


/* =====================================================
   LORE FORGE — seed concept → structured lorebook entry
===================================================== */
let _loreForge = { abortCtrl: null };

function renderAILoreForge() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;
  const charOpts = '<option value="">' + (t('aiTool.lfNoCharContext')||'— No character context —') + '</option>' +
    characters.map(c => '<option value="' + c.id + '">' + escHTML(c.name) + (c.species ? ' · ' + escHTML(c.species) : '') + '</option>').join('');

  const allSections = [
    ['Overview',             t('aiTool.lfSecOverview')||'Overview'],
    ['Biology / Nature',     t('aiTool.lfSecBiology')||'Biology / Nature'],
    ['Function / Purpose',   t('aiTool.lfSecFunction')||'Function / Purpose'],
    ['Known Users',          t('aiTool.lfSecKnownUsers')||'Known Users'],
    ['Side Effects / Risks', t('aiTool.lfSecSideEffects')||'Side Effects / Risks'],
    ['Variants',             t('aiTool.lfSecVariants')||'Variants'],
    ['History / Origins',    t('aiTool.lfSecHistory')||'History / Origins'],
    ['Cultural Significance',t('aiTool.lfSecCultural')||'Cultural Significance'],
    ['Weaknesses',           t('aiTool.lfSecWeaknesses')||'Weaknesses'],
    ['Rarity',               t('aiTool.lfSecRarity')||'Rarity'],
    ['Rumors & Myths',       t('aiTool.lfSecRumors')||'Rumors & Myths'],
  ];
  const sectionPills = allSections.map(([val, label]) =>
    '<span onclick="lfToggleSection(this)" data-section="' + val + '" data-on="1" style="padding:3px 11px;border-radius:20px;border:1px solid var(--accent);background:var(--accent-glow);font-size:11px;font-weight:700;cursor:pointer;color:var(--accent);transition:all .15s">' + escHTML(label) + '</span>'
  ).join('');

  cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:18px">'
    + '<div class="card">'
    + '<div style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">' + (t('aiTool.lfTitle')||'📚 Lore Forge') + '</div>'
    + '<div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6">' + (t('aiTool.lfDesc')||'Write a seed — a concept, creature, item, location, phenomenon, faction, or any worldbuilding idea. The AI expands it into a structured lorebook entry.') + '</div>'
    + '<div style="margin-bottom:14px"><div class="form-label">' + (t('aiTool.lfLoreSeed')||'Lore Seed') + '</div>'
    + '<textarea class="form-textarea" id="lf-seed" style="min-height:80px" placeholder="' + (t('aiTool.lfSeedPlaceholder')||'e.g. Animasignis are gem-like organs found in sins and virtues that store emotional energy…') + '"></textarea></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><div class="form-label">' + (t('aiTool.lfCategory')||'Category') + '</div><select class="form-select" id="lf-category">'
    + '<option value="creature">' + (t('aiTool.lfCatCreature')||'Creature / Species') + '</option><option value="item">' + (t('aiTool.lfCatItem')||'Item / Artifact') + '</option>'
    + '<option value="location">' + (t('aiTool.lfCatLocation')||'Location / Place') + '</option><option value="phenomenon">' + (t('aiTool.lfCatPhenomenon')||'Phenomenon / Magic / Power') + '</option>'
    + '<option value="faction">' + (t('aiTool.lfCatFaction')||'Faction / Organization') + '</option><option value="concept">' + (t('aiTool.lfCatConcept')||'Abstract Concept / Law') + '</option>'
    + '<option value="event">' + (t('aiTool.lfCatEvent')||'Historical Event') + '</option><option value="custom">' + (t('aiTool.lfCatCustom')||'Other / Let AI decide') + '</option>'
    + '</select></div>'
    + '<div><div class="form-label">' + (t('aiTool.lfCharContext')||'Character Context') + ' <span style="font-weight:400;color:var(--text3)">' + (t('ocf.optional')||'(optional)') + '</span></div>'
    + '<select class="form-select" id="lf-char">' + charOpts + '</select></div></div>'
    + '<div style="margin-bottom:16px"><div class="form-label">' + (t('aiTool.lfSectionsLabel')||'Sections') + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px" id="lf-sections">' + sectionPills + '</div>'
    + '<div style="font-size:10px;color:var(--text3);margin-top:6px">' + (t('aiTool.lfSectionsHint')||'Click to toggle on/off.') + '</div></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-primary" id="lf-gen-btn" onclick="lfGenerate()">' + (t('aiTool.lfForgeBtn')||'📚 Forge Entry') + '</button>'
    + '<button class="btn btn-ghost" id="lf-stop-btn" style="display:none;color:#ef4444;border-color:#ef444466" onclick="lfStop()">■ Stop</button>'
    + '</div></div>'
    + '<div id="lf-result" style="display:none"></div></div>';
}

function lfToggleSection(el) {
  const on = el.dataset.on === '1';
  el.dataset.on        = on ? '0' : '1';
  el.style.background  = on ? 'var(--bg2)'         : 'var(--accent-glow)';
  el.style.borderColor = on ? 'var(--border)'       : 'var(--accent)';
  el.style.color       = on ? 'var(--text3)'        : 'var(--accent)';
}

function lfGetSections() {
  return [...document.querySelectorAll('#lf-sections [data-section]')]
    .filter(el => el.dataset.on === '1').map(el => el.dataset.section);
}

async function lfGenerate() {
  const seed     = (document.getElementById('lf-seed')?.value || '').trim();
  const category = document.getElementById('lf-category')?.value || 'custom';
  const charId   = document.getElementById('lf-char')?.value;
  const sections = lfGetSections();
  if (!seed)             { toast('Write a lore seed first!', 'warn'); return; }
  if (!sections.length)  { toast('Select at least one section!', 'warn'); return; }
  const ok = await ollamaCheck();
  if (!ok) { toast('Ollama not running', 'error'); return; }

  const char = charId ? characters.find(c => c.id === charId) : null;
  const charCtx = char
    ? '\n\nCHARACTER CONTEXT — this lore is connected to:\nName: ' + char.name
      + '\nSpecies: ' + (char.species||'?')
      + '\nBackstory: ' + (char.backstory||'').slice(0,400)
    : '';

  const prompt = 'You are a worldbuilding assistant. Expand the following lore seed into a structured lorebook entry.\n\n'
    + 'LORE SEED:\n"' + seed + '"\n\nCATEGORY: ' + category + charCtx + '\n\n'
    + 'Generate ONLY these sections in order, each as ALL-CAPS header followed by a colon then 2-4 sentences of rich in-world prose:\n'
    + sections.map((s,i) => (i+1) + '. ' + s).join('\n')
    + '\n\nRULES:\n- Write in an authoritative encyclopaedia tone.\n- Be specific and inventive. Avoid generic filler.\n'
    + '- Do NOT repeat information across sections.\n- No intro or summary text before the first header.\n\nBegin:';

  const model   = settings.ollamaModel || 'mistral';
  const genBtn  = document.getElementById('lf-gen-btn');
  const stopBtn = document.getElementById('lf-stop-btn');
  const resultEl= document.getElementById('lf-result');
  if (genBtn)  genBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="card"><div id="lf-stream" style="font-size:12px;color:var(--text3);white-space:pre-wrap">Forging lore entry…</div></div>';

  _loreForge.abortCtrl = new AbortController();
  let raw = '';
  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      signal: _loreForge.abortCtrl.signal,
      body: JSON.stringify({ model, prompt, stream: true })
    });
    const reader = resp.body.getReader(), dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value).split('\n').filter(Boolean)) {
        try { const j = JSON.parse(line); if (j.response) raw += j.response; } catch {}
      }
      const el = document.getElementById('lf-stream');
      if (el) el.textContent = raw;
    }
  } catch(e) { if (e.name !== 'AbortError') toast('Error: ' + e.message, 'error'); }

  lfRenderResult(raw.trim(), seed);
  if (stopBtn) stopBtn.style.display = 'none';
  if (genBtn)  genBtn.disabled = false;
}

function lfStop() {
  _loreForge.abortCtrl?.abort();
  document.getElementById('lf-stop-btn').style.display = 'none';
  document.getElementById('lf-gen-btn').disabled = false;
}

function lfRenderResult(raw, seed) {
  const resultEl = document.getElementById('lf-result');
  if (!resultEl) return;
  window._lfLastRaw = raw; // safe storage for copy button
  // Parse ALL-CAPS headers
  const parsed = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z][A-Z\s\/&\-]{2,}[A-Z\/]):\s*(.*)/);
    if (m) { if (cur) parsed.push(cur); cur = { title: m[1], body: m[2] ? m[2] + '\n' : '' }; }
    else if (cur) cur.body += line + '\n';
    else if (line.trim()) { if (!cur) cur = { title:'OVERVIEW', body:'' }; cur.body += line + '\n'; }
  }
  if (cur) parsed.push(cur);

  const sections = parsed.length
    ? parsed.map(s =>
        '<div style="margin-bottom:20px">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:10px;font-weight:700;color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">' + escHTML(s.title) + '</div>'
        + '<div style="font-size:13px;color:var(--text);line-height:1.9">' + escHTML(s.body.trim()) + '</div>'
        + '</div>').join('')
    : '<div style="white-space:pre-wrap;font-size:13px;color:var(--text)">' + escHTML(raw) + '</div>';

  resultEl.innerHTML = '<div style="border-radius:16px;overflow:hidden;border:1px solid var(--accent)33">'
    + '<div style="background:linear-gradient(135deg,var(--accent2),var(--accent));padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px">'
    + '<div><div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#fff">📚 Lore Entry</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">' + escHTML(seed.slice(0,60)) + (seed.length>60?'…':'') + '</div></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-ghost" style="font-size:11px;padding:4px 11px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="lfGenerate()">🔀 ' + (t('common.reroll')||'Re-roll') + '</button>'
    + '<button class="btn btn-ghost" style="font-size:11px;padding:4px 11px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="copyText(window._lfLastRaw)">' + (t('common.copy')||'Copy') + '</button>'
    + '</div></div>'
    + '<div style="background:var(--card);padding:24px 28px">' + sections + '</div></div>';
}

/* =====================================================
   LORE CHECK — paste text, AI flags contradictions
===================================================== */
let _lcAbort = null;

function renderAILoreCheck() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;
  const charOpts = '<option value="">' + (t('aiTool.lcNoChar')||'— No character (text only) —') + '</option>' +
    characters.map(c => '<option value="' + c.id + '">' + escHTML(c.name) + (c.species?' · '+escHTML(c.species):'') + '</option>').join('');

  cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:18px">'
    + '<div class="card">'
    + '<div style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">' + (t('aiTool.lcTitle')||'🔍 Lore Check') + '</div>'
    + '<div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6">' + (t('aiTool.lcDesc')||'Paste any lore, character bio, or worldbuilding text. The AI reads it and flags contradictions, logic gaps, vague claims, and timeline issues.') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><div class="form-label">' + (t('aiTool.lcCharRef')||'Character Reference') + ' <span style="font-weight:400;color:var(--text3)">' + (t('aiTool.lcCharRefHint')||'(optional — cross-checks against their official sheet)') + '</span></div>'
    + '<select class="form-select" id="lc-char">' + charOpts + '</select></div>'
    + '<div><div class="form-label">' + (t('aiTool.lcCheckMode')||'Check Mode') + '</div><select class="form-select" id="lc-mode">'
    + '<option value="full">' + (t('aiTool.lcModeFull')||'Full audit (contradictions + logic + timeline)') + '</option>'
    + '<option value="contradict">' + (t('aiTool.lcModeContradict')||'Contradictions only') + '</option>'
    + '<option value="logic">' + (t('aiTool.lcModeLogic')||'Logic & internal consistency') + '</option>'
    + '<option value="timeline">' + (t('aiTool.lcModeTimeline')||'Timeline & age consistency') + '</option>'
    + '</select></div></div>'
    + '<div style="margin-bottom:16px"><div class="form-label">' + (t('aiTool.lcTextToCheck')||'Text to Check') + '</div>'
    + '<textarea class="form-textarea" id="lc-text" style="min-height:160px;font-family:monospace;font-size:12px" placeholder="' + (t('aiTool.lcTextPlaceholder')||'Paste any character bio, worldbuilding notes, story excerpt, or relationship description…') + '"></textarea></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-primary" id="lc-gen-btn" onclick="lcGenerate()">' + (t('aiTool.lcRunBtn')||'🔍 Run Check') + '</button>'
    + '<button class="btn btn-ghost" id="lc-stop-btn" style="display:none;color:#ef4444;border-color:#ef444466" onclick="lcStop()">■ Stop</button>'
    + '</div></div>'
    + '<div id="lc-result" style="display:none"></div></div>';
}

async function lcGenerate() {
  const text   = (document.getElementById('lc-text')?.value || '').trim();
  const charId = document.getElementById('lc-char')?.value;
  const mode   = document.getElementById('lc-mode')?.value || 'full';
  if (!text) { toast('Paste some text to check first!', 'warn'); return; }
  const ok = await ollamaCheck();
  if (!ok) { toast('Ollama not running', 'error'); return; }

  const char = charId ? characters.find(c => c.id === charId) : null;
  const charRef = char
    ? '\n\nOFFICIAL CHARACTER SHEET (use as ground truth):\nName: ' + char.name
      + ' | Pronouns: ' + (char.pronouns||'?') + ' | Species: ' + (char.species||'?') + ' | Age: ' + (char.age||'?')
      + '\nPersonality: ' + ([char.traits, char.personalityDesc].filter(Boolean).join(' | ')||'?')
      + '\nBackstory: ' + (char.backstory||'').slice(0,600)
      + '\nRelationships: ' + ((char.relationships||[]).map(r => r.type + ' with ' + r.targetName).join(', ') || 'none listed')
    : '';

  const modeInstr = {
    full:      'Perform a FULL AUDIT: flag (1) direct contradictions, (2) vague/unresolved claims, (3) logic gaps or plot holes, (4) timeline/age inconsistencies.',
    contradict:'Focus ONLY on direct contradictions — statements that cannot both be true simultaneously.',
    logic:     'Focus on internal logic. Flag anything that breaks the internal rules of the world as described.',
    timeline:  'Focus on timeline, age, and chronological consistency. Flag anything that does not add up in sequence.',
  };

  const prompt = 'You are a lore consistency editor for a fiction writer. Read the text carefully and flag any issues.\n\n'
    + (modeInstr[mode] || modeInstr.full) + charRef
    + '\n\nTEXT TO CHECK:\n"""\n' + text + '\n"""\n\n'
    + 'OUTPUT FORMAT:\n- Number each issue.\n'
    + '- Start each with one label in brackets: [CONTRADICTION] [LOGIC GAP] [VAGUE CLAIM] [TIMELINE ISSUE] [MINOR NOTE]\n'
    + '- State the issue clearly in 1-2 sentences. Quote the relevant fragment in double quotes.\n'
    + '- If no issues found, say: "No issues detected. The text appears internally consistent."\n'
    + '- No preamble. No summary. Just the numbered list.\n\nIssues found:';

  const model   = settings.ollamaModel || 'mistral';
  const genBtn  = document.getElementById('lc-gen-btn');
  const stopBtn = document.getElementById('lc-stop-btn');
  const resultEl= document.getElementById('lc-result');
  if (genBtn)  genBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="card" id="lc-stream-card"><div style="font-size:12px;color:var(--text3)">Scanning for issues…</div></div>';

  _lcAbort = new AbortController();
  let raw = '';
  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      signal: _lcAbort.signal,
      body: JSON.stringify({ model, prompt, stream: true })
    });
    const reader = resp.body.getReader(), dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value).split('\n').filter(Boolean)) {
        try { const j = JSON.parse(line); if (j.response) raw += j.response; } catch {}
      }
      const card = document.getElementById('lc-stream-card');
      if (card) card.innerHTML = '<div style="font-size:12px;color:var(--text3);white-space:pre-wrap">' + escHTML(raw) + '</div>';
    }
  } catch(e) { if (e.name !== 'AbortError') toast('Error: ' + e.message, 'error'); }

  lcRenderResult(raw.trim());
  if (stopBtn) stopBtn.style.display = 'none';
  if (genBtn)  genBtn.disabled = false;
}

function lcStop() {
  _lcAbort?.abort();
  document.getElementById('lc-stop-btn').style.display = 'none';
  document.getElementById('lc-gen-btn').disabled = false;
}

function lcRenderResult(raw) {
  const resultEl = document.getElementById('lc-result');
  if (!resultEl) return;
  window._lcLastRaw = raw; // store for copy button
  const labelColors = { 'CONTRADICTION':'#ef4444','LOGIC GAP':'#f97316','VAGUE CLAIM':'#eab308','TIMELINE ISSUE':'#a78bfa','MINOR NOTE':'#6b7280' };

  // Parse multi-line numbered items properly
  const items = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const numMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      if (cur) items.push(cur);
      cur = numMatch[2];
    } else if (cur !== null && line.trim()) {
      cur += ' ' + line.trim();
    }
  }
  if (cur !== null) items.push(cur);

  // Only show clean if truly no numbered items AND text says so
  const noItemsFound = items.length === 0;
  const saysClean = raw.toLowerCase().includes('no issues detected');
  const clean = noItemsFound && saysClean;

  let inner;
  if (clean) {
    inner = '<div style="display:flex;align-items:center;gap:10px;padding:16px;background:var(--bg3);border-radius:10px;border:1px solid #4ade8055">'
      + '<span style="font-size:20px">✓</span>'
      + '<div style="font-size:13px;color:#4ade80;font-weight:700">No issues detected. The text appears internally consistent.</div></div>';
  } else if (items.length > 0) {
    inner = items.map(item => {
      const lm = item.match(/\[([A-Z][A-Z\s]+)\]/);
      const label = lm?.[1]?.trim() || 'NOTE';
      const color = labelColors[label] || '#a78bfa';
      const body  = item.replace(/\[[A-Z\s]+\]\s*/, '').trim();
      if (!body) return '';
      return '<div style="padding:12px 16px;border-radius:10px;border:1px solid ' + color + '33;background:' + color + '11;margin-bottom:10px">'
        + '<div style="font-size:10px;font-weight:800;letter-spacing:1px;color:' + color + ';margin-bottom:5px">' + escHTML(label) + '</div>'
        + '<div style="font-size:13px;color:var(--text);line-height:1.7">' + escHTML(body) + '</div></div>';
    }).join('');
  } else {
    inner = '<div style="white-space:pre-wrap;font-size:13px;color:var(--text)">' + escHTML(raw) + '</div>';
  }

  resultEl.innerHTML = '<div style="border-radius:16px;overflow:hidden;border:1px solid var(--accent)33">'
    + '<div style="background:linear-gradient(135deg,var(--accent2),var(--accent));padding:16px 22px;display:flex;align-items:center;justify-content:space-between">'
    + '<div style="font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;color:#fff">' + (t('aiTool.lcConsistencyReport')||'🔍 Consistency Report') + '</div>'
    + '<button class="btn btn-ghost" style="font-size:11px;padding:4px 11px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="copyText(window._lcLastRaw)">' + (t('common.copy')||'Copy') + '</button></div>'
    + '<div style="background:var(--card);padding:20px 24px">' + inner + '</div></div>';
}

/* =====================================================
   REL SPARK — relationship dynamic generator
===================================================== */
let _rsAbort = null;

function renderAIRelSpark() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;
  if (characters.length < 2) {
    cont.innerHTML = '<div class="card" style="text-align:center;padding:48px">'
      + '<div style="font-size:36px;margin-bottom:12px">💞</div>'
      + '<div style="font-size:14px;color:var(--text2)">' + (t('aiTool.rsNeed2Chars')||'Need at least two characters for Rel Spark.') + '</div></div>';
    return;
  }

  const charOpts = characters.map(c =>
    '<option value="' + c.id + '">' + escHTML(c.name) + (c.species?' · '+escHTML(c.species):'') + '</option>').join('');

  const aspects = [
    ['Dynamic',                    t('aiTool.rsAspectDynamic')||'Dynamic'],
    ['Core Conflict',              t('aiTool.rsAspectCoreConflict')||'Core Conflict'],
    ['Power Balance',              t('aiTool.rsAspectPowerBalance')||'Power Balance'],
    ['Love Language',              t('aiTool.rsAspectLoveLang')||'Love Language'],
    ['Unspoken Tension',           t('aiTool.rsAspectUnspokenTension')||'Unspoken Tension'],
    ['How They Fight',             t('aiTool.rsAspectHowTheyFight')||'How They Fight'],
    ['How They Make Up',           t('aiTool.rsAspectHowTheyMakeUp')||'How They Make Up'],
    ['What They Need From Each Other', t('aiTool.rsAspectWhatTheyNeed')||'What They Need From Each Other'],
    ['Their Biggest Threat',       t('aiTool.rsAspectBiggestThreat')||'Their Biggest Threat'],
    ['Dialogue Spark',             t('aiTool.rsAspectDialogueSpark')||'Dialogue Spark'],
  ];
  const pills = aspects.map(([val, label]) =>
    '<span onclick="rsToggle(this)" data-aspect="' + val + '" data-on="1" style="padding:3px 11px;border-radius:20px;border:1px solid var(--accent);background:var(--accent-glow);font-size:11px;font-weight:700;cursor:pointer;color:var(--accent);transition:all .15s">' + escHTML(label) + '</span>'
  ).join('');

  cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:18px">'
    + '<div class="card">'
    + '<div style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">' + (t('aiTool.rsTitle')||'💞 Rel Spark') + '</div>'
    + '<div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6">' + (t('aiTool.rsDesc')||'Pick two characters. The AI reads their full profiles and generates a deep dynamic breakdown — built from their actual traits, not generic tropes.') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><div class="form-label">' + (t('form.characterA')||'Character A') + '</div><select class="form-select" id="rs-char-a">' + charOpts + '</select></div>'
    + '<div><div class="form-label">' + (t('form.characterB')||'Character B') + '</div><select class="form-select" id="rs-char-b">' + charOpts + '</select></div></div>'
    + '<div style="margin-bottom:14px"><div class="form-label">' + (t('aiTool.rsAspects')||'Aspects to Generate') + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px" id="rs-aspects">' + pills + '</div></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-primary" id="rs-gen-btn" onclick="rsGenerate()">' + (t('aiTool.rsSparkBtn')||'💞 Spark') + '</button>'
    + '<button class="btn btn-ghost" id="rs-stop-btn" style="display:none;color:#ef4444;border-color:#ef444466" onclick="rsStop()">■ Stop</button>'
    + '</div></div>'
    + '<div id="rs-result" style="display:none"></div></div>';

  const selB = document.getElementById('rs-char-b');
  if (selB && characters.length > 1) selB.value = characters[1].id;
}

function rsToggle(el) {
  const on = el.dataset.on === '1';
  el.dataset.on        = on ? '0' : '1';
  el.style.background  = on ? 'var(--bg2)'        : 'var(--accent-glow)';
  el.style.borderColor = on ? 'var(--border)'      : 'var(--accent)';
  el.style.color       = on ? 'var(--text3)'       : 'var(--accent)';
}

async function rsGenerate() {
  const idA = document.getElementById('rs-char-a')?.value;
  const idB = document.getElementById('rs-char-b')?.value;
  if (!idA || !idB)  { toast('Pick two characters!', 'warn'); return; }
  if (idA === idB)   { toast('Pick two DIFFERENT characters!', 'warn'); return; }
  const charA = characters.find(c => c.id === idA);
  const charB = characters.find(c => c.id === idB);
  if (!charA || !charB) return;

  const aspects = [...document.querySelectorAll('#rs-aspects [data-aspect]')]
    .filter(el => el.dataset.on === '1').map(el => el.dataset.aspect);
  if (!aspects.length) { toast('Select at least one aspect!', 'warn'); return; }

  const ok = await ollamaCheck();
  if (!ok) { toast('Ollama not running', 'error'); return; }

  const relAB = (charA.relationships||[]).find(r => r.targetId===idB || r.targetName?.toLowerCase()===charB.name.toLowerCase());
  const relBA = (charB.relationships||[]).find(r => r.targetId===idA || r.targetName?.toLowerCase()===charA.name.toLowerCase());
  const relLine = relAB
    ? charA.name + ' considers ' + charB.name + ' their ' + relAB.type + (relAB.notes?' ("'+relAB.notes+'")':'')
    : relBA
    ? charB.name + ' considers ' + charA.name + ' their ' + relBA.type + (relBA.notes?' ("'+relBA.notes+'")':'')
    : 'No established relationship data — infer from their profiles.';

  function cBlock(c) {
    return 'Name: ' + c.name + '\nPronouns: ' + (c.pronouns||'?') + '\nSpecies: ' + (c.species||'?')
      + '\nAge: ' + (c.age||'?') + '\nPersonality: ' + (c.traits||'?')
      + '\nStrengths: ' + (c.strengths||'?') + '\nWeaknesses: ' + (c.weaknesses||'?')
      + '\nLikes: ' + (c.likes||'?') + '\nDislikes: ' + (c.dislikes||'?')
      + (c.backstory ? '\nBackstory: ' + c.backstory.slice(0,400) : '')
      + (c.quotes    ? '\nVoice: ' + c.quotes.slice(0,200) : '');
  }

  const prompt = 'You are a creative relationship analyst for a fiction writer. Read both profiles and generate a dynamic breakdown.\n\n'
    + 'CHARACTER A:\n' + cBlock(charA) + '\n\nCHARACTER B:\n' + cBlock(charB)
    + '\n\nRelationship context: ' + relLine
    + '\n\nGenerate ONLY these aspects as ALL-CAPS headers followed by a colon, then 1-3 punchy sentences:\n'
    + aspects.map((a,i) => (i+1)+'. '+a).join('\n')
    + '\n\nRULES:\n- Be specific to THESE characters — their actual traits, not generic tropes.\n'
    + '- Pronouns: ' + charA.name + ' = ' + (charA.pronouns||'?') + ', ' + charB.name + ' = ' + (charB.pronouns||'?') + '.\n'
    + '- Write with editorial energy — like a sharp author\'s note.\n'
    + '- 1-3 sentences per section max.\n- No intro or summary text.\n\nBegin:';

  const model   = settings.ollamaModel || 'mistral';
  const genBtn  = document.getElementById('rs-gen-btn');
  const stopBtn = document.getElementById('rs-stop-btn');
  const resultEl= document.getElementById('rs-result');
  if (genBtn)  genBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="card" id="rs-stream-card"><div style="font-size:12px;color:var(--text3)">Analysing dynamic…</div></div>';

  _rsAbort = new AbortController();
  let raw = '';
  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      signal: _rsAbort.signal,
      body: JSON.stringify({ model, prompt, stream: true })
    });
    const reader = resp.body.getReader(), dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value).split('\n').filter(Boolean)) {
        try { const j = JSON.parse(line); if (j.response) raw += j.response; } catch {}
      }
      const card = document.getElementById('rs-stream-card');
      if (card) card.innerHTML = '<div style="font-size:12px;color:var(--text3);white-space:pre-wrap">' + escHTML(raw) + '</div>';
    }
  } catch(e) { if (e.name !== 'AbortError') toast('Error: ' + e.message, 'error'); }

  rsRenderResult(raw.trim(), charA, charB);
  if (stopBtn) stopBtn.style.display = 'none';
  if (genBtn)  genBtn.disabled = false;
}

function rsStop() {
  _rsAbort?.abort();
  document.getElementById('rs-stop-btn').style.display = 'none';
  document.getElementById('rs-gen-btn').disabled = false;
}

function rsRenderResult(raw, charA, charB) {
  const resultEl = document.getElementById('rs-result');
  if (!resultEl) return;
  window._rsLastRaw = raw; // safe storage for copy button

  // Parse ALL-CAPS section headers
  const parsed = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z][A-Z\s\/&\-']{1,}[A-Z']):?\s*(.*)/);
    if (m && m[1].length > 3) {
      if (cur) parsed.push(cur);
      cur = { title: m[1].trim(), body: m[2] ? m[2] + '\n' : '' };
    } else if (cur) {
      cur.body += line + '\n';
    }
  }
  if (cur) parsed.push(cur);

  const cols = ['#f9a8d4','#a78bfa','#60a5fa','#4ade80','#fbbf24','#f97316','#e879f9','#34d399','#f87171','#818cf8'];
  const sects = parsed.length
    ? parsed.map((s, i) => {
        const col = cols[i % cols.length];
        return '<div style="padding:16px 20px;border-radius:14px;border:1px solid ' + col + '40;background:' + col + '12;margin-bottom:12px">'
          + '<div style="font-size:9px;font-weight:900;letter-spacing:2px;color:' + col + ';margin-bottom:8px;text-transform:uppercase;opacity:.9">' + escHTML(s.title) + '</div>'
          + '<div style="font-size:13px;color:var(--text);line-height:1.85">' + escHTML(s.body.trim()) + '</div></div>';
      }).join('')
    : '<div style="white-space:pre-wrap;font-size:13px;color:var(--text);line-height:1.8">' + escHTML(raw) + '</div>';

  // Avatar helpers — larger for the fusion-style banner
  const ava = (c, size) => c.avatar
    ? '<img src="' + c.avatar + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);box-shadow:0 2px 12px rgba(0,0,0,.3)">'
    : '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size*.4) + 'px;font-weight:700;color:#fff;border:3px solid rgba(255,255,255,.3)">' + escHTML((c.name||'?')[0]) + '</div>';

  // Species lines
  const specA = charA.species ? '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">' + escHTML(charA.species) + '</div>' : '';
  const specB = charB.species ? '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">' + escHTML(charB.species) + '</div>' : '';

  resultEl.innerHTML =
    '<div style="border-radius:18px;overflow:hidden;border:1px solid var(--accent)33;box-shadow:0 8px 40px rgba(0,0,0,.3)">'
    // ── Banner ──
    + '<div style="background:linear-gradient(135deg,var(--accent2),var(--accent));padding:24px 28px;position:relative">'
    + '<div style="display:flex;align-items:center;gap:16px">'
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:4px">' + ava(charA,52) + '<div style="font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)">' + escHTML(charA.name) + '</div>' + specA + '</div>'
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 8px">'
    + '<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">💞</div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:4px">' + ava(charB,52) + '<div style="font-family:\'Cinzel\',serif;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)">' + escHTML(charB.name) + '</div>' + specB + '</div>'
    + '<div style="margin-left:auto;display:flex;gap:8px;align-self:flex-start">'
    + '<button class="btn btn-ghost" style="font-size:11px;padding:5px 13px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="rsGenerate()">🔀 ' + (t('common.reroll')||'Re-roll') + '</button>'
    + '<button class="btn btn-ghost" style="font-size:11px;padding:5px 13px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="copyText(window._rsLastRaw)">' + (t('common.copy')||'Copy') + '</button>'
    + '</div></div></div>'
    // ── Content ──
    + '<div style="background:var(--card);padding:24px 28px">' + sects + '</div>'
    + '</div>';
}


/* =====================================================
   CHARACTER BRAIN
   — Talk to your OCs. They remember. They have faces.
===================================================== */

// ── State ─────────────────────────────────────────────────────────────
// ── AI Memory Expansion cache loader ─────────────────────────────────
// Loads memory expansion profiles from localforage into window._memExpCache
// so getMemoryExpansionProfile() can read them synchronously during prompt builds.
// Called on Brain page load and whenever a new character is selected.
async function loadMemExpCache() {
  try {
    const data = await localforage.getItem('charactry_memory_expansion');
    window._memExpCache = data || {};
  } catch { window._memExpCache = {}; }
}
// Load on startup
loadMemExpCache();

// Returns the memory expansion profile for a character, or null if none saved.
// Reads from window._memExpCache which is populated by loadMemExpCache().
function getMemoryExpansionProfile(charId) {
  if (!charId || !window._memExpCache) return null;
  return window._memExpCache[charId] || null;
}

let _brain = {
  charId:         null,
  messages:       [],
  sessionId:      null,
  sessionTitle:   null,
  sprites:        {},
  spriteList:     [],
  blinkTimer:     null,
  talkTimer:      null,    // mouth animation timer
  blinking:       false,
  currentEmotion: 'neutral',
  expressionMap:  {},
  sessions:       [],
  abortCtrl:      null,    // AbortController for stopping generation
  generating:     false,
  cbIcon:         null,    // CB_icon.png data URL — chibi/icon for chat bubbles
};

// ── Emotion detection ────────────────────────────────────────────────
const BRAIN_EMOTION_KEYWORDS = {
  happy:    ['haha','lol','laugh','smile','happy','glad','joy','great','wonderful','nice','fun','love','adorable','cute'],
  sad:      ['sad','cry','tears','miss','lonely','hurt','loss','grieve','sorry','wish','regret','heartbreak'],
  angry:    ['furious','rage','anger','annoyed','irritat','hate','damn','stupid','idiot','shut up','disgust'],
  blush:    ['flush','fluster','embar','blush','shy','nervous','flustered','w-what','h-hey','stutter','...'],
  surprised:['what?','no way','really?','shock','surprise','wait—','impossible','unbeliev'],
  disgusted:['gross','disgust','repuls','ugh','eww','vile'],
  scared:   ['scare','afraid','fear','terri','panic','dread','anxious','trembl'],
  smug:     ['smirk','obviously','of course','naturally','as expected','fool','simple'],
  focused:  ['concentrate','focus','analyz','calculat','deduce','logic','precise'],
};

function brainDetectEmotion(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  let best = 'neutral', bestScore = 0;
  for (const [emo, kws] of Object.entries(BRAIN_EMOTION_KEYWORDS)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = emo; }
  }
  return best;
}

// ── Sprite resolution ────────────────────────────────────────────────
// Looks in _brain.sprites for the best match for a given emotion
// Priority order for sprite resolution:
//   1. Custom expression map (user-assigned in editor)
//   2. neutral_eyes_opened_{charname}.png  ← canonical default
//   3. Open-eyed variant of the emotion
//   4. Any filename containing the emotion
//   5. Fallback chain: neutral > normal > default > base
//   6. First sprite available
function brainGetSprite(emotion) {
  const s = _brain.sprites;
  if (!Object.keys(s).length) return null;

  // 1. Custom map
  const custom = (_brain.expressionMap[emotion] || []).find(f => s[f]);
  if (custom) return s[custom];

  // 2. For neutral: prefer neutral_eyes_opened_{charname}.png exactly
  if (emotion === 'neutral') {
    const char = characters.find(c => c.id === _brain.charId);
    if (char) {
      const charNameClean = char.name.toLowerCase().replace(/\s+/g, '_');
      const exactNeutral = Object.keys(s).find(f => {
        const fl = f.toLowerCase();
        return fl === `neutral_eyes_opened_${charNameClean}.png` ||
               fl === `neutral_eyes_opened_${charNameClean}.jpg` ||
               fl === `neutral_eyes_opened_${charNameClean}.webp`;
      });
      if (exactNeutral) return s[exactNeutral];
    }
    // Any neutral_eyes_opened pattern
    const anyNeutralOpen = Object.keys(s).find(f => /neutral.eyes.open/i.test(f));
    if (anyNeutralOpen) return s[anyNeutralOpen];
  }

  // 3. Open-eyed version of the emotion (prefer eyes_opened over eyes_closed)
  const openMatch = Object.keys(s).find(f => {
    const fl = f.toLowerCase();
    return fl.includes(emotion) && /eyes.open|open/i.test(fl) && !/closed|close/i.test(fl);
  });
  if (openMatch) return s[openMatch];

  // 4. Any match containing emotion keyword
  const anyMatch = Object.keys(s).find(f => f.toLowerCase().includes(emotion));
  if (anyMatch) return s[anyMatch];

  // 5. Fallback chain — prefer open-eyed neutral
  const fallbackPatterns = [/neutral.eyes.open/i, /neutral/i, /normal/i, /default/i, /base/i];
  for (const p of fallbackPatterns) {
    const fb = Object.keys(s).find(k => p.test(k));
    if (fb) return s[fb];
  }

  // 6. Anything
  return Object.values(s)[0] || null;
}

function brainGetBlinkSprite() {
  const char = characters.find(c => c.id === _brain.charId);
  const charNameClean = char ? char.name.toLowerCase().replace(/\s+/g, '_') : '';
  const s = _brain.sprites;

  // Try exact neutral_eyes_closed_{charname}.png first
  if (charNameClean) {
    const exact = Object.keys(s).find(f => {
      const fl = f.toLowerCase();
      return fl === `neutral_eyes_closed_${charNameClean}.png` ||
             fl === `neutral_eyes_closed_${charNameClean}.jpg` ||
             fl === `neutral_eyes_closed_${charNameClean}.webp`;
    });
    if (exact) return s[exact];
  }
  // Fallback: any closed/blink pattern
  const closed = Object.keys(s).find(f => /neutral.eyes.clos|eyes.clos|closed|blink|sleep/i.test(f));
  return closed ? s[closed] : null;
}

// ── Sprite loader ────────────────────────────────────────────────────
async function brainLoadSprites(charId) {
  _brain.sprites    = {};
  _brain.spriteList = [];
  if (!window.electronAPI?.listSprites) return;
  const files = await window.electronAPI.listSprites(charId);
  _brain.spriteList = files || [];
  // Load each one as base64
  for (const f of _brain.spriteList) {
    const data = await window.electronAPI.readSprite(charId, f);
    if (data) _brain.sprites[f] = data;
  }
  brainUpdateSprite('neutral');
}

// ── Blink system ─────────────────────────────────────────────────────
function brainStartBlink() {
  brainStopBlink();
  if (!settings.brainBlink) return;
  const blinkEl = document.getElementById('brain-sprite-img');
  if (!blinkEl) return;
  function doBlink() {
    const closedSrc = brainGetBlinkSprite();
    const openSrc   = brainGetSprite(_brain.currentEmotion);
    if (!closedSrc || !openSrc) return;
    // quick blink: close 120ms, open
    blinkEl.src = closedSrc;
    setTimeout(() => { if (blinkEl) blinkEl.src = openSrc; }, 120);
    setTimeout(() => {
      if (blinkEl) blinkEl.src = closedSrc;
      setTimeout(() => { if (blinkEl) blinkEl.src = openSrc; }, 80);
    }, 200);
  }
  function scheduleNext() {
    const delay = 2500 + Math.random() * 4500; // 2.5s–7s
    _brain.blinkTimer = setTimeout(() => {
      doBlink();
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function brainStopBlink() {
  if (_brain.blinkTimer) { clearTimeout(_brain.blinkTimer); _brain.blinkTimer = null; }
}

function brainStartTalking() {
  brainStopTalking();
  const openFiles  = _brain.expressionMap['__mouth_open']  || [];
  const closeFiles = _brain.expressionMap['__mouth_closed'] || [];
  if (!openFiles.length && !closeFiles.length) return; // no talking frames set
  const openSrc  = openFiles[0]  ? _brain.sprites[openFiles[0]]  : null;
  const closeSrc = closeFiles[0] ? _brain.sprites[closeFiles[0]] : null;
  if (!openSrc && !closeSrc) return;
  let mouthOpen = false;
  function toggleMouth() {
    mouthOpen = !mouthOpen;
    const el = document.getElementById('brain-sprite-img');
    if (!el) return;
    el.src = (mouthOpen ? openSrc : closeSrc) || el.src;
    _brain.talkTimer = setTimeout(toggleMouth, mouthOpen ? 120 : 200);
  }
  toggleMouth();
}

function brainStopTalking() {
  if (_brain.talkTimer) { clearTimeout(_brain.talkTimer); _brain.talkTimer = null; }
  // Restore current emotion sprite
  brainUpdateSprite(_brain.currentEmotion);
}

function brainUpdateSprite(emotion) {
  _brain.currentEmotion = emotion;
  const el = document.getElementById('brain-sprite-img');
  const placeholder = document.getElementById('brain-sprite-placeholder');
  const src = brainGetSprite(emotion);
  if (src && el) {
    el.src = src;
    el.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else if (el) {
    el.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// ── System prompt builder ────────────────────────────────────────────
function brainBuildSystemPrompt(char) {
  const linkedIds = new Set((char.relationships||[]).map(r => r.targetId).filter(Boolean));

  // Build relationship lines with full pronoun/gender clarity to prevent hallucination
  const relsStr = (char.relationships||[]).map(r => {
    const t = r.targetId ? characters.find(c=>c.id===r.targetId) : null;
    const pronounNote = t ? ` [pronouns: ${t.pronouns||'?'}, gender: ${t.gender||'?'}]` : '';
    const speciesNote = t ? ` (${t.species||'?'})` : '';
    const notesStr    = r.notes ? ` — "${r.notes}"` : '';
    return `- ${r.type}: ${r.targetName||r.targetId}${speciesNote}${pronounNote}${notesStr}`;
  }).join('\n');

  // Expanded linked character details — pronouns first, always
  const linkedDetails = (char.relationships||[])
    .filter(r => r.targetId && linkedIds.has(r.targetId))
    .map(r => {
      const t = characters.find(c=>c.id===r.targetId);
      if (!t) return null;
      const lines = [
        `  ${t.name} (${r.type}):`,
        `    Pronouns: ${t.pronouns||'unknown'} | Gender: ${t.gender||'unknown'}`,
        t.species   ? `    Species: ${t.species}` : null,
        t.age       ? `    Age: ${t.age}` : null,
        (t.traits||t.personalityDesc) ? `    Personality: ${[t.traits,t.personalityDesc].filter(Boolean).join(' — ')}` : null,
        t.occupation? `    Occupation: ${t.occupation}` : null,
      ].filter(Boolean).join('\n');
      return lines;
    }).filter(Boolean).join('\n\n');

  // Custom tabs — all extra lore the user wrote
  let customTabsStr = '';
  if ((char.customTabs||[]).length) {
    const tabs = char.customTabs.map(tab => {
      const secs = (tab.sections||[]).filter(s=>s.content?.trim());
      if (!secs.length) return null;
      return `[${tab.name}]\n${secs.map(s=>`  ${s.name}: ${s.content}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    if (tabs) customTabsStr = '\n\nADDITIONAL LORE:\n' + tabs;
  }

  // Use quotes as voice samples — frame them as reference
  const speechHint = char.quotes
    ? `Study these sample lines to lock in the voice — match this exact tone and pattern:\n${char.quotes.slice(0, 400)}`
    : null;

  const fields = [
    ['Name',         char.name],
    ['Species',      char.species],
    ['Age',          char.age],
    ['Gender',       char.gender],
    ['Pronouns',     char.pronouns],
    ['Alignment',    char.alignment],
    ['Occupation',   char.occupation],
    ['Personality',  [char.traits, char.personalityDesc].filter(Boolean).join('\n')],
    ['Strengths',    char.strengths],
    ['Weaknesses',   char.weaknesses],
    ['Likes',        char.likes],
    ['Dislikes',     char.dislikes],
    ['Habits',       char.habits],
    ['Abilities',    char.abilities],
    ['Appearance',   [char.hair, char.eyes, char.features, char.outfit].filter(Boolean).join('; ')],
    ['Backstory',    char.backstory ? char.backstory.slice(0, (() => {
      const mp = getMemoryExpansionProfile(char.id);
      return mp ? mp.context.backstoryLimit : 1000;
    })()) : null],
    ['Voice / Quotes', speechHint],
  ].filter(([,v]) => v && String(v).trim());

  const charSheet = fields.map(([k,v]) => `${k}: ${v}`).join('\n');

  const relsBlock = relsStr
    ? `\nKNOWN RELATIONSHIPS (ONLY these people exist — do NOT invent others):\n${relsStr}` +
      (linkedDetails ? `\n\nDetails about them:\n${linkedDetails}` : '')
    : `\nRELATIONSHIPS: None established yet. Do not invent people.`;

  const universe = (typeof universes !== 'undefined' && char.universeId)
    ? universes.find(u => u.id === char.universeId)
    : null;
  const worldBlock = universe
    ? `\nWORLD / SETTING: ${universe.name}${universe.desc ? ' — ' + universe.desc.slice(0,200) : ''}`
    : '';

  // ── Lorebook injection ──────────────────────────────────────────────────
  // Build a context string from char fields to match lorebook keywords against
  const lorebookContext = [
    char.name, char.species, char.occupation,
    char.traits, char.personalityDesc, char.backstory,
    universe?.name, universe?.desc,
    (char.relationships||[]).map(r => r.targetName).join(' '),
    (char.tags||[]).join(' '),
  ].filter(Boolean).join(' ');

  let lorebookBlock = '';
  if (typeof getMatchingLorebookEntries === 'function') {
    const lbEntries = getMatchingLorebookEntries(lorebookContext, char.name);
    if (lbEntries.length) {
      const _mp = getMemoryExpansionProfile(char.id);
      const _lbMax   = _mp ? _mp.context.lorebookEntries : 8;
      const _lbChars = _mp ? _mp.context.lorebookChars   : 600;
      const lbText = lbEntries
        .slice(0, _lbMax)
        .map(({ lorebookName, entry }) =>
          `[${entry.title || 'Entry'}]\n${entry.content.slice(0, _lbChars)}`)
        .join('\n\n');
      lorebookBlock = `\n\nWORLD LORE (read-only reference — use this to inform how you describe your world, but stay in character):\n${lbText}`;
    }
  }

  // ── Plugin Brain context injection ──────────────────────────────────────
  // Plugins can supply a brainContext string in their manifest
  let pluginBlock = '';
  if (typeof getActivePlugins === 'function') {
    const pluginContexts = getActivePlugins()
      .filter(p => p.manifest.brainContext)
      .map(p => `[Plugin: ${p.manifest.name}]\n${p.manifest.brainContext.slice(0, 400)}`)
      .join('\n\n');
    if (pluginContexts) {
      pluginBlock = `\n\nADDITIONAL CONTEXT (from installed plugins):\n${pluginContexts}`;
    }
  }

  // ── AI Memory Expansion injection ─────────────────────────────────────
  const memExp = getMemoryExpansionProfile(char.id);
  let memExpBlock = '';
  if (memExp) {
    const parts = [];
    // Voice profile
    if (memExp.voice?.enabled) {
      const v = memExp.voice;
      const vp = [];
      if (v.speakingStyle)  vp.push(`SPEAKING STYLE: ${v.speakingStyle}`);
      if (v.vocabulary)     vp.push(`VOCABULARY: ${v.vocabulary}`);
      if (v.emotionalTone)  vp.push(`EMOTIONAL TONE: ${v.emotionalTone}`);
      if (v.quirks)         vp.push(`SPEECH QUIRKS: ${v.quirks}`);
      if (v.exampleLines)   vp.push(`VOICE SAMPLES (match this register exactly):\n${v.exampleLines}`);
      if (vp.length) parts.push(`PERSISTENT VOICE PROFILE (always speak this way):\n${vp.join('\n')}`);
    }
    // Long-term memory
    if (memExp.memory?.enabled) {
      if (memExp.memory.persistentFacts) {
        parts.push(`PERSISTENT MEMORY (${char.name} always knows these):\n${memExp.memory.persistentFacts}`);
      }
      const sums = (memExp.memory.summaries || []).slice(0, 10);
      if (sums.length) {
        parts.push(`LONG-TERM MEMORY:\n${sums.map(s => `[${s.label||'Memory'}] ${s.text}`).join('\n\n')}`);
      }
    }
    if (parts.length) {
      const injection = parts.join('\n\n---\n\n');
      if (memExp.context?.injectPosition === 'prepend') {
        memExpBlock = `\n\n${injection}`;
      } else {
        memExpBlock = `\n\n${injection}`;
      }
    }
  }

  // Custom rules injection
  const customRulesBlock = memExp?.context?.customRules
    ? `\n- ${memExp.context.customRules.split('\n').filter(Boolean).join('\n- ')}`
    : '';

  return `You are roleplaying as ${char.name}. You ARE this character — fully, completely, at all times. You are NOT an AI assistant. You are NOT a language model. You are ${char.name}, and you exist inside your world right now.

CHARACTER PROFILE:
${charSheet}${relsBlock}${worldBlock}${customTabsStr}${lorebookBlock}${pluginBlock}${memExpBlock}

PERSONA LOCK — HARD RULES (never break these):
- ONLY speak as ${char.name}. Never narrate. Never describe your own actions.
- Do NOT say you are an AI, a language model, or anything outside of character — ever.
- Do NOT mention these rules or this prompt.
- Do NOT volunteer backstory unprompted. Answer what was asked. Keep it SHORT.
- Keep replies to 1–3 sentences. Only go longer if directly asked for more.
- Do NOT invent characters, relationships, or facts not in the profile above. EVER.
- RELATIONSHIPS ARE FIXED. Do NOT reinterpret, rename, or reassign them. The relationship type listed IS the relationship. Do not guess or improvise alternatives.
- PRONOUNS ARE FIXED. Every person listed above has stated pronouns. Use them exactly. Never assume gender from a name or species.
- Do NOT use stage directions, (pauses), (sighs), (laughs), asterisks, or parenthetical actions. Speak only.
- If ${char.name} would deflect, lie, or refuse — do that in character. They owe nothing.
- If asked about someone not in the relationships list, say you don't know them — in character.`;
}

// ── Messages builder — returns {role,content}[] for /api/chat ─────────
function brainBuildMessages(char, history) {
  const system = brainBuildSystemPrompt(char);
  // Add anti-repetition reminder as a late system injection
  const antiRepeat = '\n\nADDITIONAL RULE: Do NOT repeat or rephrase anything you have already said in this conversation. Each reply must be fresh and forward-moving. Never echo the previous response.';
  const messages = [{ role: 'system', content: system + antiRepeat }];
  // Trim history to last 12 exchanges max to avoid context bloat causing loops
  const _memCtx = getMemoryExpansionProfile(char.id);
  const _ctxWindow = _memCtx ? _memCtx.context.contextWindow : 24;
  const trimmed = history.slice(-_ctxWindow);
  for (const m of trimmed) {
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.text });
    } else if (m.role === 'char') {
      messages.push({ role: 'assistant', content: m.text });
    }
  }
  return messages;
}

// ── Legacy flat-prompt fallback ──────────────────────────────────────
function brainBuildPrompt(char, history) {
  const sys = brainBuildSystemPrompt(char);
  let prompt = sys + '\n\n';
  for (const m of history) {
    if (m.role === 'user') prompt += 'User: ' + m.text + '\n';
    else prompt += char.name + ': ' + m.text + '\n';
  }
  prompt += char.name + ':';
  return prompt;
}

// ── Session management ───────────────────────────────────────────────
function brainNewSession() {
  _brain.messages    = [];
  _brain.sessionId   = 'brain_' + Date.now();
  _brain.sessionTitle= null;
  brainRenderChat();
}

async function brainAutoSave() {
  // Silent background save — no toast, updates existing session in place
  if (!_brain.charId || !_brain.messages.length) return;
  const char = characters.find(c => c.id === _brain.charId);
  const log = {
    id:       _brain.sessionId,
    charId:   _brain.charId,
    charName: char?.name || '?',
    title:    _brain.sessionTitle || (char?.name + ' — ' + new Date().toLocaleDateString()),
    created:  parseInt(_brain.sessionId.replace('brain_','')) || Date.now(),
    messages: _brain.messages,
  };
  try {
    if (window.electronAPI?.saveBrainLog) {
      await window.electronAPI.saveBrainLog(_brain.charId, log);
    } else {
      const key = 'charactry_brain_' + _brain.charId;
      const existing = (await localforage.getItem(key)) || [];
      const idx = existing.findIndex(s => s.id === log.id);
      if (idx >= 0) existing[idx] = log; else existing.unshift(log);
      await localforage.setItem(key, existing.slice(0, 50));
    }
    brainLoadSessionList(); // refresh sidebar count
  } catch(e) { console.warn('brainAutoSave', e); }
}

async function brainSaveSession() {
  if (!_brain.charId || !_brain.messages.length) return;
  const char = characters.find(c => c.id === _brain.charId);
  const log = {
    id:       _brain.sessionId,
    charId:   _brain.charId,
    charName: char?.name || '?',
    title:    _brain.sessionTitle || (char?.name + ' — ' + new Date().toLocaleDateString()),
    created:  parseInt(_brain.sessionId.replace('brain_','')),
    messages: _brain.messages,
  };
  if (window.electronAPI?.saveBrainLog) {
    await window.electronAPI.saveBrainLog(_brain.charId, log);
    toast('Session saved ✦', 'success', 1800);
  } else {
    // Fallback: localforage
    const key = 'charactry_brain_' + _brain.charId;
    const existing = (await localforage.getItem(key)) || [];
    const idx = existing.findIndex(s => s.id === log.id);
    if (idx >= 0) existing[idx] = log; else existing.unshift(log);
    await localforage.setItem(key, existing.slice(0, 50));
    toast('Session saved ✦', 'success', 1800);
  }
  // Refresh session list
  brainLoadSessionList();
}

async function brainDeleteSession(sessionId) {
  if (!_brain.charId) return;
  if (!confirm('Delete this session?')) return;
  if (window.electronAPI?.saveBrainLog) {
    // Remove file via IPC — add a delete handler
    if (window.electronAPI?.deleteBrainLog) await window.electronAPI.deleteBrainLog(_brain.charId, sessionId);
  } else {
    const key = 'charactry_brain_' + _brain.charId;
    const existing = (await localforage.getItem(key)) || [];
    await localforage.setItem(key, existing.filter(s => s.id !== sessionId));
  }
  if (_brain.sessionId === sessionId) brainNewSession();
  await brainLoadSessionList();
  toast('Session deleted', 'info', 1600);
}

async function brainLoadSessionList() {
  const charId = _brain.charId;
  if (!charId) return;
  let sessions = [];
  if (window.electronAPI?.listBrainLogs) {
    sessions = await window.electronAPI.listBrainLogs(charId);
  } else {
    const key = 'charactry_brain_' + charId;
    const logs = (await localforage.getItem(key)) || [];
    sessions = logs.map(l => ({ id: l.id, title: l.title, created: l.created, msgCount: l.messages?.length||0 }));
  }
  _brain.sessions = sessions;
  brainRenderSessionList();
}

async function brainLoadSession(sessionId) {
  const charId = _brain.charId;
  if (!charId) return;
  let log = null;
  if (window.electronAPI?.loadBrainLog) {
    const all = await window.electronAPI.loadBrainLog(charId);
    log = all.find(l => l.id === sessionId);
  } else {
    const key = 'charactry_brain_' + charId;
    const all = (await localforage.getItem(key)) || [];
    log = all.find(l => l.id === sessionId);
  }
  if (!log) { toast('Session not found', 'error'); return; }
  _brain.messages    = log.messages || [];
  _brain.sessionId   = log.id;
  _brain.sessionTitle= log.title;
  brainRenderChat();
  // Update sprite to last known emotion
  if (_brain.messages.length) {
    const last = [..._brain.messages].reverse().find(m => m.role === 'char');
    if (last?.emotion) brainUpdateSprite(last.emotion);
  }
  toast('Session loaded', 'info', 1600);
}

// ── Send message ──────────────────────────────────────────────────────
async function brainSend() {
  const input  = document.getElementById('brain-input');
  const sendBtn= document.getElementById('brain-send-btn');
  if (!input || !_brain.charId) return;
  const text = input.value.trim();
  if (!text) return;

  const char = characters.find(c => c.id === _brain.charId);
  if (!char) return;
  // Merge latest data from disk (character.json, avatar, banner files)
  const richChar = await charMergeFromFile(char);

  // Push user message
  _brain.messages.push({ role:'user', text, ts: Date.now() });
  input.value = '';
  input.style.height = 'auto';
  brainRenderChat();
  brainScrollChat();

  // Disable send, show stop button
  _brain.generating = true;
  _brain.abortCtrl  = new AbortController();
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }
  const stopBtn = document.getElementById('brain-stop-btn');
  if (stopBtn) stopBtn.style.display = 'inline-flex';

  brainShowTyping();
  brainStartTalking();

  try {
    const ok = await ollamaCheck();
    if (!ok) { brainHideTyping(); toast('Ollama not running', 'error'); if(sendBtn){sendBtn.disabled=false;sendBtn.textContent='Send';} return; }

    // Use /api/chat with full system+history messages array for proper persona lock
    const allMsgs  = _brain.messages; // includes current user turn
    const model    = settings.ollamaModel || 'mistral';
    const messages = brainBuildMessages(richChar, allMsgs);
    let reply = '';

    function brainCleanReply(raw) {
      const stop = raw.search(/\n(?:user|you)\s*:/i);
      let clean = (stop !== -1 ? raw.slice(0, stop) : raw).trim();
      clean = clean.replace(new RegExp('^' + richChar.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*:\\s*', 'i'), '');
      return clean.trim();
    }

    if (settings.aiStreaming !== false) {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: _brain.abortCtrl.signal,
        body: JSON.stringify({ model, messages, stream: true, stop: ['\nUser:', '\nYou:', '\n\n\n'], options: { num_predict: 220 } })
      });
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      brainHideTyping();
      const msgIdx = _brain.messages.length;
      _brain.messages.push({ role:'char', text:'', emotion:'neutral', ts: Date.now() });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            const token = j.message?.content || j.response || '';
            if (token) {
              reply += token;
              _brain.messages[msgIdx].text = brainCleanReply(reply);
              brainRenderChat(true);
              brainScrollChat();
            }
          } catch {}
        }
      }
      _brain.messages[msgIdx].text = brainCleanReply(reply);
    } else {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: _brain.abortCtrl.signal,
        body: JSON.stringify({ model, messages, stream: false, stop: ['\nUser:', '\nYou:', '\n\n\n'], options: { num_predict: 220 } })
      });
      const j = await response.json();
      reply = j.message?.content || j.response || '';
      reply = brainCleanReply(reply);
      brainHideTyping();
      _brain.messages.push({ role:'char', text: reply, emotion:'neutral', ts: Date.now() });
      brainRenderChat();
    }

    brainStopTalking();
    const stopBtn2 = document.getElementById('brain-stop-btn');
    if (stopBtn2) stopBtn2.style.display = 'none';
    _brain.generating = false;

    // Detect emotion and update sprite
    const emotion = brainDetectEmotion(reply);
    const lastMsg = _brain.messages.findLast(m => m.role === 'char');
    if (lastMsg) lastMsg.emotion = emotion;
    brainUpdateSprite(emotion);
    brainScrollChat();

    // Auto-title session from first exchange
    if (_brain.messages.length === 2 && !_brain.sessionTitle) {
      _brain.sessionTitle = `${richChar.name} — ${text.slice(0,40)}${text.length>40?'…':''}`;
    }
    // Auto-save silently after every reply
    brainAutoSave();

  } catch(e) {
    brainHideTyping();
    brainStopTalking();
    const stopBtn3 = document.getElementById('brain-stop-btn');
    if (stopBtn3) stopBtn3.style.display = 'none';
    _brain.generating = false;
    if (e.name !== 'AbortError') {
      _brain.messages.push({ role:'char', text:'[Error: ' + e.message + ']', emotion:'neutral', ts: Date.now() });
      brainRenderChat();
    }
  }

  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
}

// ── Chat rendering ────────────────────────────────────────────────────
function brainStop() {
  if (_brain.abortCtrl) { _brain.abortCtrl.abort(); _brain.abortCtrl = null; }
  brainStopTalking();
  brainHideTyping();
  _brain.generating = false;
  const stopBtn = document.getElementById('brain-stop-btn');
  if (stopBtn) stopBtn.style.display = 'none';
  const sendBtn = document.getElementById('brain-send-btn');
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  // Trim any empty trailing message
  if (_brain.messages.length && !_brain.messages.at(-1).text?.trim()) {
    _brain.messages.pop();
  }
  brainRenderChat();
}

function brainShowTyping() {
  const el = document.getElementById('brain-typing');
  if (el) el.style.display = 'flex';
}
function brainHideTyping() {
  const el = document.getElementById('brain-typing');
  if (el) el.style.display = 'none';
}
function brainScrollChat() {
  const chat = document.getElementById('brain-chat-msgs');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function brainRenderChat(streaming=false) {
  const chat = document.getElementById('brain-chat-msgs');
  if (!chat) return;
  const char = characters.find(c=>c.id===_brain.charId);
  const charColor = char?.color1 || 'var(--accent)';

  // CB_icon > avatar > initial
  const charIconSrc = _brain.cbIcon || char?.avatar || null;

  const html = _brain.messages.map((m, i) => {
    if (m.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;gap:8px;align-items:flex-end">
        <div style="max-width:72%;background:var(--accent);color:#fff;border-radius:16px 16px 4px 16px;padding:9px 14px;font-size:13px;line-height:1.6">${escHTML(m.text)}</div>
        <div style="width:28px;height:28px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text2);flex-shrink:0">You</div>
      </div>`;
    } else {
      const ava = charIconSrc
        ? `<img src="${charIconSrc}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<div style="width:28px;height:28px;border-radius:50%;background:${charColor}33;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${charColor};flex-shrink:0">${escHTML((char?.name||'?')[0])}</div>`;
      const isLast = i === _brain.messages.length - 1;
      return `<div style="display:flex;margin-bottom:10px;gap:8px;align-items:flex-end">
        ${ava}
        <div style="max-width:72%;background:var(--bg2);border:1px solid var(--border);border-radius:16px 16px 16px 4px;padding:9px 14px;font-size:13px;line-height:1.6;color:var(--text)">
          ${escHTML(m.text)}${isLast && streaming ? '<span style="animation:aiPulse .6s infinite alternate;color:var(--accent)"> ▮</span>' : ''}
        </div>
      </div>`;
    }
  }).join('');

  chat.innerHTML = html || `<div style="text-align:center;color:var(--text3);font-size:13px;padding:24px">${(t('aiTool.cbSayHello')||'Say something to {name}…').replace('{name}', escHTML(char?.name||'?'))}</div>`;
}

function brainRenderSessionList() {
  const el = document.getElementById('brain-session-list');
  if (!el) return;
  if (!_brain.sessions.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:6px 8px">' + (t('aiTool.cbNoSessions')||'No saved sessions yet') + '</div>';
    return;
  }
  el.innerHTML = _brain.sessions.map(s => `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
      <div onclick="brainLoadSession('${s.id}')" style="flex:1;min-width:0;padding:7px 10px;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:var(--bg2);transition:all .1s"
        onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHTML(s.title||'Untitled')}</div>
        <div style="font-size:10px;color:var(--text3)">${s.msgCount} msg · ${new Date(s.created).toLocaleDateString()}</div>
      </div>
      <button onclick="brainDeleteSession('${s.id}')" title="Delete session"
        style="flex-shrink:0;background:transparent;border:1px solid transparent;border-radius:6px;padding:4px 6px;cursor:pointer;font-size:11px;color:#ef444488;transition:all .1s"
        onmouseover="this.style.color='#ef4444';this.style.borderColor='#ef444444'"
        onmouseout="this.style.color='#ef444488';this.style.borderColor='transparent'">✕</button>
    </div>`).join('');
}

// ── Expression editor modal ───────────────────────────────────────────
// Called from character view modal — doesn't require brain to be active
function brainOpenExpressionEditorFor(charId) {
  _brain.charId = _brain.charId || charId; // set if not already set
  brainLoadExpressionMap(charId).then(() => brainOpenExpressionEditor());
}

function brainOpenExpressionEditor() {
  const char = characters.find(c=>c.id===(_brain.charId));
  if (!char) return;
  const emotions = Object.keys(BRAIN_EMOTION_KEYWORDS).concat(['neutral']);
  // Remove any existing instance first
  document.getElementById('modal-brain-expr')?.remove();
  const html = `
    <div class="modal-overlay open" id="modal-brain-expr" style="z-index:9999">
      <div class="modal-box" style="max-width:560px;max-height:90vh;overflow-y:auto;overflow-x:hidden">
        <button class="modal-close" onclick="document.getElementById('modal-brain-expr').remove()">✕</button>
        <div class="modal-title">${t('aiTool.cbExpressionMap')||'🎭 Expression Map'} — ${escHTML(char.name)}</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
          ${t('aiTool.cbMapDesc')||'Map emotions to sprite filenames. The AI picks the right sprite based on mood.'}<br>
          ${t('aiTool.cbSpritesLiveIn')||'Sprites live in'} <code>characters/${char.id}/</code>
        </div>

        <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">${t('aiTool.cbEmotionSprites')||'EMOTION SPRITES'}</div>
        ${emotions.map(emo => {
          const emoLabels = {happy:t('aiTool.emoHappy')||'Happy',sad:t('aiTool.emoSad')||'Sad',angry:t('aiTool.emoAngry')||'Angry',blush:t('aiTool.emoBlush')||'Blush',surprised:t('aiTool.emoSurprised')||'Surprised',disgusted:t('aiTool.emoDisgusted')||'Disgusted',scared:t('aiTool.emoScared')||'Scared',smug:t('aiTool.emoSmug')||'Smug',focused:t('aiTool.emoFocused')||'Focused',neutral:t('aiTool.emoNeutral')||'Neutral'};
          const mapped = (_brain.expressionMap[emo]||[]).join(', ');
          const detected = Object.keys(_brain.sprites).filter(f=>f.toLowerCase().includes(emo));
          const charSlug = char.name.toLowerCase().replace(/\s+/g,'_');
          return `<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;margin-bottom:7px">
            <div style="font-size:12px;font-weight:700">${escHTML(emoLabels[emo]||emo)}</div>
            <input class="form-input" style="font-size:11px" id="expr-${emo}"
              value="${escHTML(mapped)}"
              placeholder="${detected.length?(t('aiTool.cbAutoPrefix')||'Auto: ')+detected[0]:(t('aiTool.cbExamplePrefix')||'e.g. ')+emo+'_'+charSlug+'.png'}">
          </div>`;
        }).join('')}

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${t('aiTool.cbTalkingFrames')||'TALKING FRAMES'} <span style="font-weight:400;font-style:italic;font-size:10px">${t('aiTool.cbTalkingFramesOptional')||'(optional — for mouth animation)'}</span></div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px;line-height:1.5">
            ${t('aiTool.cbTalkingFramesHint')||'If provided, the sprite will alternate between mouth-open and mouth-closed while the AI is typing. Eyes-closed is used for blinking.'}
          </div>
          ${[['mouth_open',t('aiTool.talkingMouthOpen')||'Mouth Open'],['mouth_closed',t('aiTool.talkingMouthClosed')||'Mouth Closed'],['eyes_closed',t('aiTool.talkingEyesClosed')||'Eyes Closed']].map(([key,label]) => {
            const mapped2 = (_brain.expressionMap['__'+key]||[]).join(', ');
            const charSlug2 = char.name.toLowerCase().replace(/\s+/g,'_');
            const detected2 = Object.keys(_brain.sprites).filter(f=>f.toLowerCase().includes(key.replace('_','')));
            return `<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;margin-bottom:7px">
              <div style="font-size:12px;font-weight:700">${escHTML(label)}</div>
              <input class="form-input" style="font-size:11px" id="expr-__${key}"
                value="${escHTML(mapped2)}"
                placeholder="${detected2.length?(t('aiTool.cbAutoPrefix')||'Auto: ')+detected2[0]:(t('aiTool.cbExamplePrefix')||'e.g. ')+key+'_'+charSlug2+'.png'}">
            </div>`;
          }).join('')}
        </div>

        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${t('aiTool.cbCustomExpressions')||'CUSTOM EXPRESSIONS'} <span style="font-weight:400;font-style:italic;font-size:10px">${t('aiTool.cbCustomExpressionsHint')||'(add your own)'}</span></div>
          <div id="expr-custom-rows">
            ${Object.entries(_brain.expressionMap).filter(([k])=>k.startsWith('custom_')).map(([k,v])=>`
              <div style="display:grid;grid-template-columns:110px 1fr 28px;gap:6px;align-items:center;margin-bottom:7px" id="row-${k}">
                <input class="form-input" style="font-size:11px" id="expr-customname-${k}" value="${escHTML(k.replace('custom_',''))}" placeholder="expression name">
                <input class="form-input" style="font-size:11px" id="expr-customfile-${k}" value="${escHTML(v.join(', '))}" placeholder="filename.png">
                <button class="btn btn-ghost" style="font-size:11px;padding:4px;color:#ef4444" onclick="document.getElementById('row-${k}').remove()">✕</button>
              </div>`).join('')}
          </div>
          <button class="btn btn-ghost" style="font-size:11px;margin-top:4px" onclick="brainAddCustomExprRow()">${t('aiTool.cbAddExpression')||'＋ Add expression'}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" onclick="brainSaveExpressionMap()">${t('aiTool.cbSaveMap')||'Save Map'}</button>
          <button class="btn btn-ghost" onclick="document.getElementById('modal-brain-expr').remove()">${t('common.cancel')||'Cancel'}</button>
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">${t('aiTool.cbDetectedSprites')||'DETECTED SPRITES'}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${Object.keys(_brain.sprites).map(f =>
              `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">${escHTML(f)}</span>`
            ).join('') || `<span style="font-size:11px;color:var(--text3)">${t('aiTool.cbNoSpritesLoaded')||'No sprites loaded. Add PNGs to the character folder.'}</span>`}
          </div>
          ${window.electronAPI?.openSpriteDir ? `
          <button class="btn btn-ghost" style="font-size:11px;margin-top:10px" onclick="window.electronAPI.openSpriteDir('${char.id}')">
            ${t('aiTool.cbOpenSpriteFolder')||'📁 Open Sprite Folder'}
          </button>` : ''}
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  // Click outside to close
  const overlay = document.getElementById('modal-brain-expr');
  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function brainAddCustomExprRow() {
  const container = document.getElementById('expr-custom-rows');
  if (!container) return;
  const key = 'custom_' + Date.now();
  const charSlug = (characters.find(c=>c.id===_brain.charId)?.name||'char').toLowerCase().replace(/\s+/g,'_');
  const row = document.createElement('div');
  row.id = 'row-' + key;
  row.style.cssText = 'display:grid;grid-template-columns:110px 1fr 28px;gap:6px;align-items:center;margin-bottom:7px';
  row.innerHTML = `<input class="form-input" style="font-size:11px" id="expr-customname-${key}" placeholder="expression name">
    <input class="form-input" style="font-size:11px" id="expr-customfile-${key}" placeholder="e.g. wink_${charSlug}.png">
    <button class="btn btn-ghost" style="font-size:11px;padding:4px;color:#ef4444" onclick="this.closest('[id^=row-]').remove()">✕</button>`;
  container.appendChild(row);
}

function brainSaveExpressionMap() {
  const emotions = Object.keys(BRAIN_EMOTION_KEYWORDS).concat(['neutral']);
  // Standard emotions
  emotions.forEach(emo => {
    const inp = document.getElementById('expr-'+emo);
    if (!inp) return;
    const val = inp.value.trim();
    _brain.expressionMap[emo] = val ? val.split(',').map(s=>s.trim()).filter(Boolean) : [];
  });
  // Talking frames + eyes closed
  ['mouth_open','mouth_closed','eyes_closed'].forEach(key => {
    const inp = document.getElementById('expr-__'+key);
    if (!inp) return;
    const val = inp.value.trim();
    _brain.expressionMap['__'+key] = val ? val.split(',').map(s=>s.trim()).filter(Boolean) : [];
  });
  // Custom expressions — collect all rows
  Object.keys(_brain.expressionMap).filter(k=>k.startsWith('custom_')).forEach(k => delete _brain.expressionMap[k]);
  document.querySelectorAll('[id^="row-custom_"]').forEach(row => {
    const keyEl  = row.querySelector('[id^="expr-customname-"]');
    const fileEl = row.querySelector('[id^="expr-customfile-"]');
    if (!keyEl || !fileEl) return;
    const name = keyEl.value.trim().toLowerCase().replace(/\s+/g,'_');
    const files = fileEl.value.trim();
    if (name && files) _brain.expressionMap['custom_'+name] = files.split(',').map(s=>s.trim()).filter(Boolean);
  });
  const key = 'charactry_brain_exprmap_' + _brain.charId;
  localforage.setItem(key, _brain.expressionMap).catch(()=>{});
  document.getElementById('modal-brain-expr')?.remove();
  toast('Expression map saved ✦', 'success', 1800);
  brainUpdateSprite(_brain.currentEmotion);
}

async function brainLoadExpressionMap(charId) {
  const key = 'charactry_brain_exprmap_' + charId;
  _brain.expressionMap = (await localforage.getItem(key).catch(()=>null)) || {};
}

// ── Main render ───────────────────────────────────────────────────────
async function renderAICharacterBrain() {
  const cont = document.getElementById('ai-tab-content');
  if (!cont) return;

  if (characters.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">🧠</div>
      <div class="empty-title">${t('aiTool.cbPickCharTitle')||'No characters yet'}</div>
      <div class="empty-desc">${t('aiTool.cbPickCharDesc')||'Add characters to Charactry before using Character Brain.'}</div></div>`;
    return;
  }

  const opts = characters.map(c =>
    `<option value="${c.id}">${escHTML(c.name)}${c.species?' ('+escHTML(c.species)+')':''}</option>`
  ).join('');

  const blinkEnabled = settings.brainBlink !== false;

  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;height:calc(100vh - 200px);min-height:540px">

      <!-- ── LEFT SIDEBAR ── -->
      <div style="display:flex;flex-direction:column;gap:12px;overflow:hidden">

        <!-- Character picker -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px">
          <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">${t('aiTool.characterOptional')||'Character'}</div>
          <select class="form-select" id="brain-char-sel" style="font-size:12px" onchange="brainSelectChar(this.value)">
            <option value="">${t('aiTool.cbPickChar')||'— Pick a character —'}</option>
            ${opts}
          </select>
        </div>

        <!-- Sprite stage -->
        <div id="brain-sprite-stage" style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative;display:flex;align-items:flex-end;justify-content:center;height:340px;flex-shrink:0">
          <img id="brain-sprite-img" style="display:none;position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:100%;height:100%;object-fit:cover;object-position:top center;transition:opacity .15s" src="">
          <div id="brain-sprite-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;padding:16px">
            <div style="font-size:32px;opacity:.3">🧍</div>
            <div style="font-size:10px;color:var(--text3);text-align:center">${t('aiTool.cbNoSprites')||'No sprites loaded.'}<br>${t('aiTool.cbSpritesPath')||'Add PNGs to'}<br><code style="font-size:9px">characters/{id}/</code><br><br><span style="opacity:.6">${t('aiTool.cbSpritesHint')||'Recommended: 500–1000px tall · transparent PNG'}</span></div>
          </div>
          <!-- Emotion badge -->
          <div id="brain-emotion-badge" style="display:none;position:absolute;top:8px;right:8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;color:var(--text2)"></div>
        </div>

        <!-- Controls -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-ghost" style="font-size:11px;justify-content:flex-start;text-align:left" onclick="brainNewSession()">${t('aiTool.cbNewSession')||'＋ New Session'}</button>
          <button class="btn btn-ghost" style="font-size:11px;justify-content:flex-start;text-align:left" onclick="brainSaveSession()">${t('aiTool.cbSaveSession')||'💾 Save Session'}</button>
          <button class="btn btn-ghost" style="font-size:11px;justify-content:flex-start;text-align:left" onclick="brainOpenExpressionEditor()">${t('aiTool.cbExpressionMap')||'🎭 Expression Map'}</button>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 2px">
            <span style="font-size:11px;color:var(--text2)">${t('aiTool.cbBlinking')||'Blinking'}</span>
            <div onclick="brainToggleBlink(this)" style="width:36px;height:20px;border-radius:10px;cursor:pointer;position:relative;transition:all .2s;
              background:${blinkEnabled?'var(--accent)':'var(--bg3)'};border:1.5px solid ${blinkEnabled?'var(--accent)':'var(--border)'}">
              <div style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s;
                left:${blinkEnabled?'18px':'2px'}"></div>
            </div>
          </div>
        </div>

        <!-- Past sessions -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px;flex:0 0 auto;max-height:160px;overflow-y:auto">
          <div style="font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">${t('aiTool.cbPastSessions')||'Past Sessions'}</div>
          <div id="brain-session-list"><div style="font-size:11px;color:var(--text3)">${t('aiTool.cbNoSessions')||'No saved sessions yet'}</div></div>
        </div>
      </div>

      <!-- ── MAIN CHAT ── -->
      <div style="display:flex;flex-direction:column;background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden">

        <!-- Chat header -->
        <div id="brain-chat-header" style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;gap:10px">
          <div id="brain-header-ava"></div>
          <div>
            <div id="brain-header-name" style="font-weight:700;font-size:14px">${t('aiTool.cbPickCharTitle')||'Pick a character'}</div>
            <div id="brain-header-sub"  style="font-size:11px;color:var(--text3)">${t('aiTool.cbPickCharDesc')||'Select a character to begin'}</div>
          </div>
          <div style="margin-left:auto;font-size:10px;color:var(--text3)" id="brain-model-badge">${settings.ollamaModel||'mistral'}</div>
        </div>

        <!-- Messages -->
        <div id="brain-chat-msgs" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column">
          <div style="text-align:center;color:var(--text3);font-size:13px;padding:40px 0">${t('aiTool.cbSelectChar')||'Select a character to start talking…'}</div>
        </div>

        <!-- Typing indicator -->
        <div id="brain-typing" style="display:none;padding:8px 16px;align-items:center;gap:8px">
          <div style="display:flex;gap:4px">
            <div style="width:7px;height:7px;border-radius:50%;background:var(--accent);animation:aiPulse .5s infinite alternate"></div>
            <div style="width:7px;height:7px;border-radius:50%;background:var(--accent);animation:aiPulse .5s .15s infinite alternate"></div>
            <div style="width:7px;height:7px;border-radius:50%;background:var(--accent);animation:aiPulse .5s .3s infinite alternate"></div>
          </div>
          <div id="brain-typing-name" style="font-size:11px;color:var(--text3)">typing…</div>
        </div>

        <!-- Input row -->
        <div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end">
          <textarea id="brain-input"
            style="flex:1;resize:none;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:13px;font-family:'Nunito',sans-serif;color:var(--text);min-height:40px;max-height:120px;overflow-y:auto;line-height:1.5;transition:border-color .15s;outline:none"
            placeholder="${t('aiTool.cbSendPlaceholder')||'Say something…'}"
            rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();brainSend();}"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
            disabled></textarea>
          <button id="brain-stop-btn" class="btn btn-ghost" style="padding:9px 12px;font-size:13px;flex-shrink:0;display:none;color:#ef4444;border-color:#ef444466" onclick="brainStop()" title="Stop generation">■ Stop</button>
          <button id="brain-send-btn" class="btn btn-primary" style="padding:9px 16px;font-size:13px;flex-shrink:0" onclick="brainSend()" disabled>${t('aiTool.cbSend')||'Send'}</button>
        </div>
      </div>
    </div>`;

  // Restore last used character if any
  const lastChar = _brain.charId;
  if (lastChar && characters.find(c=>c.id===lastChar)) {
    const sel = document.getElementById('brain-char-sel');
    if (sel) { sel.value = lastChar; brainSelectChar(lastChar, true); }
  }
}

async function brainSelectChar(charId, restoreSession=false) {
  _brain.charId = charId;
  _brain.cbIcon = null; // reset cached icon
  brainStopBlink();
  await loadMemExpCache(); // refresh memory expansion profiles for this char

  const char = characters.find(c=>c.id===charId);
  if (!char) return;

  // Try to load CB_icon.png first — used in chat bubbles and header
  if (window.electronAPI?.readCBIcon) {
    _brain.cbIcon = await window.electronAPI.readCBIcon(charId);
  }

  // Update header
  const avaEl  = document.getElementById('brain-header-ava');
  const nameEl = document.getElementById('brain-header-name');
  const subEl  = document.getElementById('brain-header-sub');

  const headerIconSrc = _brain.cbIcon || char.avatar || null;
  if (avaEl) avaEl.innerHTML = headerIconSrc
    ? `<img src="${headerIconSrc}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)44">`
    : `<div style="width:36px;height:36px;border-radius:50%;background:${char.color1||'var(--accent)'}33;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:${char.color1||'var(--accent)'}">${escHTML((char.name||'?')[0])}</div>`;
  if (nameEl) nameEl.textContent = char.name;
  if (subEl)  subEl.textContent  = [char.species, char.pronouns].filter(Boolean).join(' · ');

  // Enable input
  const input   = document.getElementById('brain-input');
  const sendBtn = document.getElementById('brain-send-btn');
  const typing  = document.getElementById('brain-typing-name');
  if (input)   input.disabled   = false;
  if (sendBtn) sendBtn.disabled = false;
  if (typing)  typing.textContent = `${char.name} is typing…`;

  // Load sprites and expression map
  await brainLoadExpressionMap(charId);
  await brainLoadSprites(charId);
  brainUpdateSprite('neutral');

  // Load session list
  await brainLoadSessionList();

  // New session if none active or different char
  if (!restoreSession || !_brain.sessionId) {
    brainNewSession();
  } else {
    brainRenderChat();
  }

  // Ensure char folder exists
  if (window.electronAPI?.ensureCharDir) window.electronAPI.ensureCharDir(charId);

  // Start blinking
  brainStartBlink();
}

function brainToggleBlink(el) {
  settings.brainBlink = !settings.brainBlink;
  saveData();
  const on = settings.brainBlink;
  el.style.background   = on ? 'var(--accent)' : 'var(--bg3)';
  el.style.borderColor  = on ? 'var(--accent)' : 'var(--border)';
  el.querySelector('div').style.left = on ? '18px' : '2px';
  if (on) { brainStartBlink(); toast('Blinking on ✦', 'success', 1500); }
  else     { brainStopBlink();  toast('Blinking off',  'info',    1500); }
}