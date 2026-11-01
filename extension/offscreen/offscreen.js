// Offscreen page: captures the meeting tab's audio and turns it into text.
// Why a separate hidden page? Service workers can't use audio, and if we did this
// inside the meeting page itself we could create an echo loop.

let stream = null;
let audioCtx = null;
let stt = null;

function send(m) {
  chrome.runtime.sendMessage({ from: 'offscreen', ...m }).catch(() => {});
}

async function start({ streamId, lang, preferLocal }) {
  stop();

  // 1. Turn the stream id from chrome.tabCapture into real audio.
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false
  });

  // 2. Capturing a tab mutes it for the user. Play it back so people can still hear the meeting.
  audioCtx = new AudioContext();
  audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);

  const track = stream.getAudioTracks()[0];
  track.addEventListener('ended', () => send({ type: 'capture-ended' }));

  // 3. Speech to text. Swap 'webspeech' for another engine (e.g. 'whisper') later.
  stt = self.SignBuddy.STT.create('webspeech', {
    lang,
    preferLocal,
    onText: (text, final) => send({ type: 'transcript', text, final }),
    onError: (code) => send({ type: 'stt-error', code })
  });
  stt.start(track);
}

function stop() {
  if (stt) { stt.stop(); stt = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'start') {
    start(msg).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ error: (e && e.message) || String(e) })
    );
    return true;
  }
  if (msg.type === 'stop') {
    stop();
    sendResponse({ ok: true });
  }
});
