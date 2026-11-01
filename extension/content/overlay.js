// Content script: the floating SignBuddy card on the meeting page.
// It shows the character, the gloss being signed, and live captions.
(() => {
  if (window.__signBuddyOverlay) return; // already running in this tab
  window.__signBuddyOverlay = true;

  const SB = window.SignBuddy;
  const DEFAULTS = {
    speed: 'normal', captions: true, size: 'medium', source: 'tab',
    useLLM: false, llmModel: 'llama3.2', onDeviceSpeech: false, lang: 'en-US', style: '3d'
  };
  const SPEEDS = { slow: 0.6, normal: 1, fast: 1.6 };
  const SIZES = { small: 150, medium: 220, large: 320 };
  const CATCH_UP_MS = 5000;   // show "catching up..." above this backlog
  const MAX_BACKLOG_MS = 20000; // drop old words above this, to stay live

  let settings = { ...DEFAULTS };
  let ui = null;
  let avatar = null;
  let running = false;
  let mode = null;
  let collapsed = false;
  let mic = null;
  let finals = [];
  let glossChain = Promise.resolve();
  let llmWarned = false;
  let lastSkip = 0;
  let savedPos = null;
  let avatarStyle = null;

  // ---------- settings ----------
  chrome.storage.local.get(['settings', 'pos']).then((r) => {
    settings = { ...DEFAULTS, ...(r.settings || {}) };
    if (r.pos) savedPos = r.pos;
    if (ui) { applySettings(); if (savedPos) placeAt(savedPos.left, savedPos.top); }
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.settings) {
      settings = { ...DEFAULTS, ...(ch.settings.newValue || {}) };
      applySettings();
    }
  });

  // ---------- when to show automatically ----------
  function isMeetingPage() {
    const h = location.hostname, p = location.pathname;
    if (h === 'meet.google.com') return /^\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}/.test(p);
    if (h.endsWith('zoom.us')) return p.startsWith('/wc/') || p.includes('/wc/');
    if (h === 'teams.microsoft.com' || h === 'teams.live.com') return true;
    if (h === 'www.youtube.com') return p.startsWith('/watch') || p.startsWith('/live');
    return false;
  }

  // ---------- build the card ----------
  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1b1f3a; }
    .card { background: #ffffffee; backdrop-filter: blur(6px); border-radius: 16px;
      box-shadow: 0 8px 30px rgba(20,25,60,.28); overflow: hidden; border: 1px solid #dfe3f5; }
    .bar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; background: #eef1ff;
      cursor: grab; user-select: none; touch-action: none; }
    .bar:active { cursor: grabbing; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #adb5bd; flex: none; }
    .dot.on { background: #2fb344; box-shadow: 0 0 0 3px #2fb34433; }
    .title { font-weight: 700; font-size: 13px; margin-left: 4px; }
    .grow { flex: 1; }
    button { font: inherit; border: none; cursor: pointer; }
    .bar button { background: transparent; color: #3b4370; font-size: 12px; font-weight: 600;
      width: 24px; height: 22px; border-radius: 6px; }
    .bar button:hover { background: #dbe1ff; }
    .bar button.sel { background: #4c6ef5; color: #fff; }
    .stage { position: relative; display: flex; justify-content: center; background:
      radial-gradient(circle at 50% 40%, #f6f8ff, #e7ebff); }
    canvas { display: block; }
    .chip { position: absolute; left: 8px; top: 8px; background: #ffe8a3; color: #6b4e00;
      font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; display: none; }
    .chip.show { display: block; }
    .gloss { padding: 6px 10px 2px; font-size: 13px; font-weight: 700; letter-spacing: .3px;
      min-height: 20px; line-height: 1.5; word-break: break-word; }
    .gloss .now { background: #4c6ef5; color: #fff; padding: 1px 6px; border-radius: 6px; }
    .gloss .next { color: #8a91b5; font-weight: 600; margin-left: 6px; }
    .gloss .l { color: #8a91b5; }
    .gloss .l.cur { color: #fff; }
    .caption { padding: 2px 10px 8px; font-size: 13px; line-height: 1.4; max-height: 64px; overflow: hidden; }
    .caption .interim { color: #8a91b5; }
    .caption.off { display: none; }
    .status { padding: 4px 10px 8px; font-size: 11px; color: #5c6390; border-top: 1px solid #eef0f8; }
    .pill { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; display: none;
      background: #4c6ef5; color: #fff; font-weight: 700; font-size: 13px; padding: 8px 14px;
      border-radius: 999px; box-shadow: 0 6px 20px rgba(20,25,60,.3);
      font-family: system-ui, sans-serif; }
  `;

  function build() {
    if (ui) return ui;
    const host = document.createElement('div');
    host.id = 'signbuddy-root';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap">
        <div class="card">
          <div class="bar" title="Drag to move">
            <span class="dot"></span><span class="title">SignBuddy</span><span class="grow"></span>
            <button data-size="small" title="Small">S</button>
            <button data-size="medium" title="Medium">M</button>
            <button data-size="large" title="Large">L</button>
            <button class="hide" title="Hide (Alt+Shift+S)">✕</button>
          </div>
          <div class="stage"><canvas></canvas><div class="chip">catching up…</div></div>
          <div class="gloss"></div>
          <div class="caption"><span class="final"></span> <span class="interim"></span></div>
          <div class="status"></div>
        </div>
      </div>
      <button class="pill" title="Show SignBuddy (Alt+Shift+S)">🤟 SignBuddy</button>`;
    document.documentElement.appendChild(host);

    const $ = (s) => shadow.querySelector(s);
    ui = {
      host, wrap: $('.wrap'), card: $('.card'), bar: $('.bar'), dot: $('.dot'), canvas: $('canvas'),
      chip: $('.chip'), gloss: $('.gloss'), caption: $('.caption'), final: $('.final'),
      interim: $('.interim'), status: $('.status'), pill: $('.pill'), sizeBtns: shadow.querySelectorAll('[data-size]')
    };


    ui.sizeBtns.forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      settings.size = b.dataset.size;
      chrome.storage.local.set({ settings });
    }));
    $('.hide').addEventListener('click', (e) => { e.stopPropagation(); setCollapsed(true); });
    ui.pill.addEventListener('click', () => setCollapsed(false));
    makeDraggable();
    setInterval(checkBacklog, 300);
    applySettings();
    setStatus(running ? '' : 'Click the SignBuddy icon in the toolbar, then Start.');
    return ui;
  }

  // Make the character: 3D if the computer can draw it, otherwise the simple 2D one.
  function makeAvatar() {
    const want = settings.style === '2d' || !(SB.SignAvatar3D && SB.SignAvatar3D.supported()) ? '2d' : '3d';
    if (avatar && want === avatarStyle) return;
    const old = avatar;
    const fresh = document.createElement('canvas'); // a canvas can't switch between 2D and 3D drawing
    ui.canvas.replaceWith(fresh);
    ui.canvas = fresh;
    try {
      avatar = want === '3d' ? new SB.SignAvatar3D(fresh) : new SB.SignAvatar(fresh);
    } catch (e) {
      avatar = new SB.SignAvatar(fresh);
    }
    avatarStyle = want;
    if (old) old.destroy();
    avatar.onChange(renderGloss);
  }

  function applySettings() {
    if (!ui) return;
    makeAvatar();
    avatar.resize(SIZES[settings.size] || SIZES.medium);
    avatar.setSpeed(SPEEDS[settings.speed] || 1);
    ui.sizeBtns.forEach((b) => b.classList.toggle('sel', b.dataset.size === settings.size));
    ui.caption.classList.toggle('off', !settings.captions);
    ui.card.style.width = (SIZES[settings.size] || SIZES.medium) + 'px';
    clampIntoView();
  }

  function setCollapsed(v) {
    build();
    collapsed = v;
    ui.wrap.style.display = v ? 'none' : 'block';
    ui.pill.style.display = v ? 'block' : 'none';
  }

  function toggle() {
    if (!ui) { build(); setCollapsed(false); return; }
    setCollapsed(!collapsed);
  }

  // ---------- dragging ----------
  function makeDraggable() {
    let startX, startY, origX, origY, dragging = false;
    ui.bar.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const r = ui.wrap.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; origX = r.left; origY = r.top;
      ui.bar.setPointerCapture(e.pointerId);
    });
    ui.bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      placeAt(origX + e.clientX - startX, origY + e.clientY - startY);
    });
    ui.bar.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      const r = ui.wrap.getBoundingClientRect();
      savedPos = { left: r.left, top: r.top };
      chrome.storage.local.set({ pos: savedPos });
    });
    window.addEventListener('resize', clampIntoView);
    if (savedPos) placeAt(savedPos.left, savedPos.top);
  }

  function placeAt(left, top) {
    const r = ui.wrap.getBoundingClientRect();
    left = Math.max(0, Math.min(window.innerWidth - r.width, left));
    top = Math.max(0, Math.min(window.innerHeight - r.height, top));
    ui.wrap.style.left = left + 'px';
    ui.wrap.style.top = top + 'px';
    ui.wrap.style.right = 'auto';
    ui.wrap.style.bottom = 'auto';
  }

  function clampIntoView() {
    if (!ui || ui.wrap.style.left === '') return;
    requestAnimationFrame(() => placeAt(parseFloat(ui.wrap.style.left), parseFloat(ui.wrap.style.top)));
  }

  // ---------- display helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderGloss(state) {
    if (!ui) return;
    let html = '';
    if (state.label) {
      if (state.spelled) {
        const letters = state.letters.split('').map((ch, i) =>
          `<span class="l${i === state.letterIndex ? ' cur' : ''}">${esc(ch)}</span>`).join('');
        html = `<span class="now">${letters}</span>`;
      } else {
        html = `<span class="now">${esc(state.label)}</span>`;
      }
    }
    const next = state.upcoming.slice(0, 4);
    if (next.length) html += `<span class="next">${next.map(esc).join(' ')}${state.upcoming.length > 4 ? ' …' : ''}</span>`;
    ui.gloss.innerHTML = html;
  }

  function setStatus(text) { if (ui) ui.status.textContent = text; }

  function checkBacklog() {
    if (!avatar) return;
    let backlog = avatar.backlogMs();
    if (backlog > MAX_BACKLOG_MS) {
      avatar.trimTo(10000);
      lastSkip = performance.now();
      backlog = avatar.backlogMs();
    }
    const skipping = performance.now() - lastSkip < 2000;
    ui.chip.textContent = skipping ? 'skipping ahead…' : 'catching up…';
    ui.chip.classList.toggle('show', skipping || backlog > CATCH_UP_MS);
  }

  function showCaption(text, final) {
    if (final) {
      finals.push(text);
      let joined = finals.join(' ');
      while (joined.length > 180 && finals.length > 1) { finals.shift(); joined = finals.join(' '); }
      ui.final.textContent = joined;
      ui.interim.textContent = '';
    } else {
      ui.interim.textContent = text;
    }
  }

  // ---------- speech -> gloss -> signing ----------
  async function toGloss(text) {
    const rules = SB.gloss.toGloss(text);
    if (!settings.useLLM) return rules;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'llm-gloss', text, model: settings.llmModel });
      if (r && r.gloss) {
        const tokens = SB.gloss.parseLLM(r.gloss);
        if (tokens.length) {
          const q = rules.find((s) => s.qtype);
          return [{ tokens, question: !!q, qtype: q ? q.qtype : null }];
        }
      }
      if (r && r.error && !llmWarned) { llmWarned = true; setStatus(r.error + ' — using simple rules.'); }
    } catch (e) { /* fall back to rules */ }
    return rules;
  }

  function onTranscript(text, final) {
    build();
    showCaption(text, final);
    if (!final) return;
    glossChain = glossChain
      .then(() => toGloss(text))
      .then((sentences) => sentences.forEach((s) => avatar.enqueueTokens(s.tokens, { question: s.question, qtype: s.qtype })))
      .catch(() => {});
  }

  // ---------- microphone fallback (runs in the page) ----------
  function startMic() {
    stopMic();
    mic = SB.STT.create('webspeech', {
      lang: settings.lang,
      preferLocal: settings.onDeviceSpeech,
      onText: onTranscript,
      onError: (code) => setStatus('Speech error: ' + code + (code === 'not-allowed' ? ' (allow the microphone for this site)' : ''))
    });
    mic.start(null);
  }
  function stopMic() { if (mic) { mic.stop(); mic = null; } }

  function onSession(msg) {
    build();
    running = msg.running;
    mode = msg.mode || null;
    ui.dot.classList.toggle('on', running);
    if (running) {
      setCollapsed(false);
      setStatus(msg.note || (mode === 'mic' ? 'Listening with the microphone…' : 'Listening to the tab audio…'));
    } else {
      stopMic();
      avatar.clear();
      ui.interim.textContent = '';
      setStatus((msg.reason ? msg.reason + '. ' : '') + 'Press Start in the SignBuddy popup to begin.');
    }
  }

  // ---------- messages from the extension ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'ping': sendResponse({ pong: true }); return;
      case 'session': onSession(msg); break;
      case 'transcript': onTranscript(msg.text, msg.final); break;
      case 'start-mic': startMic(); break;
      case 'stt-error': setStatus('Speech error: ' + msg.code); break;
      case 'toggle-overlay': toggle(); break;
    }
  });

  // Show automatically on meeting pages (checks again for single-page apps like YouTube).
  function autoShow() { if (!ui && isMeetingPage()) build(); }
  autoShow();
  setInterval(autoShow, 2000);
})();
