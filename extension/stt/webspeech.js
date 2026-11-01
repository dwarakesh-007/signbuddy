// Speech-to-text using the browser's built-in Web Speech API (free, no API key).
// If an audio track is given, newer Chrome versions listen to that track (the meeting audio).
// With no track, it listens to the microphone.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;

  function createWebSpeech(opts) {
    const onText = opts.onText || (() => {});
    const onError = opts.onError || (() => {});
    let running = false;
    let rec = null;
    let track = null;
    let preferLocal = !!opts.preferLocal;
    let failures = 0;

    function begin() {
      if (!running) return;
      rec = new SR();
      rec.lang = opts.lang || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      // Experimental: on-device recognition (works offline) in recent Chrome.
      if (preferLocal && 'processLocally' in rec) rec.processLocally = true;

      rec.onresult = (e) => {
        failures = 0;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0].transcript.trim();
          if (res.isFinal) { if (text) onText(text, true); }
          else interim += ' ' + text;
        }
        if (interim.trim()) onText(interim.trim(), false);
      };

      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return; // normal pauses
        if (e.error === 'language-not-supported' && preferLocal) {
          preferLocal = false; // no offline language pack; go back to online
          return;
        }
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) running = false;
        onError(e.error);
      };

      // Chrome stops recognition after a while; quietly restart it while we're running.
      rec.onend = () => {
        if (!running) return;
        failures++;
        setTimeout(begin, failures > 5 ? 2000 : 200);
      };

      try {
        if (track) rec.start(track); else rec.start();
      } catch (err) {
        running = false;
        onError('start-failed');
      }
    }

    return {
      start(audioTrack) {
        if (!SR) { onError('not-supported'); return; }
        track = audioTrack || null;
        running = true;
        begin();
      },
      stop() {
        running = false;
        if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
      }
    };
  }

  if (SB.STT) SB.STT.register('webspeech', createWebSpeech);
})(typeof self !== 'undefined' ? self : this);
