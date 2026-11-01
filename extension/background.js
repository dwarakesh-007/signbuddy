// SignBuddy background service worker.
// Its job: be the "post office". It starts/stops audio capture, and passes
// messages between the popup, the offscreen page (audio + speech-to-text)
// and the content script (the character on the meeting page).

const CONTENT_FILES = [
  'lib/three.min.js',
  'content/gloss.js',
  'content/handshapes.js',
  'content/signs.js',
  'content/avatar.js',
  'content/signs3d.js',
  'content/avatar3d.js',
  'stt/stt.js',
  'stt/webspeech.js',
  'content/overlay.js'
];
const OFFSCREEN_URL = 'offscreen/offscreen.html';
const DEFAULTS = {
  speed: 'normal', captions: true, size: 'medium', source: 'tab',
  useLLM: false, llmModel: 'llama3.2', onDeviceSpeech: false, lang: 'en-US', style: '3d'
};

// The service worker can be shut down by Chrome at any time, so we keep the
// session in chrome.storage.session (survives restarts, cleared when Chrome closes).
let session = { running: false, tabId: null, mode: null };
const ready = chrome.storage.session.get('session').then((r) => {
  if (r.session) session = r.session;
});
const saveSession = () => chrome.storage.session.set({ session });

async function getSettings() {
  const r = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(r.settings || {}) };
}

function toTab(msg) {
  if (session.tabId == null) return Promise.resolve();
  return chrome.tabs.sendMessage(session.tabId, msg).catch(() => {});
}

// Make sure the character's code is running in the tab.
// Meeting sites get it automatically (manifest); any other site gets it injected now.
async function ensureContent(tabId) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (r && r.pong) return;
  } catch (e) { /* not injected yet */ }
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
}

async function hasOffscreen() {
  const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return ctxs.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture the meeting tab audio to make live captions and signing.'
  });
}

async function closeOffscreen() {
  if (!(await hasOffscreen())) return;
  try { await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' }); } catch (e) {}
  try { await chrome.offscreen.closeDocument(); } catch (e) {}
}

async function start(tabId, streamId, mode) {
  if (session.running) await stop(null);
  await ensureContent(tabId);
  session = { running: true, tabId, mode };
  await saveSession();
  await toTab({ type: 'session', running: true, mode });

  if (mode === 'mic') {
    await toTab({ type: 'start-mic' });
    return { ok: true, mode };
  }

  const settings = await getSettings();
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({
    target: 'offscreen', type: 'start', streamId,
    lang: settings.lang, preferLocal: settings.onDeviceSpeech
  });
  if (r && r.error) {
    await switchToMic('Tab audio could not start (' + r.error + ').');
  }
  return { ok: true, mode: session.mode };
}

// Plan B: if speech recognition can't read the tab audio on this Chrome version,
// listen with the microphone from inside the meeting page instead.
async function switchToMic(reason) {
  await closeOffscreen();
  session.mode = 'mic';
  await saveSession();
  await toTab({ type: 'session', running: true, mode: 'mic', note: reason + ' Using the microphone instead.' });
  await toTab({ type: 'start-mic' });
}

async function stop(reason) {
  await closeOffscreen();
  await toTab({ type: 'session', running: false, reason: reason || '' });
  session = { running: false, tabId: null, mode: null };
  await saveSession();
  return { ok: true };
}

// Optional "better grammar" step using a local Ollama model.
async function llmGloss(text, model) {
  const prompt =
    'Convert the English sentence into ASL gloss.\n' +
    'Rules: use ASL word order (time words first, topic before comment, question words like WHAT/WHERE at the end). ' +
    'Drop "is", "am", "are", "the", "a", "an", "to". Use UPPERCASE words. Join multi-word signs with hyphens ' +
    '(THANK-YOU, I-LOVE-YOU). Use ME for I/me and YOU for you.\n' +
    'Reply with ONLY the gloss on one line, nothing else.\n\n' +
    'English: ' + text + '\nGloss:';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || DEFAULTS.llmModel, prompt, stream: false, options: { temperature: 0 } }),
      signal: ctrl.signal
    });
    if (!res.ok) return { error: 'Ollama replied ' + res.status };
    const j = await res.json();
    return { gloss: (j.response || '').split('\n')[0] };
  } catch (e) {
    return { error: 'Ollama not reachable' };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'offscreen') return; // meant for the offscreen page, not us

  (async () => {
    await ready;
    switch (msg.type) {
      case 'popup-start': return start(msg.tabId, msg.streamId, msg.mode);
      case 'popup-stop': return stop('Stopped');
      case 'popup-status': return session;
      case 'llm-gloss': return llmGloss(msg.text, msg.model);
      case 'transcript':
        if (msg.from === 'offscreen') toTab({ type: 'transcript', text: msg.text, final: msg.final });
        return;
      case 'stt-error':
        if (msg.from !== 'offscreen') return;
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(msg.code)) {
          await switchToMic('Speech recognition could not read tab audio.');
        } else {
          toTab({ type: 'stt-error', code: msg.code });
        }
        return;
      case 'capture-ended':
        if (session.running && session.mode === 'tab') await stop('Tab audio ended');
        return;
      default:
        return;
    }
  })().then(
    (r) => sendResponse(r),
    (err) => sendResponse({ error: String((err && err.message) || err) })
  );
  return true; // we answer asynchronously
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ready;
  if (session.running && tabId === session.tabId) stop('Tab closed');
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'toggle-overlay' }).catch(() => {});
});
