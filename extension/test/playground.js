// Playground logic (separate file because Chrome extension pages block inline scripts).
const SB = window.SignBuddy;
const use3D = SB.SignAvatar3D && SB.SignAvatar3D.supported();
const avatar = use3D ? new SB.SignAvatar3D(document.getElementById('c')) : new SB.SignAvatar(document.getElementById('c'));
const dict = use3D ? SB.signs3d : SB.signs;
avatar.resize(300);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
avatar.onChange((st) => {
  let html = '';
  if (st.label) {
    html = st.spelled
      ? '<span class="now">' + st.letters.split('').map((ch, i) => `<span class="l${i === st.letterIndex ? ' cur' : ''}">${esc(ch)}</span>`).join('') + '</span>'
      : `<span class="now">${esc(st.label)}</span>`;
  }
  if (st.upcoming.length) html += `<span class="next">${st.upcoming.slice(0, 5).map(esc).join(' ')}</span>`;
  document.getElementById('gloss').innerHTML = html;
});

function sign(text) {
  const sentences = SB.gloss.toGloss(text);
  document.getElementById('out').textContent =
    sentences.map((s) => s.tokens.join(' ') + (s.qtype ? ' (' + s.qtype + '-question)' : '')).join('  |  ');
  sentences.forEach((s) => avatar.enqueueTokens(s.tokens, { question: s.question, qtype: s.qtype }));
}

document.getElementById('go').onclick = () => sign(document.getElementById('text').value);
document.getElementById('clear').onclick = () => avatar.clear();
document.getElementById('speed').onchange = (e) => avatar.setSpeed(parseFloat(e.target.value));

const words = document.getElementById('words');
dict.knownWords().forEach((w) => {
  const b = document.createElement('button'); b.textContent = w;
  b.onclick = () => avatar.enqueue(dict.clipFor(w)); words.appendChild(b);
});
const letters = document.getElementById('letters');
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch) => {
  const b = document.createElement('button'); b.textContent = ch;
  b.onclick = () => avatar.enqueue(dict.clipFor(ch)); letters.appendChild(b);
});

let mic = null;
const MIC_ICON = '<svg style="vertical-align:-3px" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>';
const STOP_ICON = '<svg style="vertical-align:-2px" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const micBtn = document.getElementById('mic');
micBtn.onclick = () => {
  if (mic) { mic.stop(); mic = null; micBtn.innerHTML = MIC_ICON + ' Use microphone'; return; }
  mic = SB.STT.create('webspeech', {
    onText: (t, final) => { document.getElementById('text').value = t; if (final) sign(t); },
    onError: (code) => alert('Speech error: ' + code)
  });
  mic.start(null);
  micBtn.innerHTML = STOP_ICON + ' Stop microphone';
};

setInterval(() => {
  const ms = avatar.backlogMs();
  document.getElementById('backlog').textContent = ms > 3500 ? 'catching up… (' + (ms / 1000).toFixed(1) + 's behind)' : '';
}, 300);
