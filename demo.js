// Live demo on the website: the same character code the extension uses.
(function () {
  const SB = window.SignBuddy;
  const $ = (id) => document.getElementById(id);
  const canvas = $('c');
  const use3D = SB.SignAvatar3D && SB.SignAvatar3D.supported();
  const avatar = use3D ? new SB.SignAvatar3D(canvas) : new SB.SignAvatar(canvas);
  const dict = use3D ? SB.signs3d : SB.signs;

  function fit() {
    const w = Math.min(330, canvas.parentElement.clientWidth - 24);
    avatar.resize(w);
  }
  fit();
  window.addEventListener('resize', fit);

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  avatar.onChange((st) => {
    let html = '';
    if (st.label) {
      html = st.spelled
        ? '<span class="now">' + st.letters.split('').map((ch, i) => `<span class="l${i === st.letterIndex ? ' cur' : ''}">${esc(ch)}</span>`).join('') + '</span>'
        : `<span class="now">${esc(st.label)}</span>`;
    }
    if (st.upcoming.length) html += `<span class="next">${st.upcoming.slice(0, 4).map(esc).join(' ')}${st.upcoming.length > 4 ? ' …' : ''}</span>`;
    $('gloss').innerHTML = html;
  });

  function sign(text) {
    const sentences = SB.gloss.toGloss(text);
    if (!sentences.length) return;
    $('out').textContent = sentences.map((s) => s.tokens.join(' ') + (s.qtype === 'wh' ? ' (WH-question)' : s.qtype === 'yn' ? ' (yes/no question)' : '')).join('  ·  ');
    sentences.forEach((s) => avatar.enqueueTokens(s.tokens, { question: s.question, qtype: s.qtype }));
  }

  $('go').onclick = () => sign($('text').value);
  $('text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sign($('text').value); } });
  $('clear').onclick = () => avatar.clear();
  $('speed').onchange = (e) => avatar.setSpeed(parseFloat(e.target.value));

  const words = $('words');
  dict.knownWords().forEach((w) => {
    const b = document.createElement('button');
    b.textContent = w;
    b.onclick = () => avatar.enqueue(dict.clipFor(w));
    words.appendChild(b);
  });
  const letters = $('letters');
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch) => {
    const b = document.createElement('button');
    b.textContent = ch;
    b.onclick = () => avatar.enqueue(dict.clipFor(ch));
    letters.appendChild(b);
  });

  // Microphone (Chrome / Edge only)
  let mic = null;
  const micBtn = $('mic');
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    micBtn.disabled = true;
    $('micnote').textContent = 'Speaking needs Chrome or Edge. You can still type.';
  }
  micBtn.onclick = () => {
    if (mic) { mic.stop(); mic = null; micBtn.textContent = '🎤 Speak'; micBtn.classList.remove('on'); return; }
    mic = SB.STT.create('webspeech', {
      onText: (t, final) => { $('text').value = t; if (final) sign(t); },
      onError: (code) => {
        $('micnote').textContent = code === 'not-allowed' ? 'Microphone blocked — allow it in the address bar to speak.' : 'Speech error: ' + code;
        if (mic) micBtn.click();
      }
    });
    mic.start(null);
    micBtn.textContent = '■ Stop';
    micBtn.classList.add('on');
    $('micnote').textContent = 'Listening… speak a sentence.';
  };

  setInterval(() => { $('behind').hidden = avatar.backlogMs() < 5000; }, 300);

  // Greet visitors once the demo scrolls into view.
  let greeted = false;
  new IntersectionObserver((entries) => {
    if (!greeted && entries.some((e) => e.isIntersecting)) { greeted = true; sign('Hello!'); }
  }, { threshold: 0.5 }).observe(canvas);
})();
