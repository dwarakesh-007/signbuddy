// Popup: start/stop button and settings.
const DEFAULTS = {
  speed: 'normal', captions: true, size: 'medium', source: 'tab',
  useLLM: false, llmModel: 'llama3.2', onDeviceSpeech: false, lang: 'en-US', style: '3d'
};
let settings = { ...DEFAULTS };
let tab = null;
let session = { running: false };

const $ = (id) => document.getElementById(id);
const btn = $('startStop');

function setStatus(text, isError) {
  $('status').textContent = text;
  $('status').classList.toggle('err', !!isError);
}

function save() { chrome.storage.local.set({ settings }); }

function render() {
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('sel', settings[seg.dataset.key] === b.dataset.v));
  });
  $('captions').checked = settings.captions;
  $('useLLM').checked = settings.useLLM;
  $('onDeviceSpeech').checked = settings.onDeviceSpeech;
  $('llmModel').value = settings.llmModel;
  $('llmBox').style.display = settings.useLLM ? 'block' : 'none';

  const here = session.running && tab && session.tabId === tab.id;
  btn.textContent = here ? 'Stop' : session.running ? 'Stop (running in another tab)' : 'Start';
  btn.classList.toggle('stop', session.running);
}

function getStreamId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });
}

async function start() {
  if (!tab || !/^https?:/.test(tab.url || '')) {
    setStatus('Open a meeting or video page first (not a chrome:// page).', true);
    return;
  }
  btn.disabled = true;
  setStatus('Starting…');
  try {
    let r;
    if (settings.source === 'tab') {
      const streamId = await getStreamId(tab.id);
      r = await chrome.runtime.sendMessage({ type: 'popup-start', tabId: tab.id, streamId, mode: 'tab' });
    } else {
      r = await chrome.runtime.sendMessage({ type: 'popup-start', tabId: tab.id, mode: 'mic' });
    }
    if (r && r.error) throw new Error(r.error);
    session = await chrome.runtime.sendMessage({ type: 'popup-status' });
    setStatus(session.mode === 'mic' ? 'Running (microphone).' : 'Running — listening to this tab.');
  } catch (e) {
    setStatus('Could not start: ' + e.message, true);
  } finally {
    btn.disabled = false;
    render();
  }
}

async function stop() {
  btn.disabled = true;
  await chrome.runtime.sendMessage({ type: 'popup-stop' });
  session = { running: false };
  btn.disabled = false;
  setStatus('Stopped.');
  render();
}

btn.addEventListener('click', () => (session.running ? stop() : start()));

document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[seg.dataset.key] = b.dataset.v;
    save(); render();
    if (seg.dataset.key === 'source' && session.running) setStatus('Press Stop then Start to switch the audio source.');
  });
});
['captions', 'useLLM', 'onDeviceSpeech'].forEach((id) =>
  $(id).addEventListener('change', () => { settings[id] = $(id).checked; save(); render(); }));
$('llmModel').addEventListener('change', () => { settings.llmModel = $('llmModel').value.trim() || DEFAULTS.llmModel; save(); });
$('playground').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('test/playground.html') });
});

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await chrome.storage.local.get('settings');
  settings = { ...DEFAULTS, ...(r.settings || {}) };
  session = (await chrome.runtime.sendMessage({ type: 'popup-status' })) || { running: false };
  if (session.running) setStatus(session.tabId === tab.id ? 'Running in this tab.' : 'Running in another tab.');
  render();
})();
