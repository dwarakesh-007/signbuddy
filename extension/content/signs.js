// The sign dictionary: each known word is a short list of key poses ("frames").
// A frame says where each hand goes (x, y on a 240 x 260 drawing), its rotation,
// handshape, and z (bigger = closer to the viewer). d = move time (ms), hold = pause (ms).
// R = the character's right (dominant) hand, L = left hand. A hand that isn't mentioned rests.
// Unknown words are fingerspelled letter by letter.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});

  const FS = { x: 66, y: 134 }; // where the hand fingerspells (in front of the right shoulder)

  function circle(cx, cy, r, shape, rot, steps, d) {
    const frames = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      frames.push({ R: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot, shape }, d, hold: 0 });
    }
    return frames;
  }

  const SIGNS = {
    // Flat hand at the forehead, moves out like a salute.
    HELLO: [
      { R: { x: 90, y: 80, rot: 22, shape: 'B' }, d: 260, hold: 90 },
      { R: { x: 54, y: 92, rot: -18, shape: 'B' }, d: 380, hold: 140 }
    ],
    // Fingertips at the chin, hand moves forward and down.
    'THANK-YOU': [
      { R: { x: 112, y: 172, rot: 0, shape: 'B' }, d: 280, hold: 120 },
      { R: { x: 100, y: 200, rot: 28, shape: 'B', z: 1.3 }, d: 380, hold: 160 }
    ],
    // Flat hand rubs a circle on the chest.
    PLEASE: [
      { R: { x: 112, y: 214, rot: 0, shape: 'B' }, d: 260, hold: 0 },
      ...circle(110, 212, 11, 'B', 0, 8, 85),
      ...circle(110, 212, 11, 'B', 0, 8, 85).slice(1),
      { R: { x: 112, y: 214, rot: 0, shape: 'B' }, d: 100, hold: 120 }
    ],
    // Left palm up; right hand edge chops down onto it.
    STOP: [
      { L: { x: 170, y: 214, rot: 90, shape: 'B' }, R: { x: 92, y: 148, rot: 90, shape: 'B_SIDE' }, d: 300, hold: 80 },
      { L: { x: 170, y: 214, rot: 90, shape: 'B' }, R: { x: 98, y: 198, rot: 90, shape: 'B_SIDE' }, d: 170, hold: 320 }
    ],
    // Right fist sits on the left palm; both lift up.
    HELP: [
      { L: { x: 168, y: 224, rot: 90, shape: 'B' }, R: { x: 122, y: 204, rot: 0, shape: 'A' }, d: 300, hold: 80 },
      { L: { x: 168, y: 190, rot: 90, shape: 'B' }, R: { x: 122, y: 170, rot: 0, shape: 'A' }, d: 380, hold: 160 }
    ],
    // Fist nods like a head saying yes.
    YES: [
      { R: { ...FS, rot: 0, shape: 'S' }, d: 220, hold: 0 },
      { R: { ...FS, y: FS.y + 8, rot: 35, shape: 'S' }, d: 150, hold: 0 },
      { R: { ...FS, rot: 0, shape: 'S' }, d: 150, hold: 0 },
      { R: { ...FS, y: FS.y + 8, rot: 35, shape: 'S' }, d: 150, hold: 0 },
      { R: { ...FS, rot: 0, shape: 'S' }, d: 150, hold: 120 }
    ],
    // Index + middle fingers snap shut onto the thumb, twice.
    NO: [
      { R: { ...FS, rot: 0, shape: 'NO_OPEN' }, d: 220, hold: 60 },
      { R: { ...FS, rot: 0, shape: 'NO_CLOSE' }, d: 140, hold: 60 },
      { R: { ...FS, rot: 0, shape: 'NO_OPEN' }, d: 140, hold: 40 },
      { R: { ...FS, rot: 0, shape: 'NO_CLOSE' }, d: 140, hold: 140 }
    ],
    // Thumb, index and pinky up, palm facing out.
    'I-LOVE-YOU': [
      { R: { ...FS, y: FS.y - 4, rot: 0, shape: 'ILY' }, d: 260, hold: 120 },
      { R: { ...FS, y: FS.y - 4, rot: 8, shape: 'ILY' }, d: 200, hold: 0 },
      { R: { ...FS, y: FS.y - 4, rot: -6, shape: 'ILY' }, d: 200, hold: 0 },
      { R: { ...FS, y: FS.y - 4, rot: 0, shape: 'ILY' }, d: 160, hold: 300 }
    ],
    // Point to yourself.
    ME: [
      { R: { x: 98, y: 168, rot: 150, shape: 'POINT' }, d: 260, hold: 280 }
    ],
    // Point at the person you're talking to.
    YOU: [
      { R: { x: 94, y: 182, rot: 12, shape: 'POINT', z: 1 }, d: 220, hold: 0 },
      { R: { x: 98, y: 176, rot: 8, shape: 'POINT_FWD', z: 1.45 }, d: 200, hold: 300 }
    ]
  };

  function shapeForChar(ch) {
    return /[0-9]/.test(ch) ? 'N' + ch : ch;
  }

  // Build fingerspelling frames for a word.
  function spell(word) {
    const frames = [];
    const letters = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fast = letters.length > 6 ? 0.8 : 1; // long words go a bit quicker
    let prev = null;
    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i];
      const name = shapeForChar(ch);
      const hs = SB.HANDSHAPES[name];
      if (!hs) continue;
      const x = FS.x + (ch === prev ? 10 : 0); // double letters slide sideways
      const base = { x, y: FS.y, rot: hs.rot, shape: name };
      if (ch === 'J') {
        frames.push({ R: base, d: 110, hold: 60, letter: ch, li: i });
        frames.push({ R: { ...base, x: x + 6, y: FS.y + 14, rot: 60 }, d: 150, hold: 0, letter: ch, li: i });
        frames.push({ R: { ...base, x: x + 16, y: FS.y + 8, rot: 110 }, d: 150, hold: 120 * fast, letter: ch, li: i });
      } else if (ch === 'Z') {
        const pts = [[-8, -10], [8, -10], [-8, 6], [8, 6]];
        pts.forEach(([dx, dy], k) =>
          frames.push({ R: { ...base, x: x + dx, y: FS.y + dy }, d: k ? 120 : 110, hold: k === 3 ? 120 * fast : 0, letter: ch, li: i }));
      } else {
        frames.push({ R: base, d: 110, hold: 260 * fast, letter: ch, li: i });
      }
      prev = ch;
    }
    return { frames, letters };
  }

  // Turn one gloss token into a clip the avatar can play.
  function clipFor(token, question) {
    const key = String(token).toUpperCase();
    let clip;
    if (SIGNS[key]) {
      clip = { label: key, spelled: false, frames: SIGNS[key].map((f) => ({ ...f })), question: !!question };
    } else {
      const { frames, letters } = spell(key);
      if (!frames.length) return null;
      clip = { label: key, spelled: true, letters, frames, question: !!question };
    }
    // small pause after each word
    const last = clip.frames[clip.frames.length - 1];
    clip.frames[clip.frames.length - 1] = { ...last, hold: (last.hold || 0) + 120 };
    return clip;
  }

  SB.signs = {
    SIGNS,
    FS,
    isKnown: (t) => !!SIGNS[String(t).toUpperCase()],
    knownWords: () => Object.keys(SIGNS),
    clipFor,
    spell
  };
})(typeof self !== 'undefined' ? self : globalThis);
