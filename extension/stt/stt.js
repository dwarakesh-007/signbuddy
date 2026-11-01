// Speech-to-text "plug socket".
// Every engine is a factory: (options) => { start(audioTrack|null), stop() }
// and it calls options.onText(text, isFinal) and options.onError(code).
// Version 1 has 'webspeech'. In version 2 you can add stt/whisper.js that does
//   SignBuddy.STT.register('whisper', (opts) => { ... })
// and nothing else in the extension has to change.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});
  if (SB.STT) return;
  const engines = {};
  SB.STT = {
    register(name, factory) { engines[name] = factory; },
    create(name, opts) {
      if (!engines[name]) throw new Error('Unknown speech engine: ' + name);
      return engines[name](opts || {});
    },
    list() { return Object.keys(engines); }
  };
})(typeof self !== 'undefined' ? self : this);
