/* Osso al Volo — utilità matematiche e di disegno condivise */
(function () {
  'use strict';
  const OAV = (window.OAV = window.OAV || {});
  const TAU = Math.PI * 2;

  const U = {
    TAU,
    G: 9.81,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (v - a) / (b - a),
    smooth(a, b, v) {
      const t = U.clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    wrap01: (v) => v - Math.floor(v),
    rand: (a, b) => a + Math.random() * (b - a),
    chance: (p) => Math.random() < p,
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    sign: (v) => (v < 0 ? -1 : 1),
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutBack(t) {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    // interpolazione circolare di una fase in [0,1)
    phaseLerp(a, b, t) {
      let d = b - a;
      d -= Math.round(d);
      return U.wrap01(a + d * t);
    },
    hash(i, j) {
      let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    },
    noise1(x, seed = 0) {
      const i = Math.floor(x), f = x - i;
      const a = U.hash(i, seed), b = U.hash(i + 1, seed);
      const t = f * f * (3 - 2 * f);
      return a + (b - a) * t;
    },
    // rumore frattale centrato su 0, ampiezza circa ±1
    fbm(x, seed = 0) {
      return (U.noise1(x, seed) - 0.5) * 1.3 + (U.noise1(x * 2.13, seed + 7) - 0.5) * 0.6 + (U.noise1(x * 4.7, seed + 13) - 0.5) * 0.25;
    },
    rot(x, y, a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [x * c - y * s, x * s + y * c];
    },
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    // distanza punto-segmento (per collisioni veloci)
    segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = U.clamp(t, 0, 1);
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    },
    /**
     * IK a due segmenti. Restituisce [jx, jy, ex, ey] (giunto intermedio, estremità).
     * bend: +1 = giunto piegato in avanti (+x), -1 = indietro.
     */
    ik2(ax, ay, tx, ty, l1, l2, bend) {
      let dx = tx - ax, dy = ty - ay;
      let d = Math.hypot(dx, dy);
      const maxD = l1 + l2 - 1e-4, minD = Math.abs(l1 - l2) + 1e-4;
      if (d < 1e-6) { dx = 0; dy = -1; d = minD; }
      const dc = U.clamp(d, minD, maxD);
      const a = Math.atan2(dy, dx);
      const cosA = U.clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1);
      const alpha = Math.acos(cosA);
      // con a ≈ -90° (verso il basso), a + alpha porta il giunto verso +x
      const ja = a + bend * alpha;
      const jx = ax + Math.cos(ja) * l1, jy = ay + Math.sin(ja) * l1;
      const ex = ax + Math.cos(a) * dc, ey = ay + Math.sin(a) * dc;
      return [jx, jy, ex, ey];
    },
    // Catmull-Rom → Bézier. pts = [[x,y],...]
    smoothPath(ctx, pts, closed, tension = 1) {
      const n = pts.length;
      if (n < 2) return;
      const k = tension / 6;
      const P = (i) => (closed ? pts[(i + n) % n] : pts[U.clamp(i, 0, n - 1)]);
      ctx.moveTo(pts[0][0], pts[0][1]);
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        ctx.bezierCurveTo(
          p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
          p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
          p2[0], p2[1]
        );
      }
      if (closed) ctx.closePath();
    },
    // capsula affusolata tra due punti con raggi diversi
    taper(ctx, x1, y1, r1, x2, y2, r2) {
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.hypot(dx, dy) || 1e-6;
      const a = Math.atan2(dy, dx);
      // angolo delle tangenti esterne
      const s = U.clamp((r1 - r2) / d, -0.99, 0.99);
      const t = Math.acos(s);
      ctx.moveTo(x1 + Math.cos(a + t) * r1, y1 + Math.sin(a + t) * r1);
      ctx.arc(x1, y1, r1, a + t, a + TAU - t, false);
      ctx.lineTo(x2 + Math.cos(a - t) * r2, y2 + Math.sin(a - t) * r2);
      ctx.arc(x2, y2, r2, a - t, a + t, false);
      ctx.closePath();
    },
    // interpolazione di Hermite su keyframe con tempi non uniformi
    keyInterp(keys, t, prop) {
      const n = keys.length;
      if (t <= keys[0].t) return keys[0][prop];
      if (t >= keys[n - 1].t) return keys[n - 1][prop];
      let i = 0;
      while (i < n - 2 && t > keys[i + 1].t) i++;
      const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
      const h = k2.t - k1.t;
      const u = (t - k1.t) / h;
      const v1 = k1[prop], v2 = k2[prop];
      const m1 = (i === 0 ? 0 : ((v2 - k0[prop]) / (k2.t - k0.t))) * h;
      const m2 = (i + 1 === n - 1 ? 0 : ((k3[prop] - v1) / (k3.t - k1.t))) * h;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
    },
    weighted(list) {
      let tot = 0;
      for (const it of list) tot += it.w;
      let r = Math.random() * tot;
      for (const it of list) { r -= it.w; if (r <= 0) return it; }
      return list[list.length - 1];
    },
    mixColor(c1, c2, t) {
      // c come [r,g,b]
      return `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
    },
    lsGet(key, def) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    lsSet(key, val) {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage non disponibile */ }
    },
  };

  OAV.U = U;
})();
