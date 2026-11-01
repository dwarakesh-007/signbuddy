// Handshapes for the 2D cartoon hand.
// f      = how straight each finger is [index, middle, ring, pinky]: 1 = straight, 0 = folded
// t      = thumb: 'side' (along the hand), 'out' (sticking out), 'across' (folded over palm),
//          'up' (pointing up), 'para' (next to the index), 'touch' (tip touches a finger tip), 'peek'
// touch  = which finger the thumb touches (0 = index, 1 = middle)
// spread = how far apart the fingers are
// curve  = fingers curve toward the thumb (C, O)
// side   = show the hand from the side (G, H, O, C, flat-hand edge)
// rot    = extra rotation in degrees (90 = fingers point sideways toward the body's middle)
// These are simplified drawings, close to the real ASL letters but not perfect.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});

  const HS = {
    A: { f: [0, 0, 0, 0], t: 'side' },
    B: { f: [1, 1, 1, 1], t: 'across' },
    C: { f: [0.9, 0.9, 0.9, 0.9], t: 'out', curve: 1, side: true },
    D: { f: [1, 0.12, 0.12, 0.12], t: 'touch', touch: 1 },
    E: { f: [0.3, 0.3, 0.3, 0.3], t: 'across' },
    F: { f: [0.35, 1, 1, 1], t: 'touch', touch: 0, spread: 0.6 },
    G: { f: [1, 0, 0, 0], t: 'para', rot: 90, side: true },
    H: { f: [1, 1, 0, 0], t: 'across', rot: 90, side: true },
    I: { f: [0, 0, 0, 1], t: 'across' },
    J: { f: [0, 0, 0, 1], t: 'across' },
    K: { f: [1, 1, 0, 0], t: 'up', spread: 0.9 },
    L: { f: [1, 0, 0, 0], t: 'out' },
    M: { f: [0.15, 0.15, 0.15, 0], t: 'across' },
    N: { f: [0.15, 0.15, 0, 0], t: 'across' },
    O: { f: [0.8, 0.8, 0.8, 0.8], t: 'touch', touch: 0, curve: 1.4, side: true },
    P: { f: [1, 1, 0, 0], t: 'up', spread: 0.9, rot: 150 },
    Q: { f: [1, 0, 0, 0], t: 'para', rot: 160, side: true },
    R: { f: [1, 1, 0, 0], t: 'across', cross: true },
    S: { f: [0, 0, 0, 0], t: 'across' },
    T: { f: [0, 0, 0, 0], t: 'peek' },
    U: { f: [1, 1, 0, 0], t: 'across' },
    V: { f: [1, 1, 0, 0], t: 'across', spread: 1.4 },
    W: { f: [1, 1, 1, 0], t: 'across', spread: 1.2 },
    X: { f: [0.5, 0, 0, 0], t: 'across', hook: true },
    Y: { f: [0, 0, 0, 1], t: 'out', spread: 1.4 },
    Z: { f: [1, 0, 0, 0], t: 'across' },

    // Numbers (simplified)
    N0: { f: [0.8, 0.8, 0.8, 0.8], t: 'touch', touch: 0, curve: 1.4, side: true },
    N1: { f: [1, 0, 0, 0], t: 'across' },
    N2: { f: [1, 1, 0, 0], t: 'across', spread: 1.4 },
    N3: { f: [1, 1, 0, 0], t: 'out', spread: 1.4 },
    N4: { f: [1, 1, 1, 1], t: 'across', spread: 1.2 },
    N5: { f: [1, 1, 1, 1], t: 'out', spread: 1.3 },
    N6: { f: [1, 1, 1, 0], t: 'touch', touch: 3, spread: 1.2 },
    N7: { f: [1, 1, 0.3, 1], t: 'touch', touch: 2, spread: 1.2 },
    N8: { f: [1, 0.3, 1, 1], t: 'touch', touch: 1, spread: 1.2 },
    N9: { f: [0.35, 1, 1, 1], t: 'touch', touch: 0, spread: 0.6 },

    // Shapes used inside word signs
    B_SIDE: { f: [1, 1, 1, 1], t: 'across', side: true },
    POINT: { f: [1, 0, 0, 0], t: 'across' },
    POINT_FWD: { f: [0.45, 0, 0, 0], t: 'across' }, // index pointing at the viewer (looks short)
    ILY: { f: [1, 0, 0, 1], t: 'out', spread: 1 },
    NO_OPEN: { f: [1, 1, 0, 0], t: 'out' },
    NO_CLOSE: { f: [0.3, 0.3, 0, 0], t: 'touch', touch: 0 },
    OPEN5: { f: [1, 1, 1, 1], t: 'out', spread: 1.3 }
  };

  // Fill in defaults so every shape has every field.
  for (const k of Object.keys(HS)) {
    HS[k] = Object.assign(
      { spread: 0, curve: 0, side: false, cross: false, hook: false, rot: 0, touch: 0 },
      HS[k]
    );
  }

  SB.HANDSHAPES = HS;
})(typeof self !== 'undefined' ? self : globalThis);
