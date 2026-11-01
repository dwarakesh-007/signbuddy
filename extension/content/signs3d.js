// Handshapes and signs for the 3D character.
//
// HANDSHAPE: f = bend of [index, middle, ring, pinky]
//            a number 0..1 (0 = straight, 1 = fist), or [knuckle, middle joint, tip joint] in degrees.
//            sp = spread between fingers (degrees), t = thumb (name from THUMBS3D, or 5 numbers).
// THUMB:     [ab, op, roll, mcp, ip]  ab = swing out to the side, op = swing to the front of the palm,
//            roll = twist, mcp/ip = bend of the two thumb knuckles (all degrees).
// SIGN FRAME: { R: hand, L: hand, d: move time ms, hold: pause ms }
//   hand = { p: [x,y,z] palm centre, f: [x,y,z] direction the fingers point,
//            n: [x,y,z] direction the palm faces, hs: handshape name }
//   World: +x = the character's LEFT (your right on screen), +y = up, +z = toward you.
//   R = the character's right (dominant) hand.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});

  const THUMBS3D = {
    rest:   [38, 26, 0, 12, 12],
    side:   [6, 14, 0, 0, 2],        // A: along the side of the index
    para:   [4, 26, 0, 0, 0],        // G: straight, next to the index
    across: [-52, 18, 0, 8, 8],      // B: folded across the palm
    fist:   [-46, 44, 10, 26, 16],   // S: across the front of the curled fingers
    out:    [84, 4, 0, 0, 0],        // L, Y, 5: sticking out
    up:     [6, 46, 0, 8, 0],        // K, P: between index and middle
    tuck:   [-6, 48, 0, 34, 14],     // T: under the index
    m:      [-44, 34, 0, 18, 6],     // M: under three fingers
    n:      [-28, 36, 0, 20, 6],     // N: under two fingers
    e:      [-60, 26, 0, 30, 34],    // E: tucked low across the palm
    c:      [48, 30, -15, 22, 28],   // C: curved, opposite the fingers
    o:      [12, 46, -25, 22, 28],   // O: tip meets the index tip
    f:      [12, 52, -30, 20, 24],   // F: tip meets the index
    d:      [6, 62, -30, 26, 30],    // D: tip meets the middle finger
    w:      [-40, 40, 0, 32, 24],    // W, 6: holds the pinky
    seven:  [-24, 48, 0, 30, 26],    // 7: meets the ring finger
    eight:  [-8, 56, -10, 26, 28],   // 8: meets the middle finger
    no:     [16, 50, -20, 14, 14]    // NO: meets index + middle
  };

  const C_CURVE = [38, 42, 26];
  const H = {
    A: { f: [1, 1, 1, 1], t: 'side' },
    B: { f: [0, 0, 0, 0], sp: 1, t: 'across' },
    C: { f: [C_CURVE, C_CURVE, C_CURVE, C_CURVE], sp: 1, t: 'c' },
    D: { f: [0, [40, 70, 45], [44, 72, 45], [48, 72, 45]], t: 'd' },
    E: { f: [[40, 110, 80], [40, 110, 80], [40, 110, 80], [44, 110, 80]], sp: 0, t: 'e' },
    F: { f: [[48, 62, 40], 0, 0, 0], sp: 7, t: 'f' },
    G: { f: [0, 1, 1, 1], t: 'para' },
    H: { f: [0, 0, 1, 1], sp: 0, t: 'fist' },
    I: { f: [1, 1, 1, 0], t: 'fist' },
    J: { f: [1, 1, 1, 0], t: 'fist' },
    K: { f: [0, [8, 0, 0], 1, 1], sp: 10, t: 'up' },
    L: { f: [0, 1, 1, 1], t: 'out' },
    M: { f: [[78, 88, 36], [78, 88, 36], [78, 88, 36], 1], sp: 0, t: 'm' },
    N: { f: [[78, 88, 36], [78, 88, 36], 1, 1], sp: 0, t: 'n' },
    O: { f: [[60, 80, 55], [62, 80, 55], [64, 80, 55], [66, 80, 55]], sp: 0, t: 'o' },
    P: { f: [0, [30, 0, 0], 1, 1], sp: 10, t: 'up' },
    Q: { f: [0, 1, 1, 1], t: 'para' },
    R: { f: [0, 0, 1, 1], sp: [9, -9, 0, 0], t: 'fist' },
    S: { f: [1, 1, 1, 1], t: 'fist' },
    T: { f: [[62, 96, 40], 1, 1, 1], t: 'tuck' },
    U: { f: [0, 0, 1, 1], sp: 0, t: 'fist' },
    V: { f: [0, 0, 1, 1], sp: 12, t: 'fist' },
    W: { f: [0, 0, 0, 1], sp: 9, t: 'w' },
    X: { f: [[20, 92, 55], 1, 1, 1], t: 'fist' },
    Y: { f: [1, 1, 1, 0], sp: [0, 0, 0, 16], t: 'out' },
    Z: { f: [0, 1, 1, 1], t: 'fist' },

    N0: { f: [[44, 62, 44], [46, 64, 44], [48, 66, 44], [50, 66, 44]], sp: 0, t: 'o' },
    N1: { f: [0, 1, 1, 1], t: 'fist' },
    N2: { f: [0, 0, 1, 1], sp: 12, t: 'fist' },
    N3: { f: [0, 0, 1, 1], sp: 12, t: 'out' },
    N4: { f: [0, 0, 0, 0], sp: 8, t: 'across' },
    N5: { f: [0, 0, 0, 0], sp: 11, t: 'out' },
    N6: { f: [0, 0, 0, [55, 70, 40]], sp: 8, t: 'w' },
    N7: { f: [0, 0, [55, 70, 40], 0], sp: 8, t: 'seven' },
    N8: { f: [0, [55, 70, 40], 0, 0], sp: 8, t: 'eight' },
    N9: { f: [[48, 62, 40], 0, 0, 0], sp: 7, t: 'f' },

    POINT: { f: [0, 1, 1, 1], t: 'fist' },
    ILY: { f: [0, 1, 1, 0], sp: [-6, 0, 0, 14], t: 'out' },
    NO_OPEN: { f: [0, 0, 1, 1], sp: 2, t: 'out' },
    NO_CLOSE: { f: [[42, 52, 30], [44, 52, 30], 1, 1], sp: 0, t: 'no' },
    OPEN5: { f: [0.05, 0.05, 0.05, 0.05], sp: 11, t: 'out' },
    RELAX: { f: [[18, 22, 10], [22, 26, 12], [26, 30, 14], [30, 32, 16]], sp: 3, t: 'rest' }
  };

  // ----- places on the body -----
  const FS = [-0.125, 1.37, 0.30];                 // fingerspelling spot, in front of the right shoulder
  const UPF = [0.06, 1, 0.05], FWD = [0.12, 0, 1]; // fingers up, palm toward the viewer
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  const REST = {
    R: { p: [-0.07, 1.035, 0.19], f: [0.8, -0.15, 0.55], n: [0.25, 0.9, -0.2], hs: 'RELAX' },
    L: { p: [0.07, 1.02, 0.18], f: [-0.8, -0.15, 0.55], n: [-0.25, 0.9, -0.2], hs: 'RELAX' }
  };

  // Hand direction per letter (most letters: fingers up, palm toward the viewer).
  const LETTER_DIR = {
    C: { f: [0.1, 1, 0.15], n: [1, 0, 0.55] },
    O: { f: [0.1, 1, 0.15], n: [1, 0, 0.55] },
    G: { f: [1, 0.1, 0.05], n: [0, 0, -1] },
    H: { f: [1, 0.1, 0.05], n: [0, 0, -1] },
    P: { f: [0.15, -0.45, 0.88], n: [0.25, -0.85, -0.45] },
    Q: { f: [0.1, -1, 0.3], n: [0, -0.3, -1] },
    N0: { f: [0.1, 1, 0.15], n: [1, 0, 0.3] }
  };

  function circle(center, r, hand, steps, d) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      out.push({ R: { ...hand, p: [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r, center[2]] }, d, hold: 0 });
    }
    return out;
  }

  const B_PALM_UP_L = { p: [0.05, 1.16, 0.30], f: [-0.6, 0, 0.8], n: [0, 1, 0], hs: 'B' };

  const SIGNS = {
    // Flat hand at the forehead, moves out like a salute.
    HELLO: [
      { R: { p: [-0.1, 1.64, 0.15], f: [0.2, 1, 0.05], n: [0.3, 0, 1], hs: 'B' }, d: 280, hold: 80 },
      { R: { p: [-0.22, 1.6, 0.3], f: [-0.15, 1, 0.1], n: [0.1, 0, 1], hs: 'B' }, d: 380, hold: 140 }
    ],
    // Fingertips at the chin, hand moves forward and down, palm up.
    'THANK-YOU': [
      { R: { p: [-0.025, 1.36, 0.175], f: [0.05, 1, -0.18], n: [0, 0.18, -1], hs: 'B' }, d: 280, hold: 110 },
      { R: { p: [-0.08, 1.27, 0.36], f: [-0.35, 0.35, 0.87], n: [0, 1, -0.4], hs: 'B' }, d: 400, hold: 160 }
    ],
    // Flat hand rubs a circle on the chest.
    PLEASE: [
      { R: { p: [-0.015, 1.325, 0.138], f: [0.5, 0.85, 0], n: [0, 0, -1], hs: 'B' }, d: 260, hold: 0 },
      ...circle([-0.015, 1.29, 0.138], 0.035, { f: [0.5, 0.85, 0], n: [0, 0, -1], hs: 'B' }, 8, 80),
      ...circle([-0.015, 1.29, 0.138], 0.035, { f: [0.5, 0.85, 0], n: [0, 0, -1], hs: 'B' }, 8, 80).slice(1)
    ],
    // Left palm up; right hand edge chops down onto it.
    STOP: [
      { L: B_PALM_UP_L, R: { p: [-0.02, 1.38, 0.33], f: [0.5, 0.1, 0.85], n: [0.85, 0, -0.5], hs: 'B' }, d: 300, hold: 80 },
      { L: B_PALM_UP_L, R: { p: [0.02, 1.235, 0.31], f: [0.5, 0, 0.85], n: [0.85, 0, -0.5], hs: 'B' }, d: 170, hold: 340 }
    ],
    // Right fist (thumb up) sits on the left palm; both lift up.
    HELP: [
      { L: { ...B_PALM_UP_L, p: [0.03, 1.15, 0.29] }, R: { p: [0.015, 1.215, 0.29], f: [0.1, 0, 1], n: [1, 0, -0.1], hs: 'A' }, d: 300, hold: 80 },
      { L: { ...B_PALM_UP_L, p: [0.03, 1.26, 0.30] }, R: { p: [0.015, 1.325, 0.30], f: [0.1, 0, 1], n: [1, 0, -0.1], hs: 'A' }, d: 380, hold: 160 }
    ],
    // Fist nods like a head saying yes.
    YES: [
      { R: { p: FS, f: [0, 1, 0.15], n: FWD, hs: 'S' }, d: 220, hold: 0 },
      { R: { p: add(FS, [0, -0.02, 0.02]), f: [0, 0.55, 1], n: [0.1, -0.9, 0.5], hs: 'S' }, d: 150, hold: 0 },
      { R: { p: FS, f: [0, 1, 0.15], n: FWD, hs: 'S' }, d: 150, hold: 0 },
      { R: { p: add(FS, [0, -0.02, 0.02]), f: [0, 0.55, 1], n: [0.1, -0.9, 0.5], hs: 'S' }, d: 150, hold: 0 },
      { R: { p: FS, f: [0, 1, 0.15], n: FWD, hs: 'S' }, d: 150, hold: 120 }
    ],
    // Index + middle snap shut onto the thumb, twice.
    NO: [
      { R: { p: FS, f: [0.1, 0.85, 0.5], n: [0.1, -0.35, 1], hs: 'NO_OPEN' }, d: 220, hold: 60 },
      { R: { p: FS, f: [0.1, 0.85, 0.5], n: [0.1, -0.35, 1], hs: 'NO_CLOSE' }, d: 140, hold: 60 },
      { R: { p: FS, f: [0.1, 0.85, 0.5], n: [0.1, -0.35, 1], hs: 'NO_OPEN' }, d: 140, hold: 40 },
      { R: { p: FS, f: [0.1, 0.85, 0.5], n: [0.1, -0.35, 1], hs: 'NO_CLOSE' }, d: 140, hold: 140 }
    ],
    'I-LOVE-YOU': [
      { R: { p: add(FS, [0, 0.01, 0.02]), f: UPF, n: FWD, hs: 'ILY' }, d: 260, hold: 120 },
      { R: { p: add(FS, [0, 0.01, 0.02]), f: [-0.12, 1, 0.05], n: FWD, hs: 'ILY' }, d: 200, hold: 0 },
      { R: { p: add(FS, [0, 0.01, 0.02]), f: [0.2, 1, 0.05], n: FWD, hs: 'ILY' }, d: 200, hold: 0 },
      { R: { p: add(FS, [0, 0.01, 0.02]), f: UPF, n: FWD, hs: 'ILY' }, d: 160, hold: 300 }
    ],
    // Point to yourself.
    ME: [
      { R: { p: [-0.035, 1.31, 0.245], f: [0.15, -0.1, -1], n: [-1, 0, 0.1], hs: 'POINT', elbow: [-1, -0.6, 0] }, d: 260, hold: 280 }
    ],
    // Point at the person you are talking to.
    YOU: [
      { R: { p: [-0.09, 1.35, 0.33], f: [0.15, 0.65, 1], n: [0, -1, 0.65], hs: 'POINT' }, d: 220, hold: 0 },
      { R: { p: [-0.08, 1.36, 0.42], f: [0.15, 0.6, 1], n: [0, -1, 0.6], hs: 'POINT' }, d: 200, hold: 280 }
    ],

    // ---- extra common signs ----
    // Flat hand on your chest.
    MY: [
      { R: { p: [-0.015, 1.33, 0.16], f: [0.35, 0.95, 0], n: [0, 0, -1], hs: 'B' }, d: 240, hold: 0 },
      { R: { p: [-0.015, 1.33, 0.136], f: [0.35, 0.95, 0], n: [0, 0, -1], hs: 'B' }, d: 140, hold: 260 }
    ],
    // Flat palm pushed toward the other person.
    YOUR: [
      { R: { p: [-0.08, 1.32, 0.30], f: [0.1, 1, 0], n: [0, 0.1, 1], hs: 'B' }, d: 220, hold: 0 },
      { R: { p: [-0.07, 1.33, 0.40], f: [0.1, 1, 0], n: [0, 0.1, 1], hs: 'B' }, d: 200, hold: 260 }
    ],
    // Two H hands, the right one taps on the left one twice.
    NAME: [
      { L: { p: [0.05, 1.25, 0.30], f: [-1, 0, 0.25], n: [0, 0, -1], hs: 'H' }, R: { p: [-0.02, 1.31, 0.32], f: [0.45, 0, 1], n: [1, 0, -0.45], hs: 'H' }, d: 260, hold: 0 },
      { R: { p: [-0.01, 1.275, 0.32], f: [0.45, 0, 1], n: [1, 0, -0.45], hs: 'H' }, d: 130, hold: 40 },
      { R: { p: [-0.02, 1.31, 0.32], f: [0.45, 0, 1], n: [1, 0, -0.45], hs: 'H' }, d: 120, hold: 0 },
      { R: { p: [-0.01, 1.275, 0.32], f: [0.45, 0, 1], n: [1, 0, -0.45], hs: 'H' }, d: 130, hold: 200 }
    ],
    // Both open hands, palms up, shake a little.
    WHAT: [
      { R: { p: [-0.13, 1.19, 0.30], f: [-0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, L: { p: [0.13, 1.19, 0.30], f: [0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, d: 280, hold: 0 },
      { R: { p: [-0.15, 1.19, 0.30], f: [-0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, L: { p: [0.15, 1.19, 0.30], f: [0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, d: 130, hold: 0 },
      { R: { p: [-0.12, 1.19, 0.30], f: [-0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, L: { p: [0.12, 1.19, 0.30], f: [0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, d: 130, hold: 0 },
      { R: { p: [-0.15, 1.19, 0.30], f: [-0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, L: { p: [0.15, 1.19, 0.30], f: [0.3, 0.15, 1], n: [0, 1, -0.1], hs: 'OPEN5' }, d: 130, hold: 220 }
    ],
    // Index finger up, wags side to side.
    WHERE: [
      { R: { p: FS, f: [0.25, 1, 0.05], n: FWD, hs: 'POINT' }, d: 240, hold: 0 },
      { R: { p: FS, f: [-0.25, 1, 0.05], n: FWD, hs: 'POINT' }, d: 140, hold: 0 },
      { R: { p: FS, f: [0.25, 1, 0.05], n: FWD, hs: 'POINT' }, d: 140, hold: 0 },
      { R: { p: FS, f: [-0.25, 1, 0.05], n: FWD, hs: 'POINT' }, d: 140, hold: 200 }
    ],
    // Thumb under the chin, flicks forward.
    NOT: [
      { R: { p: [-0.01, 1.475, 0.14], f: [0, 1, 0.1], n: [1, 0, 0], hs: 'A' }, d: 260, hold: 80 },
      { R: { p: [-0.03, 1.43, 0.30], f: [0, 0.8, 0.6], n: [1, 0, 0], hs: 'A' }, d: 220, hold: 200 }
    ],
    // Fingertips tap the side of the forehead.
    KNOW: [
      { R: { p: [-0.085, 1.615, 0.175], f: [0.25, 0.85, -0.45], n: [0.2, 0.4, -0.9], hs: 'B' }, d: 260, hold: 0 },
      { R: { p: [-0.09, 1.61, 0.195], f: [0.25, 0.85, -0.45], n: [0.2, 0.4, -0.9], hs: 'B' }, d: 120, hold: 0 },
      { R: { p: [-0.085, 1.615, 0.175], f: [0.25, 0.85, -0.45], n: [0.2, 0.4, -0.9], hs: 'B' }, d: 120, hold: 220 }
    ],
    // Fist rubs a circle on the chest.
    SORRY: [
      { R: { p: [-0.015, 1.325, 0.15], f: [0.3, 1, 0], n: [0, 0, -1], hs: 'S' }, d: 260, hold: 0 },
      ...circle([-0.015, 1.29, 0.15], 0.035, { f: [0.3, 1, 0], n: [0, 0, -1], hs: 'S' }, 8, 80),
      ...circle([-0.015, 1.29, 0.15], 0.035, { f: [0.3, 1, 0], n: [0, 0, -1], hs: 'S' }, 8, 80).slice(1)
    ],
    // Open hand, thumb taps the chest.
    FINE: [
      { R: { p: [-0.05, 1.33, 0.235], f: [0, 1, 0.1], n: [1, 0, 0.6], hs: 'OPEN5' }, d: 240, hold: 0 },
      { R: { p: [-0.05, 1.33, 0.212], f: [0, 1, 0.1], n: [1, 0, 0.6], hs: 'OPEN5' }, d: 120, hold: 0 },
      { R: { p: [-0.05, 1.33, 0.235], f: [0, 1, 0.1], n: [1, 0, 0.6], hs: 'OPEN5' }, d: 120, hold: 0 },
      { R: { p: [-0.05, 1.33, 0.212], f: [0, 1, 0.1], n: [1, 0, 0.6], hs: 'OPEN5' }, d: 120, hold: 200 }
    ]
  };

  // Words that shake the head (negation is shown on the face in ASL too).
  const NEGATIVE = new Set(['NOT', 'NO', 'NEVER', 'NONE', 'NOTHING', 'CANNOT', 'NOBODY']);

  function spell(word) {
    const frames = [];
    const letters = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fast = letters.length > 6 ? 0.8 : 1;
    let prev = null;
    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i];
      const hs = /[0-9]/.test(ch) ? 'N' + ch : ch;
      if (!H[hs]) continue;
      const dir = LETTER_DIR[hs] || { f: UPF, n: FWD };
      const p = ch === prev ? add(FS, [-0.035, 0, 0]) : FS; // double letters slide outward
      const base = { p, f: dir.f, n: dir.n, hs };
      if (ch === 'J') {
        frames.push({ R: base, d: 110, hold: 60, letter: ch, li: i });
        frames.push({ R: { ...base, p: add(p, [0, -0.045, 0]), n: [0.7, 0, 0.7] }, d: 150, hold: 0, letter: ch, li: i });
        frames.push({ R: { ...base, p: add(p, [0.03, -0.05, -0.01]), f: [0.3, 0.95, 0], n: [0.2, 0, -1] }, d: 150, hold: 120 * fast, letter: ch, li: i });
      } else if (ch === 'Z') {
        const zf = { f: [0.1, 0.75, 0.65], n: [0.1, -0.65, 0.75] };
        [[0.03, 0.03], [-0.03, 0.03], [0.03, -0.03], [-0.03, -0.03]].forEach(([dx, dy], k) =>
          frames.push({ R: { ...base, ...zf, p: add(p, [dx, dy, 0]) }, d: k ? 120 : 110, hold: k === 3 ? 120 * fast : 0, letter: ch, li: i }));
      } else {
        frames.push({ R: base, d: 120, hold: 250 * fast, letter: ch, li: i });
      }
      prev = ch;
    }
    return { frames, letters };
  }

  // qtype: 'yn' (eyebrows up), 'wh' (eyebrows down) or null
  function clipFor(token, qtype) {
    const key = String(token).toUpperCase();
    let clip;
    if (SIGNS[key]) {
      clip = { label: key, spelled: false, frames: SIGNS[key].map((f) => ({ ...f })) };
    } else {
      const { frames, letters } = spell(key);
      if (!frames.length) return null;
      clip = { label: key, spelled: true, letters, frames };
    }
    clip.qtype = qtype === true ? 'yn' : qtype || null;
    clip.neg = NEGATIVE.has(key);
    const last = clip.frames[clip.frames.length - 1];
    clip.frames[clip.frames.length - 1] = { ...last, hold: (last.hold || 0) + 120 };
    return clip;
  }

  SB.HANDSHAPES3D = H;
  SB.THUMBS3D = THUMBS3D;
  SB.signs3d = {
    SIGNS, REST, FS, LETTER_DIR,
    isKnown: (t) => !!SIGNS[String(t).toUpperCase()],
    knownWords: () => Object.keys(SIGNS),
    clipFor, spell
  };
})(typeof self !== 'undefined' ? self : globalThis);
