// The signing character, drawn with the 2D canvas (no libraries, works offline).
// It plays "clips" (a word sign or a fingerspelled word) one after another,
// smoothly moving between key poses. Drawing area is always 240 x 260 units.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});
  const W = 240, H = 260;
  const DEG = Math.PI / 180;

  const COLORS = {
    skin: '#f2c6a0', skinLine: '#a0684a', shirt: '#4c6ef5', shirtLine: '#2f4bc2',
    cuff: '#748ffc', hair: '#2b1d14', eye: '#1f1f1f', mouth: '#b4485a', bubble: '#ffffff'
  };

  const SHOULDER_R = { x: 84, y: 152 };
  const SHOULDER_L = { x: 156, y: 152 };
  const UPPER = 54, FORE = 52;

  const REST = {
    R: { x: 104, y: 232, rot: 100, z: 1, shape: 'B' },
    L: { x: 136, y: 232, rot: 100, z: 1, shape: 'B' }
  };

  // [index, middle, ring, pinky]: base x on the palm, length, spread direction
  const FINGERS = [
    { x: 9.5, len: 24, sp: 9 },
    { x: 3, len: 27, sp: 3 },
    { x: -3.5, len: 25, sp: -4 },
    { x: -10, len: 20, sp: -11 }
  ];

  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const shapeOf = (s) => (typeof s === 'string' ? SB.HANDSHAPES[s] || SB.HANDSHAPES.B : s);

  function lerpShape(a, b, k) {
    const pick = k < 0.5 ? a : b;
    return {
      f: a.f.map((v, i) => lerp(v, b.f[i], k)),
      spread: lerp(a.spread, b.spread, k),
      curve: lerp(a.curve, b.curve, k),
      t: pick.t, touch: pick.touch, side: pick.side, cross: pick.cross, hook: pick.hook
    };
  }

  function lerpHand(a, b, k) {
    return {
      x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rot: lerp(a.rot, b.rot, k),
      z: lerp(a.z || 1, b.z || 1, k), hs: lerpShape(a.hs, b.hs, k)
    };
  }

  const resolveHand = (h) => ({ x: h.x, y: h.y, rot: h.rot || 0, z: h.z || 1, hs: shapeOf(h.shape || h.hs) });
  const copyHand = (h) => ({ ...h, hs: { ...h.hs, f: h.hs.f.slice() } });

  // Make every frame say where BOTH hands are.
  function normaliseClip(clip) {
    let r = null, l = null;
    const usesR = clip.frames.some((f) => f.R);
    const usesL = clip.frames.some((f) => f.L);
    clip.frames = clip.frames.map((f) => {
      if (f.R) r = f.R; if (f.L) l = f.L;
      return {
        ...f,
        R: resolveHand(usesR ? (r || clip.frames.find((x) => x.R).R) : REST.R),
        L: resolveHand(usesL ? (l || clip.frames.find((x) => x.L).L) : REST.L)
      };
    });
    clip.totalMs = clip.frames.reduce((s, f) => s + f.d + (f.hold || 0), 0);
    return clip;
  }

  // Two-bone arm: find the elbow so the wrist reaches the target.
  function solveArm(sh, target, outward) {
    let dx = target.x - sh.x, dy = target.y - sh.y;
    let d = Math.hypot(dx, dy);
    const max = UPPER + FORE - 0.5;
    let tx = target.x, ty = target.y;
    if (d > max) { tx = sh.x + (dx / d) * max; ty = sh.y + (dy / d) * max; dx = tx - sh.x; dy = ty - sh.y; d = max; }
    d = Math.max(d, Math.abs(UPPER - FORE) + 1);
    const a = Math.acos(Math.max(-1, Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d))));
    const base = Math.atan2(dy, dx);
    const c1 = { x: sh.x + UPPER * Math.cos(base + a), y: sh.y + UPPER * Math.sin(base + a) };
    const c2 = { x: sh.x + UPPER * Math.cos(base - a), y: sh.y + UPPER * Math.sin(base - a) };
    const score = (e) => e.y + outward * (e.x - sh.x) * 0.6;
    return { elbow: score(c1) >= score(c2) ? c1 : c2, wrist: { x: tx, y: ty } };
  }

  function stroke(ctx, pts, width, fill, line) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = line; ctx.lineWidth = width + 2.2; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = width; ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const dirOf = (deg) => ({ x: Math.sin(deg * DEG), y: -Math.cos(deg * DEG) });
  const add = (p, d, len) => ({ x: p.x + d.x * len, y: p.y + d.y * len });

  // Draw one hand. Local space: wrist at (0,0), fingers point up (-y),
  // the thumb side is +x (toward the middle of the body).
  function drawHand(ctx, hand, mirror) {
    const hs = hand.hs;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    const s = 1.12 * (hand.z || 1);
    ctx.scale(mirror * s, s);
    ctx.rotate(hand.rot * DEG);

    const side = hs.side;
    const palmW = side ? 14 : 28, palmH = 31, top = -palmH;

    roundRect(ctx, -palmW / 2, top, palmW, palmH + 2, side ? 6 : 9);
    ctx.fillStyle = COLORS.skin; ctx.fill();
    ctx.strokeStyle = COLORS.skinLine; ctx.lineWidth = 1.4; ctx.stroke();

    const tips = [];
    const order = [3, 2, 1, 0]; // pinky first, index on top
    for (const i of order) {
      const F = FINGERS[i];
      const e = hs.f[i];
      let bx = side ? 2 - i * 1.6 : F.x;
      let ang = F.sp * hs.spread;
      if (hs.cross && i === 0) { bx -= 4; ang -= 14; }
      if (hs.cross && i === 1) { bx += 3; ang += 8; }
      const base = { x: bx, y: top + 4 };
      const d0 = dirOf(ang);
      let pts;
      if (hs.hook && i === 0) {
        const p1 = add(base, d0, F.len * 0.55);
        pts = [base, p1, add(p1, dirOf(ang + 115), F.len * 0.32)];
      } else if (hs.curve > 0.05 && e > 0.3) {
        const p1 = add(base, d0, F.len * 0.5);
        const p2 = add(p1, dirOf(ang + 55 * hs.curve), F.len * 0.35);
        pts = [base, p1, add(p2, dirOf(ang + 110 * hs.curve), F.len * 0.3)];
      } else if (e < 0.18) {
        pts = [base, add(base, d0, 5)]; // folded: just the knuckle shows
      } else {
        pts = [base, add(base, d0, Math.max(5, F.len * e))];
      }
      const shade = side && i > 0 ? '#e4b48d' : COLORS.skin;
      stroke(ctx, pts, 6, shade, COLORS.skinLine);
      tips[i] = pts[pts.length - 1];
    }

    // Thumb
    const tb = side ? { x: 5, y: -6 } : { x: 11, y: -7 };
    let tpts;
    switch (hs.t) {
      case 'out': tpts = [tb, add(tb, dirOf(55), 19)]; break;
      case 'side': tpts = [{ x: tb.x + 2, y: tb.y + 1 }, { x: tb.x + 3, y: tb.y - 15 }]; break;
      case 'up': tpts = [{ x: 8, y: -10 }, { x: 9, y: -30 }]; break;
      case 'peek': tpts = [{ x: 9, y: -10 }, { x: 6, y: -29 }]; break;
      case 'para': tpts = [tb, add(tb, dirOf(18), 17)]; break;
      case 'touch': {
        const tip = tips[hs.touch] || add(tb, dirOf(40), 18);
        const mid = { x: Math.max(tb.x, tip.x) + 7, y: (tb.y + tip.y) / 2 };
        tpts = [tb, mid, tip];
        break;
      }
      default: tpts = [{ x: 11, y: -7 }, { x: -5, y: -13 }]; // across the palm
    }
    stroke(ctx, tpts, 7.5, COLORS.skin, COLORS.skinLine);
    ctx.restore();
  }

  function drawArm(ctx, shoulder, hand, outward) {
    const { elbow, wrist } = solveArm(shoulder, hand, outward);
    stroke(ctx, [shoulder, elbow], 17, COLORS.shirt, COLORS.shirtLine);
    stroke(ctx, [elbow, wrist], 14, COLORS.shirt, COLORS.shirtLine);
    ctx.beginPath(); ctx.arc(wrist.x, wrist.y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.cuff; ctx.fill();
    return wrist;
  }

  class SignAvatar {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.speed = 1;
      this.queue = [];
      this.cur = null;
      this.pose = { R: resolveHand(REST.R), L: resolveHand(REST.L) };
      this.atRest = true;
      this.idleSince = 0;
      this.brow = 0;
      this.blinkUntil = 0;
      this.nextBlink = performance.now() + 2500;
      this.listeners = [];
      this.running = true;
      this._tick = this._tick.bind(this);
      this.resize(canvas.clientWidth || 220);
      requestAnimationFrame(this._tick);
    }

    resize(cssWidth) {
      const dpr = root.devicePixelRatio || 1;
      this.canvas.style.width = cssWidth + 'px';
      this.canvas.style.height = Math.round(cssWidth * H / W) + 'px';
      this.canvas.width = Math.round(cssWidth * dpr);
      this.canvas.height = Math.round(cssWidth * H / W * dpr);
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

    enqueue(clip) {
      if (!clip) return;
      this.queue.push(normaliseClip(clip));
      this._emit();
    }

    enqueueTokens(tokens, opts) {
      const q = !!(opts && opts.question);
      for (const t of tokens) this.enqueue(SB.signs.clipFor(t, q));
    }

    // How long (ms, at current speed) until everything queued is signed.
    backlogMs() {
      let ms = this.queue.reduce((s, c) => s + c.totalMs, 0);
      if (this.cur && !this.cur.clip.rest) {
        const frames = this.cur.clip.frames;
        for (let i = this.cur.i; i < frames.length; i++) ms += frames[i].d + (frames[i].hold || 0);
      }
      return ms / this.speed;
    }

    // Drop the oldest waiting words so the signing stays close to live.
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
      this._emit();
    }

    _tick(now) {
      if (!this.running) return;
      if (!this.cur) {
        if (this.queue.length) this._start(this.queue.shift(), now);
        else if (!this.atRest && now - this.idleSince > 600) {
          this._start(normaliseClip({ label: null, rest: true, frames: [{ R: REST.R, L: REST.L, d: 450, hold: 0 }] }), now);
        }
      }
      if (this.cur) {
        const frames = this.cur.clip.frames;
        const fr = frames[this.cur.i];
        const d = fr.d / this.speed, hold = (fr.hold || 0) / this.speed;
        const el = now - this.cur.t0;
        const k = ease(Math.min(1, el / Math.max(1, d)));
        this.pose = { R: lerpHand(this.cur.from.R, fr.R, k), L: lerpHand(this.cur.from.L, fr.L, k) };
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
      this._draw(now);
      requestAnimationFrame(this._tick);
    }

    _draw(now) {
      const ctx = this.ctx;
      const sc = this.canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const signing = this.cur && !this.cur.clip.rest;
      const wantBrow = signing && this.cur.clip.question ? 1 : 0;
      this.brow += (wantBrow - this.brow) * 0.12;
      const breath = Math.sin(now / 900) * 1.2;
      ctx.save();
      ctx.translate(0, breath);

      // Body
      ctx.beginPath();
      ctx.moveTo(56, 262);
      ctx.quadraticCurveTo(58, 158, 84, 146);
      ctx.quadraticCurveTo(120, 132, 156, 146);
      ctx.quadraticCurveTo(182, 158, 184, 262);
      ctx.closePath();
      ctx.fillStyle = COLORS.shirt; ctx.fill();
      ctx.strokeStyle = COLORS.shirtLine; ctx.lineWidth = 1.5; ctx.stroke();

      // Neck
      roundRect(ctx, 109, 100, 22, 42, 8);
      ctx.fillStyle = COLORS.skin; ctx.fill();
      ctx.beginPath(); ctx.moveTo(104, 140); ctx.quadraticCurveTo(120, 152, 136, 140);
      ctx.strokeStyle = COLORS.shirtLine; ctx.lineWidth = 3; ctx.stroke();

      // Head
      const tilt = this.brow * 4 * DEG;
      ctx.save();
      ctx.translate(120, 72); ctx.rotate(tilt); ctx.translate(-120, -72);
      ctx.beginPath(); ctx.ellipse(84, 76, 6, 9, 0, 0, Math.PI * 2); ctx.ellipse(156, 76, 6, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.skin; ctx.fill();
      ctx.beginPath(); ctx.ellipse(120, 72, 36, 40, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.skin; ctx.fill();
      ctx.strokeStyle = COLORS.skinLine; ctx.lineWidth = 1.4; ctx.stroke();
      // Hair
      ctx.beginPath();
      ctx.moveTo(84, 70);
      ctx.quadraticCurveTo(82, 30, 120, 30);
      ctx.quadraticCurveTo(160, 30, 156, 70);
      ctx.quadraticCurveTo(150, 46, 128, 48);
      ctx.quadraticCurveTo(104, 44, 84, 70);
      ctx.fillStyle = COLORS.hair; ctx.fill();
      // Eyes (blink now and then)
      if (now > this.nextBlink) { this.blinkUntil = now + 130; this.nextBlink = now + 2500 + Math.random() * 3000; }
      const eyeH = now < this.blinkUntil ? 0.6 : 4.6;
      ctx.fillStyle = COLORS.eye;
      ctx.beginPath(); ctx.ellipse(106, 74, 3.6, eyeH, 0, 0, Math.PI * 2); ctx.ellipse(134, 74, 3.6, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      // Eyebrows go up for questions (a real part of ASL grammar)
      const by = 63 - this.brow * 5;
      ctx.strokeStyle = COLORS.hair; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(99, by + 1); ctx.quadraticCurveTo(106, by - 3, 113, by);
      ctx.moveTo(127, by); ctx.quadraticCurveTo(134, by - 3, 141, by + 1); ctx.stroke();
      // Mouth (moves a little while signing)
      const open = signing ? (Math.sin(now / 90) + 1) * 2.2 : 0;
      ctx.beginPath();
      ctx.moveTo(110, 92);
      ctx.quadraticCurveTo(120, 99 + open, 130, 92);
      if (open > 0.5) { ctx.quadraticCurveTo(120, 95, 110, 92); ctx.fillStyle = COLORS.mouth; ctx.fill(); }
      ctx.strokeStyle = COLORS.mouth; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.restore();

      // Arms + hands (left first so the right hand is in front)
      const wl = drawArm(ctx, SHOULDER_L, this.pose.L, +1);
      drawHand(ctx, { ...this.pose.L, x: wl.x, y: wl.y }, -1);
      const wr = drawArm(ctx, SHOULDER_R, this.pose.R, -1);
      drawHand(ctx, { ...this.pose.R, x: wr.x, y: wr.y }, 1);
      ctx.restore();

      // Letter bubble while fingerspelling
      const fr = this.cur && this.cur.clip.frames[this.cur.i];
      if (fr && fr.letter) {
        ctx.beginPath(); ctx.arc(206, 34, 22, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.bubble; ctx.fill();
        ctx.strokeStyle = COLORS.shirt; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#1b1f3a';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fr.letter, 206, 35);
      }
    }

    destroy() { this.running = false; }
  }

  SB.SignAvatar = SignAvatar;
})(typeof self !== 'undefined' ? self : globalThis);
