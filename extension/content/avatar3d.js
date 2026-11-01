// SignBuddy 3D character, built with three.js (bundled in lib/, works offline).
//
// How it is put together:
//   - The body, head and face are simple smooth 3D shapes (no model file to download).
//   - Each arm has a shoulder, elbow and wrist. We tell it where the HAND should be and
//     "inverse kinematics" (IK) works out where the elbow goes.
//   - Each hand has 5 fingers with 3 joints each, so real ASL handshapes are possible.
//   - The face has eyebrows (up for yes/no questions, down for WH-questions),
//     blinking eyes, a moving mouth and a head that can nod or shake.
//
// It has the same functions as the 2D character (enqueue, backlogMs, trimTo, ...),
// so the overlay can use either one.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});
  const T = root.THREE;
  if (!T) return;

  const DEG = Math.PI / 180;
  const ASPECT = 260 / 240; // height / width of the card

  const COL = {
    skin: 0xc68a64, shirt: 0x1e2945, shirtDark: 0x161f36, hair: 0x1a110b,
    lips: 0xa0525a, nail: 0xe9c0aa, eyeWhite: 0xf7f4ef, iris: 0x4b2c18, pupil: 0x0d0907, mouth: 0x4f1b21
  };

  // ---------- body measurements (metres) ----------
  const SHOULDER = { R: new T.Vector3(-0.185, 1.405, 0.0), L: new T.Vector3(0.185, 1.405, 0.0) };
  const UPPER = 0.28, FORE = 0.25;
  const HAND_SCALE = 1.15;              // hands slightly bigger than real, easier to read
  const PALM_CENTER = 0.048;            // wrist -> palm centre (before scaling)
  const POLE = { R: new T.Vector3(-0.55, -1, -0.45), L: new T.Vector3(0.55, -1, -0.45) };
  const HEAD_POS = new T.Vector3(0, 1.625, 0.012);

  // Finger layout for a RIGHT hand. Local axes: +Y = fingers, +Z = palm side, +X = thumb side.
  const FINGER = [
    { x: 0.0265, y: 0.000, L: [0.043, 0.025, 0.020], r: 0.0098, k: 1.0 },  // index
    { x: 0.0085, y: 0.004, L: [0.047, 0.029, 0.021], r: 0.0101, k: 0.2 },  // middle
    { x: -0.0095, y: 0.001, L: [0.044, 0.027, 0.020], r: 0.0096, k: -0.5 }, // ring
    { x: -0.0265, y: -0.007, L: [0.035, 0.021, 0.018], r: 0.0086, k: -1.0 } // pinky
  ];
  const PALM_TOP = 0.088;
  const THUMB = { base: new T.Vector3(0.027, 0.016, 0.007), L: [0.038, 0.030, 0.023], r: [0.0135, 0.0117, 0.0106] };

  // ---------- geometry helpers ----------
  // A capsule that can be thicker at one end. Starts at y=0, ends at y=len.
  function taper(r1, r2, len, radial = 18, cap = 6) {
    const pts = [];
    for (let i = 0; i <= cap; i++) {
      const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2);
      pts.push(new T.Vector2(Math.max(1e-4, r1 * Math.cos(a)), r1 * Math.sin(a)));
    }
    for (let i = 0; i <= cap; i++) {
      const a = (i / cap) * (Math.PI / 2);
      pts.push(new T.Vector2(Math.max(1e-4, r2 * Math.cos(a)), len + r2 * Math.sin(a)));
    }
    return new T.LatheGeometry(pts, radial);
  }

  // A box with rounded edges (used for the palm).
  function roundedBox(w, h, d, r, seg = 5) {
    const g = new T.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
    const p = g.attributes.position, n = g.attributes.normal;
    const v = new T.Vector3(), c = new T.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      v.sub(c).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      v.multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }

  const SPHERE = new T.SphereGeometry(1, 32, 24);

  // Head: a sphere pushed into a face shape (rounder top, narrower jaw, chin forward).
  function headGeometry() {
    const g = new T.SphereGeometry(1, 64, 48);
    const p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const low = Math.max(0, -v.y);           // 0 at the middle, 1 at the chin
      v.x *= 1 - 0.3 * low * low;               // narrower jaw
      v.z *= 1 - 0.12 * low * low;
      if (v.z > 0) v.z *= 1 + 0.1 * low;        // chin a little forward
      if (v.y < 0) v.y *= 1.08;                 // longer lower face
      p.setXYZ(i, v.x * 0.098, v.y * 0.112 + 0.002, v.z * 0.104);
    }
    g.computeVertexNormals();
    return g;
  }

  function mesh(geo, mat, shadow = true) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  }
  function blob(mat, r, pos, scale, shadow) {
    const m = mesh(SPHERE, mat, shadow);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(r * (scale ? scale[0] : 1), r * (scale ? scale[1] : 1), r * (scale ? scale[2] : 1));
    return m;
  }

  // ---------- handshapes ----------
  // A handshape is turned into 21 numbers:
  //   [mcp,pip,dip] x 4 fingers (degrees of bend), spread x 4, thumb [ab, op, roll, mcp, ip]
  function resolveShape(name) {
    const lib = SB.HANDSHAPES3D || {};
    const def = typeof name === 'string' ? lib[name] || lib.B : name;
    const thumbs = SB.THUMBS3D || {};
    const out = new Float32Array(21);
    for (let i = 0; i < 4; i++) {
      const c = def.f[i];
      const a = Array.isArray(c) ? c : [85 * c, 100 * c, 70 * c];
      out[i * 3] = a[0]; out[i * 3 + 1] = a[1]; out[i * 3 + 2] = a[2];
    }
    const sp = def.sp == null ? 3 : def.sp;
    for (let i = 0; i < 4; i++) out[12 + i] = Array.isArray(sp) ? sp[i] : -sp * FINGER[i].k;
    const t = typeof def.t === 'string' ? thumbs[def.t] : def.t || thumbs.rest;
    for (let i = 0; i < 5; i++) out[16 + i] = t[i];
    return out;
  }

  // ---------- the character ----------
  function buildCharacter(mats) {
    const root3 = new T.Group();

    // Torso: a smooth "lathe" shape, squashed front-to-back.
    const prof = [[0.0, 0.78], [0.15, 0.78], [0.152, 1.0], [0.157, 1.18], [0.164, 1.3], [0.166, 1.365],
      [0.158, 1.405], [0.13, 1.44], [0.07, 1.46], [0.0, 1.464]].map(([r, y]) => new T.Vector2(Math.max(1e-4, r), y));
    const torso = mesh(new T.LatheGeometry(prof, 40), mats.shirt);
    torso.scale.set(1.36, 1, 0.64);
    root3.add(torso);
    const collar = mesh(new T.TorusGeometry(0.047, 0.011, 12, 32), mats.shirtDark);
    collar.rotation.x = Math.PI / 2 - 0.25;
    collar.position.set(0, 1.452, 0.008);
    root3.add(collar);
    for (const s of ['R', 'L']) root3.add(blob(mats.shirt, 0.051, [SHOULDER[s].x, SHOULDER[s].y - 0.008, 0], [1.05, 0.9, 1]));

    const neck = mesh(taper(0.041, 0.039, 0.12), mats.skin);
    neck.position.set(0, 1.42, 0.0);
    root3.add(neck);

    // Head
    const head = new T.Group();
    head.position.copy(HEAD_POS);
    head.scale.setScalar(1.14); // slightly big head: easier to read the face
    root3.add(head);
    head.add(mesh(headGeometry(), mats.skin));
    for (const sx of [-1, 1]) {
      head.add(blob(mats.skin, 0.027, [sx * 0.098, -0.002, -0.006], [0.42, 1, 0.72]));
    }
    head.add(blob(mats.skin, 0.0125, [0, -0.02, 0.1035], [0.85, 0.85, 0.85])); // nose tip
    head.add(blob(mats.skin, 0.0085, [0, -0.004, 0.1], [0.75, 1.9, 0.75]));     // nose bridge
    for (const sx of [-1, 1]) head.add(blob(mats.skin, 0.0075, [sx * 0.0105, -0.023, 0.098], [1, 0.8, 0.8]));

    // Hair: top cap + fringe
    const capGeo = new T.SphereGeometry(0.1135, 48, 24, 0, Math.PI * 2, 0, 1.32);
    const cap = mesh(capGeo, mats.hair);
    cap.scale.set(0.96, 1.05, 1.0);
    cap.rotation.x = -0.32;
    cap.position.set(0, 0.012, -0.008);
    head.add(cap);
    head.add(blob(mats.hair, 0.105, [0, -0.005, -0.03], [0.95, 0.98, 0.9]));
    const fringe = [
      [-0.035, 0.083, 0.06, 0.05, [1.25, 0.42, 0.75], 0.35],
      [0.02, 0.088, 0.06, 0.048, [1.3, 0.4, 0.75], -0.1],
      [0.06, 0.07, 0.045, 0.04, [1.0, 0.45, 0.8], -0.55],
      [-0.07, 0.06, 0.04, 0.038, [0.8, 0.6, 0.8], 0.7]
    ];
    for (const [x, y, z, r, sc, rz] of fringe) {
      const f = blob(mats.hair, r, [x, y, z], sc);
      f.rotation.z = rz;
      head.add(f);
    }

    // Eyes
    const eyes = [];
    const irisGeo = new T.SphereGeometry(0.0168, 24, 8, 0, Math.PI * 2, 0, 0.62);
    const pupilGeo = new T.SphereGeometry(0.0169, 24, 6, 0, Math.PI * 2, 0, 0.3);
    for (const sx of [-1, 1]) {
      const eye = new T.Group();
      eye.position.set(sx * 0.036, 0.008, 0.083);
      eye.add(blob(mats.eyeWhite, 0.0165, [0, 0, 0], null, false));
      const iris = mesh(irisGeo, mats.iris, false); iris.rotation.x = Math.PI / 2; eye.add(iris);
      const pupil = mesh(pupilGeo, mats.pupil, false); pupil.rotation.x = Math.PI / 2; eye.add(pupil);
      eye.add(blob(mats.shine, 0.0028, [0.004, 0.005, 0.0158], null, false));
      head.add(eye);
      eyes.push(eye);
      // eyelid crease
      const lid = mesh(new T.TorusGeometry(0.0172, 0.0018, 6, 20, Math.PI * 0.8), mats.skinDark, false);
      lid.position.copy(eye.position).add(new T.Vector3(0, 0.002, 0.002));
      lid.rotation.z = Math.PI * 0.1;
      head.add(lid);
    }

    // Eyebrows
    const brows = [];
    for (const sx of [-1, 1]) {
      const b = new T.Group();
      b.position.set(sx * 0.037, 0.04, 0.098);
      const m = mesh(taper(0.0048, 0.0036, 0.026, 10, 4), mats.hair, false);
      m.rotation.z = sx > 0 ? -Math.PI / 2 + 0.06 : Math.PI / 2 - 0.06;
      m.position.x = -sx * 0.013;
      b.add(m);
      b.userData.sx = sx;
      head.add(b);
      brows.push(b);
    }

    // Mouth
    const mouth = new T.Group();
    mouth.position.set(0, -0.053, 0.1);
    head.add(mouth);
    const lower = mesh(new T.TorusGeometry(0.017, 0.0042, 8, 24, Math.PI), mats.lips, false);
    lower.rotation.z = Math.PI;
    lower.scale.set(1, 0.3, 0.6);
    mouth.add(lower);
    const upper = mesh(new T.TorusGeometry(0.017, 0.0034, 8, 24, Math.PI), mats.lips, false);
    upper.scale.set(1.05, 0.08, 0.6);
    upper.position.y = -0.0005;
    mouth.add(upper);
    const inner = blob(mats.mouth, 0.014, [0, -0.003, -0.002], [1.1, 0.05, 0.5], false);
    mouth.add(inner);

    // Arms
    const arms = {};
    for (const s of ['R', 'L']) {
      const upperArm = mesh(taper(0.052, 0.043, UPPER), mats.shirt);
      const fore = new T.Group();
      fore.add(mesh(taper(0.043, 0.035, FORE - 0.035), mats.shirt));
      const cuff = mesh(new T.TorusGeometry(0.033, 0.007, 10, 24), mats.shirtDark);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = FORE - 0.04;
      fore.add(cuff);
      const wrist = mesh(taper(0.025, 0.024, 0.05), mats.skin);
      wrist.position.y = FORE - 0.05;
      fore.add(wrist);
      root3.add(upperArm, fore);
      const hand = buildHand(mats);
      hand.group.scale.set(s === 'R' ? HAND_SCALE : -HAND_SCALE, HAND_SCALE, HAND_SCALE);
      root3.add(hand.group);
      arms[s] = { upperArm, fore, hand };
    }

    return { root: root3, head, eyes, brows, mouth, inner, torso, arms };
  }

  function buildHand(mats) {
    const g = new T.Group();
    const palm = mesh(roundedBox(0.079, 0.086, 0.03, 0.013), mats.skin);
    palm.position.set(0, 0.047, 0);
    g.add(palm);
    g.add(blob(mats.skin, 0.021, [0.019, 0.026, 0.006], [1.05, 1.35, 0.8])); // thumb pad
    g.add(blob(mats.skin, 0.016, [-0.024, 0.03, 0.004], [1, 1.6, 0.75]));    // pinky-side pad

    const fingers = FINGER.map((F) => {
      const mcp = new T.Group();
      mcp.rotation.order = 'ZXY';
      mcp.position.set(F.x, PALM_TOP + F.y, 0.0);
      g.add(mcp);
      const joints = [mcp];
      let parent = mcp, r = F.r;
      for (let s = 0; s < 3; s++) {
        const r2 = r * 0.9;
        parent.add(mesh(taper(r, r2, F.L[s], 14, 5), mats.skin));
        if (s < 2) {
          const j = new T.Group();
          j.position.y = F.L[s];
          parent.add(j);
          joints.push(j);
          parent = j;
        } else {
          parent.add(blob(mats.nail, r2 * 0.82, [0, F.L[s] * 0.75, -r2 * 0.62], [1, 1.35, 0.4], false));
        }
        r = r2;
      }
      return joints;
    });

    const tcmc = new T.Group();
    tcmc.position.copy(THUMB.base);
    g.add(tcmc);
    const tJoints = [tcmc];
    let parent = tcmc;
    for (let s = 0; s < 3; s++) {
      const r1 = THUMB.r[s], r2 = s < 2 ? THUMB.r[s + 1] : THUMB.r[s] * 0.92;
      parent.add(mesh(taper(r1, r2, THUMB.L[s], 14, 5), mats.skin));
      if (s < 2) {
        const j = new T.Group();
        j.position.y = THUMB.L[s];
        parent.add(j);
        tJoints.push(j);
        parent = j;
      } else {
        parent.add(blob(mats.nail, r2 * 0.8, [0, THUMB.L[s] * 0.72, -r2 * 0.62], [1, 1.3, 0.4], false));
      }
    }
    return { group: g, fingers, thumb: tJoints };
  }

  const _d = new T.Vector3(), _z = new T.Vector3(), _x = new T.Vector3(), _m = new T.Matrix4();
  const PALM_N = new T.Vector3(0, 0, 1);

  function applyShape(hand, s) {
    for (let i = 0; i < 4; i++) {
      const [mcp, pip, dip] = hand.fingers[i];
      mcp.rotation.set(s[i * 3] * DEG, 0, s[12 + i] * DEG);
      pip.rotation.x = s[i * 3 + 1] * DEG;
      dip.rotation.x = s[i * 3 + 2] * DEG;
    }
    // Thumb: ab = swing away from the index (in the palm plane), op = lift toward the palm side,
    // roll = which way the thumb pad faces, then the two knuckle bends.
    const ab = s[16] * DEG, op = s[17] * DEG, roll = s[18] * DEG;
    _d.set(Math.sin(ab) * Math.cos(op), Math.cos(ab) * Math.cos(op), Math.sin(op)).normalize();
    _z.copy(PALM_N).addScaledVector(_d, -_d.dot(PALM_N));
    if (_z.lengthSq() < 1e-6) _z.set(-1, 0, 0);
    _z.normalize();
    _x.crossVectors(_d, _z); // used for the roll
    _z.multiplyScalar(Math.cos(roll)).addScaledVector(_x, Math.sin(roll)).normalize();
    _x.crossVectors(_d, _z);
    _m.makeBasis(_x, _d, _z);
    hand.thumb[0].quaternion.setFromRotationMatrix(_m);
    hand.thumb[1].rotation.x = s[19] * DEG;
    hand.thumb[2].rotation.x = s[20] * DEG;
  }

  // Orientation of a hand from "which way the fingers point" and "which way the palm faces".
  function handQuat(f, n) {
    const y = new T.Vector3().fromArray(f).normalize();
    const z = new T.Vector3().fromArray(n);
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new T.Vector3().crossVectors(y, z);
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  }

  const UP = new T.Vector3(0, 1, 0);
  function aim(obj, from, to) {
    obj.position.copy(from);
    _d.subVectors(to, from).normalize();
    obj.quaternion.setFromUnitVectors(UP, _d);
  }

  // Two-bone IK: where does the elbow go so the wrist reaches the target?
  const _t = new T.Vector3(), _n = new T.Vector3(), _p = new T.Vector3(), _e = new T.Vector3();
  function solveArm(side, wrist, pole) {
    const S = SHOULDER[side];
    _t.subVectors(wrist, S);
    let d = _t.length();
    const max = UPPER + FORE - 0.002;
    if (d > max) { _t.multiplyScalar(max / d); d = max; }
    d = Math.max(d, Math.abs(UPPER - FORE) + 0.01);
    _n.copy(_t).normalize();
    const x = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, UPPER * UPPER - x * x));
    _p.copy(pole || POLE[side]).addScaledVector(_n, -(pole || POLE[side]).dot(_n)).normalize();
    _e.copy(S).addScaledVector(_n, x).addScaledVector(_p, h);
    return { elbow: _e.clone(), wrist: S.clone().addScaledVector(_n, d) };
  }

  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;

  // Turn a hand spec {p, f, n, hs, elbow} into ready-to-use numbers.
  function resolveHand(h) {
    return {
      p: new T.Vector3().fromArray(h.p),
      q: handQuat(h.f, h.n),
      s: resolveShape(h.hs),
      pole: h.elbow ? new T.Vector3().fromArray(h.elbow) : null
    };
  }
  const copyHand = (h) => ({ p: h.p.clone(), q: h.q.clone(), s: Float32Array.from(h.s), pole: h.pole ? h.pole.clone() : null });

  class SignAvatar3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.speed = 1;
      this.queue = [];
      this.cur = null;
      this.listeners = [];
      this.running = true;
      this.idleSince = 0;
      this.atRest = true;
      this.face = { brow: 0, browTarget: 0, shake: 0, nod: 0 };
      this.nextBlink = performance.now() + 2000;
      this.blinkUntil = 0;
      this.lastFrame = 0;

      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer = renderer;

      const scene = new T.Scene();
      this.scene = scene;
      this.camera = new T.PerspectiveCamera(27, 1 / ASPECT, 0.1, 10);
      this.camera.position.set(0, 1.44, 2.12);
      this.camera.lookAt(0, 1.385, 0);

      scene.add(new T.HemisphereLight(0xf3f6ff, 0x6b5a4e, 1.6));
      const key = new T.DirectionalLight(0xfff3e6, 2.6);
      key.position.set(0.9, 2.5, 2.2);
      key.target.position.set(0, 1.35, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -0.55, right: 0.55, top: 0.55, bottom: -0.55, near: 1, far: 5 });
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.01;
      key.shadow.radius = 3;
      scene.add(key, key.target);
      const fill = new T.DirectionalLight(0xdfe8ff, 0.7);
      fill.position.set(-1.5, 1.6, 1.5);
      scene.add(fill);
      const rim = new T.DirectionalLight(0xbfd4ff, 1.6);
      rim.position.set(-0.8, 2.2, -1.8);
      scene.add(rim);

      const std = (color, rough, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra || {}));
      this.mats = {
        skin: std(COL.skin, 0.52), skinDark: std(0x9a6044, 0.6), shirt: std(COL.shirt, 0.85),
        shirtDark: std(COL.shirtDark, 0.9), hair: std(COL.hair, 0.75), lips: std(COL.lips, 0.45),
        nail: std(COL.nail, 0.3), eyeWhite: std(COL.eyeWhite, 0.25), iris: std(COL.iris, 0.3),
        pupil: std(COL.pupil, 0.2), mouth: std(COL.mouth, 0.8),
        shine: new T.MeshBasicMaterial({ color: 0xffffff })
      };
      this.rig = buildCharacter(this.mats);
      scene.add(this.rig.root);

      const rest = SB.signs3d.REST;
      this.restR = resolveHand(rest.R);
      this.restL = resolveHand(rest.L);
      this.pose = { R: copyHand(this.restR), L: copyHand(this.restL) };

      this._tick = this._tick.bind(this);
      this.resize(canvas.clientWidth || 220);
      requestAnimationFrame(this._tick);
    }

    resize(cssWidth) {
      const h = Math.round(cssWidth * ASPECT);
      this.canvas.style.width = cssWidth + 'px';
      this.canvas.style.height = h + 'px';
      this.renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      this.renderer.setSize(cssWidth, h, false);
    }

    setSpeed(mult) { this.speed = Math.max(0.2, mult || 1); }
    onChange(fn) { this.listeners.push(fn); }

    _emit() {
      const fr = this.cur && this.cur.clip.frames[this.cur.i];
      const state = {
        label: this.cur && !this.cur.clip.rest ? this.cur.clip.label : null,
        spelled: !!(this.cur && this.cur.clip.spelled),
        letters: this.cur && this.cur.clip.letters,
        letterIndex: fr && fr.li != null ? fr.li : -1,
        upcoming: this.queue.map((c) => c.label)
      };
      this.listeners.forEach((fn) => { try { fn(state); } catch (e) {} });
    }

    _normalise(clip) {
      const usesR = clip.frames.some((f) => f.R), usesL = clip.frames.some((f) => f.L);
      let r = clip.frames.find((f) => f.R), l = clip.frames.find((f) => f.L);
      r = r && r.R; l = l && l.L;
      clip.frames = clip.frames.map((f) => {
        if (f.R) r = f.R;
        if (f.L) l = f.L;
        return {
          ...f,
          R: usesR ? resolveHand(r) : copyHand(this.restR),
          L: usesL ? resolveHand(l) : copyHand(this.restL)
        };
      });
      clip.totalMs = clip.frames.reduce((s, f) => s + f.d + (f.hold || 0), 0);
      return clip;
    }

    enqueue(clip) {
      if (!clip) return;
      this.queue.push(this._normalise(clip));
      this._emit();
    }

    enqueueTokens(tokens, opts) {
      const o = opts || {};
      const qtype = o.qtype || (o.question ? 'yn' : null);
      for (const t of tokens) this.enqueue(SB.signs3d.clipFor(t, qtype));
    }

    backlogMs() {
      let ms = this.queue.reduce((s, c) => s + c.totalMs, 0);
      if (this.cur && !this.cur.clip.rest) {
        const frames = this.cur.clip.frames;
        for (let i = this.cur.i; i < frames.length; i++) ms += frames[i].d + (frames[i].hold || 0);
      }
      return ms / this.speed;
    }

    trimTo(maxMs) {
      let dropped = 0;
      while (this.queue.length > 1 && this.backlogMs() > maxMs) { this.queue.shift(); dropped++; }
      if (dropped) this._emit();
      return dropped;
    }

    clear() { this.queue = []; this._emit(); }

    _start(clip, now) {
      this.cur = { clip, i: 0, t0: now, from: { R: copyHand(this.pose.R), L: copyHand(this.pose.L) } };
      this.atRest = !!clip.rest;
      this.face.browTarget = clip.qtype === 'yn' ? 1 : clip.qtype === 'wh' ? -1 : 0;
      if (!clip.rest) this.face.nod = 1;
      this._emit();
    }

    _blend(from, to, k, out) {
      out.p.lerpVectors(from.p, to.p, k);
      out.q.slerpQuaternions(from.q, to.q, k);
      for (let i = 0; i < 21; i++) out.s[i] = lerp(from.s[i], to.s[i], k);
      out.pole = to.pole || from.pole;
    }

    _tick(now) {
      if (!this.running) return;
      requestAnimationFrame(this._tick);

      if (!this.cur) {
        if (this.queue.length) this._start(this.queue.shift(), now);
        else if (!this.atRest && now - this.idleSince > 700) {
          this._start(this._normalise({ label: null, rest: true, frames: [{ R: SB.signs3d.REST.R, L: SB.signs3d.REST.L, d: 550, hold: 0 }] }), now);
          this.face.browTarget = 0;
        }
      }

      // When nothing is happening, draw at ~30 fps to save battery.
      if (!this.cur && now - this.lastFrame < 33) return;
      this.lastFrame = now;

      if (this.cur) {
        const frames = this.cur.clip.frames;
        const fr = frames[this.cur.i];
        const d = fr.d / this.speed, hold = (fr.hold || 0) / this.speed;
        const el = now - this.cur.t0;
        const k = ease(Math.min(1, el / Math.max(1, d)));
        this._blend(this.cur.from.R, fr.R, k, this.pose.R);
        this._blend(this.cur.from.L, fr.L, k, this.pose.L);
        if (el >= d + hold) {
          this.cur.i++;
          this.cur.from = { R: copyHand(this.pose.R), L: copyHand(this.pose.L) };
          this.cur.t0 = now;
          if (this.cur.i >= frames.length) {
            const wasRest = this.cur.clip.rest;
            this.cur = null;
            this.idleSince = now;
            if (!wasRest) this._emit();
          } else if (frames[this.cur.i].li !== fr.li) {
            this._emit();
          }
        }
      }
      this._pose(now);
      this.renderer.render(this.scene, this.camera);
    }

    _pose(now) {
      const rig = this.rig;
      for (const s of ['R', 'L']) {
        const st = this.pose[s];
        const arm = rig.arms[s];
        // palm centre -> wrist
        const yAxis = new T.Vector3(0, 1, 0).applyQuaternion(st.q);
        const wristTarget = st.p.clone().addScaledVector(yAxis, -PALM_CENTER * HAND_SCALE);
        const { elbow, wrist } = solveArm(s, wristTarget, st.pole);
        aim(arm.upperArm, SHOULDER[s], elbow);
        aim(arm.fore, elbow, wrist);
        arm.hand.group.position.copy(wrist);
        arm.hand.group.quaternion.copy(st.q);
        applyShape(arm.hand, st.s);
      }

      // Face
      const f = this.face;
      const signing = this.cur && !this.cur.clip.rest;
      f.brow += (f.browTarget - f.brow) * 0.12;
      f.nod *= 0.9;
      const neg = signing && this.cur.clip.neg;
      f.shake += ((neg ? 1 : 0) - f.shake) * 0.15;
      for (const b of rig.brows) {
        b.position.y = 0.04 + f.brow * 0.006;
        b.rotation.z = f.brow < 0 ? -b.userData.sx * f.brow * 0.3 : 0;
        b.position.x = b.userData.sx * (0.037 + (f.brow < 0 ? f.brow * 0.003 : 0));
      }
      if (now > this.nextBlink) { this.blinkUntil = now + 120; this.nextBlink = now + 2200 + Math.random() * 3500; }
      const eyeY = now < this.blinkUntil ? 0.08 : 1 + Math.max(0, f.brow) * 0.12;
      for (const e of rig.eyes) e.scale.y += (eyeY - e.scale.y) * 0.6;

      const open = signing ? (Math.sin(now / 95) * 0.5 + 0.5) * 0.7 : 0;
      rig.inner.scale.y += ((0.0007 + open * 0.0105) - rig.inner.scale.y) * 0.3;
      rig.mouth.children[0].position.y = -open * 0.004;

      const head = rig.head;
      head.rotation.x = -f.nod * 0.06 + (f.brow > 0 ? -0.05 * f.brow : 0.04 * -f.brow) + Math.sin(now / 1700) * 0.012;
      head.rotation.y = f.shake * Math.sin(now / 110) * 0.16 + Math.sin(now / 2300) * 0.02;
      head.rotation.z = (f.brow > 0 ? 0.05 * f.brow : 0) + Math.sin(now / 2900) * 0.01;
      rig.torso.scale.y = 1 + Math.sin(now / 900) * 0.004;
    }

    destroy() {
      this.running = false;
      this.renderer.dispose();
    }
  }

  // True if this browser can draw 3D.
  SignAvatar3D.supported = function () {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  };

  SB.SignAvatar3D = SignAvatar3D;
  SB._avatar3dInternals = { resolveShape, handQuat, applyShape };
})(typeof self !== 'undefined' ? self : globalThis);
