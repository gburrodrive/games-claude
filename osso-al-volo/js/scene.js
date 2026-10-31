/* Osso al Volo — camera prospettica, spiaggia, mare, onde, impronte, particelle */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;

  // Geometria del mondo (metri). x lungo la spiaggia (mare a destra), y in alto, z in profondità.
  const WORLD = (OAV.WORLD = {
    HUMAN_X: 0,
    HUMAN_Z: 0.9,
    LEFT: -16.5,
    SHORE_TOP: 33,       // inizio della battigia in pendenza
    SLOPE: 0.035,        // pendenza della battigia
    X0: 36,              // linea media dell'acqua
    K_SHORE: 0.32,       // la riva si allontana in diagonale come nella foto
    DUNE_X: -19.5,
    K_DUNE: -0.28,
    DOG_MAX_DEPTH: 0.19, // oltre questa profondità un cane piccolo non si avventura
    LOST_X: 44.5,
    SUN: { sx: 0.22, sz: 0.16 }, // spostamento dell'ombra per metro di altezza
  });
  // la riva è dritta tra la camera e il cane e piega in diagonale verso l'orizzonte
  WORLD.kz = (z) => WORLD.K_SHORE * ((Math.sqrt(z * z + 4) + z) / 2 - 1);

  const HAZE = [214, 226, 236];

  class Camera {
    constructor() {
      this.x = 1.5;
      this.D0 = 4;
      this.D = 4;
      this.h0 = 0.6;
      this.W = 800; this.H = 600;
      this.F = 600;
      this.horizonY = 260;
      this.shake = 0;
      this.shakeX = 0; this.shakeY = 0;
    }
    resize(W, H) {
      this.W = W; this.H = H;
      const land = W >= H * 1.05;
      const ppm0 = land ? Math.max(W / 7.6, H / 5.2) : Math.max(W / 4.4, H / 9.5);
      this.F = ppm0 * this.D0;
      this.horizonY = H * (land ? 0.43 : 0.52);
      this.maxD = this.D0 * (land ? 2.5 : 3.2);
    }
    get camH() { return this.h0 * this.D / this.D0; }
    sx(x, z) { return this.W / 2 + (x - this.x) * this.F / (z + this.D) + this.shakeX; }
    sy(y, z) { return this.horizonY - (y - this.camH) * this.F / (z + this.D) + this.shakeY; }
    scale(z) { return this.F / (z + this.D); }
    // da coordinate schermo (sul piano z) a mondo
    worldX(sx, z) { return this.x + (sx - this.W / 2) * (z + this.D) / this.F; }
    worldY(sy, z) { return this.camH - (sy - this.horizonY) * (z + this.D) / this.F; }
    get visibleWidth() { return this.W * this.D / this.F; }
    update(dt) {
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 3);
        const m = this.shake * 6;
        this.shakeX = (Math.random() - 0.5) * m;
        this.shakeY = (Math.random() - 0.5) * m;
      } else { this.shakeX = this.shakeY = 0; }
    }
  }

  class World {
    constructor() {
      this.t = 0;
      this.wave = { t0: -2, P: 7, A: 0.05, Lstart: -0.04, broke: false, nextA: 0.05 };
      this.L = 0;
      this.sea = -WORLD.SLOPE * 3;
      this.wx = WORLD.X0;
      this.prevWx = WORLD.X0;
      this.waterVel = 0;
      this.wetX = WORLD.X0 - 1;
      this.boreX = null;
      this.boreI = 0;
      this.uprush = 0;
      this.wind = 0.8;
      this.footprints = [];
      this.particles = [];
      this.props = buildProps();
      this.clouds = null;
      this.sandGrain = null;
      this.onCrash = null;
    }

    groundH(x) { return x <= WORLD.SHORE_TOP ? 0 : -WORLD.SLOPE * (x - WORLD.SHORE_TOP); }
    waterX(z = 0) { return this.wx + WORLD.kz(z); }
    depth(x) { return x > this.wx ? Math.max(0, this.sea - this.groundH(x)) : 0; }
    // massima x raggiungibile dal cane (acqua troppo alta oltre)
    dogLimit() {
      return WORLD.SHORE_TOP + (WORLD.DOG_MAX_DEPTH + this.sea) / WORLD.SLOPE;
    }

    update(dt) {
      this.t += dt;
      const w = this.wave;
      let u = (this.t - w.t0) / w.P;
      if (u >= 1) {
        w.Lstart = this.L;
        w.t0 += w.P;
        w.P = U.rand(5.6, 8.6);
        w.A = w.nextA;
        w.nextA = U.rand(0.032, 0.066);
        w.broke = false;
        u = (this.t - w.t0) / w.P;
      }
      if (u < 0.26) {
        this.L = U.lerp(w.Lstart, w.A, U.easeOutCubic(u / 0.26));
        this.uprush = 1 - u / 0.26;
      } else {
        this.L = U.lerp(w.A, -w.A * 0.85, U.easeInOutSine((u - 0.26) / 0.74));
        this.uprush = 0;
      }
      this.sea = -WORLD.SLOPE * 3 + this.L;
      this.prevWx = this.wx;
      this.wx = WORLD.SHORE_TOP + (-this.sea) / WORLD.SLOPE;
      this.waterVel = (this.wx - this.prevWx) / Math.max(dt, 1e-4);
      this.wetX = Math.min(this.wetX + dt * 0.05, this.wx);

      // fronte dell'onda successiva che arriva verso riva
      if (u > 0.4) {
        const s = (u - 0.4) / 0.6;
        const startX = WORLD.X0 + 15;
        this.boreX = U.lerp(startX, this.wx, s * s * 0.35 + s * 0.65);
        this.boreI = s < 0.18 ? 0 : U.clamp((s - 0.18) / 0.08, 0, 1) * (1 - Math.max(0, s - 0.85) * 2.5);
        this.boreS = s;
        if (!w.broke && s >= 0.18) {
          w.broke = true;
          if (this.onCrash) this.onCrash(w.nextA / 0.05);
        }
      } else {
        this.boreX = null;
        this.boreI = 0;
      }

      // impronte: invecchiano e l'acqua le cancella
      const fp = this.footprints;
      for (let i = fp.length - 1; i >= 0; i--) {
        const f = fp[i];
        f.age += dt;
        if (f.age > 45 || f.x - WORLD.kz(f.z) > this.wx - 0.05) fp.splice(i, 1);
      }

      // particelle
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.vy -= (p.g ?? U.G) * dt;
        const drag = p.drag ?? 0.4;
        p.vx *= 1 - drag * dt;
        p.vz *= 1 - drag * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const gh = this.groundH(p.x);
        if (p.y < gh) {
          if (p.kind === 'drop' || p.kind === 'foam') { p.life = Math.min(p.life, 0.05); }
          p.y = gh; p.vy *= -0.15; p.vx *= 0.4; p.vz *= 0.4;
          if (p.kind === 'sand') p.life = Math.min(p.life, 0.35);
        }
      }
      if (ps.length > 420) ps.splice(0, ps.length - 420);

      // persone che passeggiano sullo sfondo
      for (const p of this.props) {
        if (p.type === 'walker') {
          p.x += p.v * dt;
          if (p.x > p.max) { p.v = -Math.abs(p.v); p.dir = -1; }
          if (p.x < p.min) { p.v = Math.abs(p.v); p.dir = 1; }
          p.ph += dt * Math.abs(p.v) / 0.75;
        }
      }
    }

    addFootprint(x, z, kind, rot, size) {
      if (x - WORLD.kz(z) > this.wx) return; // in acqua niente impronta
      this.footprints.push({ x, z, kind, rot: rot || 0, size: size || 0.05, age: 0, wet: x > this.wetX - 0.2 });
      if (this.footprints.length > 360) this.footprints.shift();
    }

    burst(kind, x, y, z, n, opt = {}) {
      for (let i = 0; i < n; i++) {
        const sp = opt.speed ?? 1.5;
        const dir = opt.dir ?? 0;
        this.particles.push({
          kind,
          x: x + U.rand(-0.03, 0.03), y: y + U.rand(0, 0.02), z: z + U.rand(-0.06, 0.06),
          vx: dir * sp * U.rand(0.4, 1.2) + U.rand(-0.6, 0.6) * sp * (opt.spread ?? 0.5),
          vy: U.rand(0.4, 1.0) * sp * (opt.up ?? 1),
          vz: U.rand(-0.5, 0.5) * sp * 0.5,
          life: U.rand(0.35, 0.8) * (opt.life ?? 1),
          size: (opt.size ?? 0.008) * U.rand(0.6, 1.4),
          color: opt.color,
          g: opt.g,
          drag: opt.drag,
        });
      }
    }
  }

  // ---------- oggetti di sfondo ----------
  function buildProps() {
    const P = [];
    const umb = [
      [-7, 15, '#e8533f', '#f6efe4'], [5, 24, '#2c6fb0', '#f3f0e8'], [14, 17, '#f2b632', '#f6efe4'],
      [22, 31, '#d94b70', '#f6efe4'], [-12, 34, '#3d8f6b', '#efe9dd'], [10, 48, '#e8533f', '#f3f0e8'],
      [29, 46, '#2c6fb0', '#f6efe4'], [-3, 66, '#f2b632', '#efe9dd'], [18, 80, '#d94b70', '#f3f0e8'],
      [36, 70, '#3d8f6b', '#efe9dd'], [2, 110, '#e8533f', '#f6efe4'], [24, 130, '#2c6fb0', '#f3f0e8'],
    ];
    for (const [x, z, c1, c2] of umb) P.push({ type: 'umbrella', x, z, c1, c2, tilt: U.rand(-0.12, 0.12) });
    const towels = [
      [-6, 13.2, '#3a7bd5', 0], [6.2, 22.5, '#f0c419', 1], [14.8, 15.5, '#e85d75', 1], [23, 29.5, '#2fb39a', 0],
      [-11, 32.5, '#f08a24', 1], [11, 46.5, '#8e6bd1', 1], [-2, 64.5, '#3a7bd5', 0],
    ];
    for (const [x, z, c, person] of towels) P.push({ type: 'towel', x, z, c, person, skin: U.pick(['#c98d67', '#b77953', '#e0aa86', '#8d5a3b']), suit: U.pick(['#1d3557', '#c1121f', '#2a9d8f', '#222', '#f4a261']), flip: U.chance(0.5) ? 1 : -1 });
    // persone in piedi sulla riva (come nella foto)
    const sx = (z) => WORLD.X0 - 1.2 + WORLD.kz(z);
    P.push({ type: 'person', x: sx(38), z: 38, skin: '#c98d67', suit: '#1d1d1d', h: 1.75, pose: 'stand', facing: 1 });
    P.push({ type: 'person', x: sx(38) + 0.6, z: 38.6, skin: '#e0aa86', suit: '#2a4d8f', h: 1.62, pose: 'stand', facing: -1 });
    P.push({ type: 'person', x: sx(55) + 0.4, z: 55, skin: '#b77953', suit: '#c1121f', h: 1.8, pose: 'stand', facing: 1 });
    P.push({ type: 'person', x: sx(75) - 1, z: 75, skin: '#e0aa86', suit: '#1d1d1d', h: 1.7, pose: 'stand', facing: -1 });
    P.push({ type: 'walker', x: 8, z: 27, min: -8, max: 26, v: 1.1, dir: 1, ph: 0, skin: '#c98d67', suit: '#264653', h: 1.74 });
    P.push({ type: 'walker', x: 20, z: 52, min: 0, max: 40, v: -0.9, dir: -1, ph: 1.3, skin: '#e0aa86', suit: '#9d0208', h: 1.66 });
    P.push({ type: 'bin', x: 9, z: 11 });
    P.push({ type: 'bin', x: 28, z: 40 });
    P.push({ type: 'drift', x: -14.2, z: 6, len: 2.4, rot: 0.1 });
    P.push({ type: 'drift', x: -16, z: 19, len: 3.2, rot: -0.2 });
    P.push({ type: 'drift', x: -17.5, z: 34, len: 2.8, rot: 0.05 });
    P.push({ type: 'sign', x: -12.5, z: 3.5 });
    P.push({ type: 'tower', x: 27, z: 22 });
    P.push({ type: 'toys', x: 15.6, z: 14.4 });
    P.push({ type: 'bag', x: -0.75, z: 1.25 });
    P.sort((a, b) => b.z - a.z);
    return P;
  }

  // ---------- disegno della scena ----------
  const R = (OAV.SceneRender = {});

  R.prepare = function (world) {
    // nuvole a cirri pre-renderizzate
    world.clouds = [];
    for (let k = 0; k < 4; k++) {
      const cw = 900, ch = 220;
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const c = cv.getContext('2d');
      c.filter = 'blur(6px)';
      c.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const y = ch * 0.5 + U.rand(-40, 40);
        const x0 = U.rand(50, 300), len = U.rand(160, 500);
        c.strokeStyle = `rgba(255,255,255,${U.rand(0.18, 0.42)})`;
        c.lineWidth = U.rand(4, 16);
        c.beginPath();
        c.moveTo(x0, y);
        c.bezierCurveTo(x0 + len * 0.3, y - U.rand(10, 40), x0 + len * 0.7, y + U.rand(-30, 20), x0 + len, y - U.rand(0, 30));
        c.stroke();
      }
      world.clouds.push({ cv, x: U.rand(-0.6, 1.4), y: U.rand(0.05, 0.42), s: U.rand(0.7, 1.3), v: U.rand(0.002, 0.006) });
    }
  };

  function project(cam, x, y, z) { return [cam.sx(x, z), cam.sy(y, z)]; }

  function zSamples(cam, far = 4000, n = 46) {
    const zMin = -cam.D + Math.max(0.2, cam.camH * cam.F / (cam.H - cam.horizonY + 40));
    const out = [];
    const span = far - zMin;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      out.push(zMin + (Math.pow(span + 1, f) - 1));
    }
    return out;
  }

  R.sky = function (ctx, cam, world) {
    const { W, H } = cam;
    const hy = cam.horizonY + cam.shakeY;
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#2d68c4');
    g.addColorStop(0.45, '#4f8fdb');
    g.addColorStop(0.85, '#9cc4ea');
    g.addColorStop(1, '#cfe2f1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hy + 2);
    // bagliore del sole in alto a sinistra
    const sg = ctx.createRadialGradient(W * 0.08, -H * 0.15, 10, W * 0.08, -H * 0.15, H * 0.9);
    sg.addColorStop(0, 'rgba(255,250,235,0.55)');
    sg.addColorStop(0.35, 'rgba(255,248,230,0.16)');
    sg.addColorStop(1, 'rgba(255,248,230,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, hy);
    // cirri
    if (world.clouds) {
      for (const c of world.clouds) {
        const px = ((c.x + world.t * c.v - cam.x * 0.0015) % 2.4 + 2.4) % 2.4 - 0.6;
        const sx = px * W, sy = c.y * hy;
        const s = c.s * (W / 1400);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(c.cv, sx, sy, c.cv.width * s, c.cv.height * s * 0.7);
      }
      ctx.globalAlpha = 1;
    }
  };

  R.far = function (ctx, cam) {
    const hy = cam.horizonY + cam.shakeY;
    // promontorio lontano (a sinistra, come nella foto)
    const ridge = (zr, x0, x1, hMax, seed, col) => {
      ctx.beginPath();
      ctx.moveTo(cam.sx(x0, zr), hy + 1);
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const x = U.lerp(x0, x1, f);
        const env = Math.sin(Math.PI * Math.pow(f, 0.8));
        const h = hMax * env * (0.75 + 0.35 * U.noise1(f * 7, seed)) ;
        ctx.lineTo(cam.sx(x, zr), cam.sy(h, zr));
      }
      ctx.lineTo(cam.sx(x1, zr), hy + 1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    ridge(5200, -6200, -900, 420, 3, 'rgba(150,176,190,0.85)');
    ridge(2600, -3600, -300, 170, 9, 'rgba(112,142,140,0.95)');
    // fascia di mare all'orizzonte
    ctx.fillStyle = '#7fb0cf';
    ctx.fillRect(0, hy - 1, cam.W, 3);
  };

  R.ground = function (ctx, cam, world) {
    const { W, H } = cam;
    const hy = cam.horizonY + cam.shakeY;
    // sabbia
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#e7dcc6');
    g.addColorStop(0.08, '#e4d0a8');
    g.addColorStop(0.45, '#e2c899');
    g.addColorStop(1, '#d9bc8a');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy + 2);

    const zs = zSamples(cam);
    dunes(ctx, cam, world, zs);
    sea(ctx, cam, world, zs);
  };

  function dunes(ctx, cam, world, zs) {
    const hy = cam.horizonY + cam.shakeY;
    const dx = (z) => WORLD.DUNE_X + WORLD.K_DUNE * z;
    const dh = (z) => 1.1 + 2.2 * U.noise1(z * 0.045 + 3, 21) + 0.6 * U.noise1(z * 0.2, 5);
    // pini domestici dietro le dune
    for (let i = 0; i < 36; i++) {
      const z = 14 + Math.pow(U.hash(i, 77), 1.6) * 520;
      const x = dx(z) - 4 - U.hash(i, 78) * 26;
      const s = cam.scale(z);
      const sx = cam.sx(x, z);
      if (sx < -s * 12 || sx > cam.W + s * 12) continue;
      const sy = cam.sy(dh(z) * 0.6, z);
      const h = 9 + U.hash(i, 79) * 7;
      const haze = 1 - Math.exp(-z / 160);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s, -s);
      ctx.strokeStyle = U.mixColor([92, 74, 62], HAZE, haze);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      const lean = (U.hash(i, 80) - 0.5) * 2.5;
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(lean * 0.3, h * 0.5, lean, h * 0.85);
      ctx.stroke();
      ctx.fillStyle = U.mixColor([46, 74, 44], HAZE, haze);
      ctx.beginPath();
      const cw = 4 + U.hash(i, 81) * 3;
      for (let k = 0; k < 6; k++) {
        const ax = lean + (k / 5 - 0.5) * cw * 1.6;
        ctx.ellipse(ax, h * 0.92 + Math.sin(k * 1.7) * 0.4, cw * 0.42, 1.0 + U.hash(i, k) * 0.5, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    // corpo delle dune
    ctx.beginPath();
    let first = true;
    for (const z of zs) {
      if (z > 900) break;
      const [px, py] = project(cam, dx(z), 0, z);
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      if (z > 900) continue;
      const [px, py] = project(cam, dx(z) - 2.2, dh(z), z);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(-50, cam.sy(dh(zs[0]), zs[0]));
    ctx.lineTo(-50, cam.H + 50);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, hy - 40, 0, cam.H);
    g.addColorStop(0, '#cdbf9c');
    g.addColorStop(0.25, '#d6c095');
    g.addColorStop(1, '#c9ab79');
    ctx.fillStyle = g;
    ctx.fill();
    // ciuffi di vegetazione dunale
    ctx.strokeStyle = 'rgba(96,112,60,0.85)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const z = -1 + Math.pow(U.hash(i, 300), 2) * 120;
      const x = dx(z) - 0.6 - U.hash(i, 301) * 1.6;
      const s = cam.scale(z);
      const px = cam.sx(x, z);
      if (px < -40 || px > cam.W + 40) continue;
      const py = cam.sy(dh(z) * (0.3 + U.hash(i, 302) * 0.6), z);
      const hgt = (0.35 + U.hash(i, 303) * 0.4) * s;
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 6 - 0.5) * 1.3 + Math.sin(world.t * 1.3 + i) * 0.06;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.sin(a) * hgt * 0.4, py - hgt * 0.6, px + Math.sin(a) * hgt, py - Math.cos(a) * hgt);
      }
      ctx.stroke();
    }
    // staccionata in legno ai piedi delle dune
    ctx.strokeStyle = 'rgba(110,86,62,0.9)';
    for (let z = 1; z < 70; z += 2.6) {
      const x = dx(z) + 0.6;
      const s = cam.scale(z);
      const px = cam.sx(x, z), py = cam.sy(0, z);
      if (px < -20 || px > cam.W + 20) continue;
      ctx.lineWidth = Math.max(0.8, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - s * 0.95);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,100,80,0.6)';
    ctx.beginPath();
    for (let z = 1, f = true; z < 70; z += 2.6) {
      const px = cam.sx(dx(z) + 0.6, z), py = cam.sy(0.8, z);
      if (f) { ctx.moveTo(px, py); f = false; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function sea(ctx, cam, world, zs) {
    const { W, H } = cam;
    const hy = cam.horizonY + cam.shakeY;
    const t = world.t;
    const wig = (z, off) => 0.28 * (U.noise1(z * 0.11 + off, 4) - 0.5) + 0.12 * (U.noise1(z * 0.5 + off * 2, 9) - 0.5);
    const shoreAt = (z, off = 0) => world.wx + WORLD.kz(z) + off + wig(z, t * 0.15);
    const lvl = world.sea;

    // sabbia bagnata
    ctx.beginPath();
    zs.forEach((z, i) => {
      const [px, py] = project(cam, world.wetX - 1.2 + WORLD.kz(z) + wig(z, 50), 0, z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const [px, py] = project(cam, shoreAt(z), lvl, z);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,118,74,0.32)';
    ctx.fill();
    // velo lucido sulla sabbia bagnata (riflesso del cielo)
    ctx.beginPath();
    zs.forEach((z, i) => {
      const [px, py] = project(cam, shoreAt(z, -0.9), 0, z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const [px, py] = project(cam, shoreAt(z), lvl, z);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,222,236,0.22)';
    ctx.fill();

    // mare profondo
    const band = (o1, o2, fill) => {
      ctx.beginPath();
      zs.forEach((z, i) => {
        const [px, py] = project(cam, shoreAt(z, o1), lvl, z);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      if (o2 === null) {
        ctx.lineTo(W + 60, hy);
        ctx.lineTo(W + 60, H + 60);
      } else {
        for (let i = zs.length - 1; i >= 0; i--) {
          const z = zs[i];
          const [px, py] = project(cam, shoreAt(z, o2), lvl, z);
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const dg = ctx.createLinearGradient(0, hy, 0, H);
    dg.addColorStop(0, '#7eaecb');
    dg.addColorStop(0.05, '#3f86b0');
    dg.addColorStop(0.3, '#2a7aa0');
    dg.addColorStop(1, '#2a8c98');
    band(3.2, null, dg);
    const shallow = [
      [0, 0.25, 'rgba(120,190,190,0.22)'],
      [0.25, 0.7, 'rgba(90,175,180,0.36)'],
      [0.7, 1.4, 'rgba(70,160,172,0.52)'],
      [1.4, 2.3, 'rgba(55,145,165,0.68)'],
      [2.3, 3.25, 'rgba(45,130,160,0.85)'],
    ];
    for (const [a, b, c] of shallow) band(a, b, c);

    // onde lunghe parallele alla riva
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const off = 5 + k * 5 + ((t * 0.6) % 5);
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.04 * Math.sin(k + t)})`;
      ctx.beginPath();
      zs.forEach((z, i) => {
        const [px, py] = project(cam, shoreAt(z, off), lvl, z);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    // frangenti lontani
    const foamBand = (o1, o2, alpha, seed) => {
      if (alpha <= 0.01) return;
      ctx.beginPath();
      zs.forEach((z, i) => {
        const [px, py] = project(cam, shoreAt(z, o1 + 0.25 * (U.noise1(z * 0.3 + seed, 31) - 0.5)), lvl + 0.01, z);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      for (let i = zs.length - 1; i >= 0; i--) {
        const z = zs[i];
        const [px, py] = project(cam, shoreAt(z, o2 + 0.3 * (U.noise1(z * 0.23 + seed, 37) - 0.5)), lvl + 0.01, z);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(250,252,250,${alpha})`;
      ctx.fill();
    };
    foamBand(22, 23.2, 0.32 + 0.12 * Math.sin(t * 0.7), 3);
    foamBand(30, 30.6, 0.18, 7);
    // fronte dell'onda in arrivo
    if (world.boreX !== null) {
      const off = world.boreX - world.wx;
      if (world.boreI < 0.05) {
        // onda non ancora frangente: increspatura
        ctx.strokeStyle = 'rgba(20,70,95,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        zs.forEach((z, i) => {
          const [px, py] = project(cam, shoreAt(z, off), lvl, z);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else {
        foamBand(off + 0.15, off + 1.9, world.boreI * 0.22, 11);
        foamBand(off - 0.2, off + 0.4, world.boreI * 0.85, 13);
      }
    }
    // schiuma della risacca: bordo sottile e merletto di bollicine
    foamBand(1.2, 2.4, 0.06 + world.uprush * 0.2, 17);
    foamBand(0.4, 0.55, 0.22, 19);
    foamBand(-0.03, 0.035, 0.72, 23);
    const bub = new Path2D();
    const tick2 = Math.floor(t * 3);
    let zz = zs[0], row = 0;
    while (zz < 30) {
      const n = 12;
      for (let k = 0; k < n; k++) {
        const h1 = U.hash(row * 31 + k, tick2 + (k % 3));
        const u = Math.pow(U.hash(row * 17 + k, 5), 1.7);
        const z = zz + U.hash(k, row + 900) * 0.4;
        const x = shoreAt(z, -0.02 + u * (1.0 + world.uprush * 0.8));
        const d = z + cam.D;
        if (d < 0.25) continue;
        const r = (0.01 + h1 * h1 * 0.03) * cam.F / d;
        if (r < 0.6) continue;
        const px = cam.sx(x, z), py = cam.sy(lvl + 0.005, z);
        if (px < -r || px > W + r || py > H + r) continue;
        const ry = Math.max(0.5, r * (cam.camH / d) * 1.4);
        bub.moveTo(px + r, py);
        bub.ellipse(px, py, r, ry, 0, 0, Math.PI * 2);
      }
      zz += 0.25 + Math.max(0, zz) * 0.08;
      row++;
    }
    ctx.fillStyle = 'rgba(252,253,250,0.5)';
    ctx.fill(bub);

    // luccichii
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const tick = Math.floor(t * 6);
    for (let i = 0; i < 60; i++) {
      const z = 6 + U.hash(i, tick) * 260;
      const x = world.wx + 4 + WORLD.kz(z) + U.hash(i + 99, tick) * 60;
      const px = cam.sx(x, z), py = cam.sy(lvl, z);
      if (px < 0 || px > W || py < hy || py > H) continue;
      const s = Math.max(1, cam.scale(z) * 0.05);
      ctx.fillRect(px, py, s * 1.6, Math.max(1, s * 0.5));
    }
  }

  // dettagli del terreno: fossette, impronte, conchiglie
  R.groundDetails = function (ctx, cam, world) {
    const camH = cam.camH;
    const zBottom = -cam.D + camH * cam.F / (cam.H - cam.horizonY + 20);
    const dark = new Path2D(), light = new Path2D(), specks = new Path2D(), shells = new Path2D();
    let z = Math.max(-3.2, zBottom);
    let row = 0;
    while (z < 20) {
      const dz = z + cam.D;
      const halfW = (cam.W / 2) * dz / cam.F + 1;
      const step = 0.6;
      const i0 = Math.floor((cam.x - halfW) / step), i1 = Math.ceil((cam.x + halfW) / step);
      const prob = z < 4 ? 0.85 : 0.55;
      for (let i = i0; i <= i1; i++) {
        const h = U.hash(i, row * 7 + 1);
        if (h > prob) continue;
        const x = i * step + U.hash(i, row * 7 + 2) * step;
        const zz = z + U.hash(i, row * 7 + 3) * 0.3;
        if (x - WORLD.kz(zz) > world.wetX - 1.5 || x < WORLD.DUNE_X + WORLD.K_DUNE * zz + 0.5) continue;
        // vecchie impronte: ovali allungati e orientati a caso
        const hs = U.hash(i, row * 7 + 4);
        const len = 0.035 + hs * hs * 0.1;
        const wid = len * (0.45 + U.hash(i, row * 7 + 5) * 0.4);
        const ang = (U.hash(i, row * 7 + 6) - 0.5) * 2.4;
        const d = zz + cam.D;
        const px = cam.sx(x, zz), py = cam.sy(0, zz);
        const sc = cam.F / d, sq = camH / d * 1.6;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rx = Math.hypot(len * ca, wid * sa) * sc;
        const ry = Math.max(0.5, Math.hypot(len * sa, wid * ca) * sc * sq);
        if (rx < 0.7) continue;
        dark.moveTo(px - rx * 0.12 + rx, py - ry * 0.12);
        dark.ellipse(px - rx * 0.12, py - ry * 0.12, rx, ry, 0, 0, Math.PI * 2);
        light.moveTo(px + rx * 0.3 + rx * 0.55, py + ry * 0.15);
        light.ellipse(px + rx * 0.3, py + ry * 0.15, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2);
      }
      // granelli e conchiglie vicino alla camera
      if (z < 6) {
        const n = 26;
        for (let k = 0; k < n; k++) {
          const hx = U.hash(k, row * 13 + 5);
          const x = cam.x - halfW + hx * halfW * 2;
          const zz = z + U.hash(k, row * 13 + 6) * 0.3;
          const xi = Math.round(x * 3);
          const hh = U.hash(xi, row * 13 + 7);
          const xx = xi / 3 + hh * 0.2;
          if (xx - WORLD.kz(zz) > world.wetX - 1) continue;
          const d = zz + cam.D;
          const px = cam.sx(xx, zz), py = cam.sy(0, zz);
          const r = Math.max(0.6, (0.004 + hh * 0.006) * cam.F / d);
          if (hh > 0.93) {
            shells.moveTo(px + r * 2.2, py);
            shells.ellipse(px, py, r * 2.2, r * 1.2, hh * 3, 0, Math.PI * 2);
          } else {
            specks.rect(px, py, r, r * 0.7);
          }
        }
      }
      z += 0.32 + Math.max(0, z) * 0.06;
      row++;
    }
    ctx.fillStyle = 'rgba(160,126,84,0.22)';
    ctx.fill(dark);
    ctx.fillStyle = 'rgba(255,246,228,0.26)';
    ctx.fill(light);
    ctx.fillStyle = 'rgba(110,88,64,0.45)';
    ctx.fill(specks);
    ctx.fillStyle = 'rgba(250,244,236,0.9)';
    ctx.fill(shells);

    // impronte recenti (cane e umano)
    for (const f of world.footprints) {
      const a = U.clamp(1 - f.age / 45, 0, 1) * (f.wet ? 0.6 : 0.5);
      const d = f.z + cam.D;
      if (d < 0.3) continue;
      const px = cam.sx(f.x, f.z), py = cam.sy(world.groundH(f.x), f.z);
      if (px < -30 || px > cam.W + 30) continue;
      const len = f.kind === 'human' ? 0.27 : f.size;
      const rx = (len / 2) * cam.F / d;
      const ry = Math.max(0.6, (f.kind === 'human' ? 0.1 : f.size * 0.8) / 2 * cam.F / d * (camH / d) * 1.6);
      ctx.fillStyle = f.wet ? `rgba(110,84,52,${a})` : `rgba(150,116,74,${a})`;
      ctx.beginPath();
      ctx.ellipse(px - rx * 0.1, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,248,230,${a * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(px + rx * 0.3, py + ry * 0.2, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // telo da mare dell'umano (fantasia tropicale rosa come nella foto)
  R.towel = function (ctx, cam) {
    const x0 = -2.25, x1 = -0.55, z0 = -0.6, z1 = 1.55;
    const pts = [[x0, z0], [x1, z0 + 0.05], [x1 + 0.05, z1], [x0 + 0.02, z1 - 0.04]];
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      const px = cam.sx(x, z), py = cam.sy(0.004, z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = '#f4d7df';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // foglie stilizzate proiettate sul piano del telo
    for (let i = 0; i < 46; i++) {
      const fx = U.lerp(x0, x1, U.hash(i, 501));
      const fz = U.lerp(z0, z1, U.hash(i, 502));
      const d = fz + cam.D;
      const px = cam.sx(fx, fz), py = cam.sy(0.005, fz);
      const r = 0.13 * cam.F / d;
      const sq = cam.camH / d;
      const col = ['#d9467a', '#2b9a8c', '#7a2e5c', '#f08fb0', '#1f6f6a'][i % 5];
      ctx.fillStyle = col;
      ctx.beginPath();
      const a = U.hash(i, 503) * Math.PI * 2;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const ang = a + (t - 0.5) * 0.9;
        const rr = r * Math.sin(Math.PI * t) * 0.9 + r * 0.1;
        const xx = px + Math.cos(ang) * rr * (k % 2 ? 1 : 0.55);
        const yy = py + Math.sin(ang) * rr * sq * (k % 2 ? 1 : 0.55);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // bordo e piega
    ctx.strokeStyle = 'rgba(120,60,80,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      const px = cam.sx(x, z), py = cam.sy(0.004, z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  };

  // ---------- oggetti ----------
  function hz(col, z) { return U.mixColor(col, HAZE, 1 - Math.exp(-z / 140)); }

  R.props = function (ctx, cam, world, front) {
    for (const p of world.props) {
      if (front ? p.z >= 0 : p.z < 0) continue;
      const s = cam.scale(p.z);
      const px = cam.sx(p.x, p.z);
      if (px < -s * 4 || px > cam.W + s * 4) continue;
      const py = cam.sy(world.groundH(p.x), p.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(s, -s);
      DRAW[p.type] && DRAW[p.type](ctx, p, world, s);
      ctx.restore();
    }
  };

  const shadowEllipse = (ctx, cx, w, a) => {
    ctx.fillStyle = `rgba(80,60,40,${a})`;
    ctx.beginPath();
    ctx.ellipse(cx, 0.005, w, w * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  function personShape(ctx, p, t, z, lying) {
    const sk = hexRgb(p.skin), su = hexRgb(p.suit);
    const h = p.h || 1.7;
    const k = h / 1.75;
    if (lying) {
      ctx.fillStyle = hz(sk, z);
      ctx.beginPath();
      U.taper(ctx, -0.75 * k, 0.09, 0.07, 0.15, 0.1, 0.1);
      ctx.fill();
      ctx.beginPath();
      U.taper(ctx, 0.15, 0.1, 0.11, 0.62 * k, 0.1, 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.78 * k, 0.12, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hz(su, z);
      ctx.beginPath();
      ctx.ellipse(0.12, 0.12, 0.17, 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const walk = p.type === 'walker';
    const ph = p.ph || 0;
    const sw = walk ? Math.sin(ph * Math.PI) * 0.35 : 0;
    // gambe
    ctx.fillStyle = hz([sk[0] * 0.85, sk[1] * 0.85, sk[2] * 0.85], z);
    const hipY = 0.92 * k;
    for (const sgn of [-1, 1]) {
      const a = sw * sgn;
      ctx.beginPath();
      U.taper(ctx, 0, hipY, 0.075 * k, Math.sin(a) * 0.85 * k, 0.05, 0.045 * k);
      ctx.fill();
      ctx.fillStyle = hz(sk, z);
    }
    // busto
    ctx.fillStyle = hz(sk, z);
    ctx.beginPath();
    U.taper(ctx, 0, hipY, 0.13 * k, 0.01, hipY + 0.48 * k, 0.15 * k);
    ctx.fill();
    // costume
    ctx.fillStyle = hz(su, z);
    ctx.beginPath();
    ctx.ellipse(0, hipY - 0.02, 0.14 * k, 0.12 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    // braccia
    ctx.fillStyle = hz([sk[0] * 0.9, sk[1] * 0.9, sk[2] * 0.9], z);
    for (const sgn of [-1, 1]) {
      const a = walk ? -sw * sgn * 0.8 : 0.1 * sgn;
      ctx.beginPath();
      U.taper(ctx, 0.01, hipY + 0.42 * k, 0.045 * k, Math.sin(a) * 0.6 * k, hipY - 0.15 * k, 0.03 * k);
      ctx.fill();
    }
    // testa
    ctx.fillStyle = hz(sk, z);
    ctx.beginPath();
    ctx.arc(0.02, hipY + 0.66 * k, 0.11 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hz([50, 36, 28], z);
    ctx.beginPath();
    ctx.arc(0.0, hipY + 0.69 * k, 0.105 * k, 0.2, Math.PI + 0.3);
    ctx.fill();
  }

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const DRAW = {
    umbrella(ctx, p, world) {
      shadowEllipse(ctx, 0.4, 1.0, 0.18);
      ctx.save();
      ctx.rotate(p.tilt);
      ctx.strokeStyle = hz([230, 230, 225], p.z);
      ctx.lineWidth = 0.045;
      ctx.beginPath();
      ctx.moveTo(0, -0.1);
      ctx.lineTo(0, 2.25);
      ctx.stroke();
      // tela a spicchi
      const c1 = hexRgb(p.c1), c2 = hexRgb(p.c2);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a0 = -1.05 + (i / n) * 2.1, a1 = -1.05 + ((i + 1) / n) * 2.1;
        ctx.fillStyle = hz(i % 2 ? c1 : c2, p.z);
        ctx.beginPath();
        ctx.moveTo(0, 2.3);
        ctx.lineTo(Math.sin(a0) * 1.1, 2.3 - (1 - Math.cos(a0)) * 0.55 - 0.12);
        ctx.lineTo(Math.sin(a1) * 1.1, 2.3 - (1 - Math.cos(a1)) * 0.55 - 0.12);
        ctx.closePath();
        ctx.fill();
      }
      // ombreggiatura interna
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(0, 1.93, 0.95, 0.07, 0, 0, Math.PI);
      ctx.fill();
      ctx.restore();
    },
    towel(ctx, p, world) {
      ctx.fillStyle = hz(hexRgb(p.c), p.z);
      ctx.fillRect(-0.85, 0, 1.7, 0.03);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(-0.85, 0, 1.7, 0.012);
      if (p.person) {
        ctx.save();
        ctx.scale(p.flip, 1);
        personShape(ctx, p, world.t, p.z, true);
        ctx.restore();
      }
    },
    person(ctx, p, world) {
      shadowEllipse(ctx, 0.3, 0.35, 0.2);
      ctx.save();
      ctx.scale(p.facing, 1);
      personShape(ctx, p, world.t, p.z, false);
      ctx.restore();
    },
    walker(ctx, p, world) {
      shadowEllipse(ctx, 0.3, 0.35, 0.2);
      ctx.save();
      ctx.scale(p.dir, 1);
      personShape(ctx, p, world.t, p.z, false);
      ctx.restore();
    },
    bin(ctx, p) {
      shadowEllipse(ctx, 0.25, 0.4, 0.22);
      ctx.fillStyle = hz([150, 156, 160], p.z);
      ctx.beginPath();
      ctx.moveTo(-0.3, 0); ctx.lineTo(-0.34, 0.85); ctx.lineTo(0.34, 0.85); ctx.lineTo(0.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hz([120, 126, 130], p.z);
      ctx.fillRect(-0.37, 0.82, 0.74, 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-0.22, 0.05, 0.08, 0.75);
    },
    drift(ctx, p) {
      ctx.save();
      ctx.rotate(p.rot * 0.2);
      ctx.fillStyle = hz([168, 150, 128], p.z);
      ctx.beginPath();
      U.taper(ctx, -p.len / 2, 0.14, 0.14, p.len / 2, 0.1, 0.09);
      ctx.fill();
      ctx.strokeStyle = hz([130, 112, 92], p.z);
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(-p.len / 2 + 0.2, 0.16); ctx.lineTo(p.len / 2 - 0.2, 0.13);
      ctx.moveTo(p.len * 0.1, 0.18); ctx.lineTo(p.len * 0.3, 0.5); ctx.lineTo(p.len * 0.38, 0.58);
      ctx.stroke();
      ctx.restore();
    },
    sign(ctx, p) {
      shadowEllipse(ctx, 0.3, 0.6, 0.18);
      ctx.fillStyle = '#7a5a3c';
      ctx.fillRect(-0.04, 0, 0.08, 1.35);
      ctx.fillStyle = '#e9dcc2';
      ctx.fillRect(-0.62, 1.05, 1.24, 0.5);
      ctx.strokeStyle = '#6a4c32';
      ctx.lineWidth = 0.04;
      ctx.strokeRect(-0.62, 1.05, 1.24, 0.5);
      ctx.save();
      ctx.scale(0.01, -0.01);
      ctx.fillStyle = '#2b4c7e';
      ctx.font = '700 17px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPIAGGIA', 0, -131);
      ctx.fillText('PER CANI', 0, -112);
      ctx.restore();
    },
    tower(ctx, p) {
      shadowEllipse(ctx, 0.8, 1.2, 0.16);
      ctx.strokeStyle = hz([235, 235, 230], p.z);
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.moveTo(-0.6, 0); ctx.lineTo(-0.45, 2.0);
      ctx.moveTo(0.6, 0); ctx.lineTo(0.45, 2.0);
      ctx.moveTo(-0.55, 0.8); ctx.lineTo(0.55, 0.8);
      ctx.moveTo(-0.5, 1.5); ctx.lineTo(0.5, 1.5);
      ctx.stroke();
      ctx.fillStyle = hz([200, 40, 40], p.z);
      ctx.fillRect(-0.62, 2.0, 1.24, 0.9);
      ctx.fillStyle = hz([240, 240, 235], p.z);
      ctx.fillRect(-0.62, 2.3, 1.24, 0.25);
      ctx.fillStyle = hz([200, 40, 40], p.z);
      ctx.beginPath();
      ctx.moveTo(0, 3.5); ctx.lineTo(0.03, 2.9); ctx.lineTo(-0.03, 2.9); ctx.fill();
      ctx.fillRect(0, 3.25, 0.4 + Math.sin(OAV.now * 3) * 0.04, 0.22);
    },
    toys(ctx, p) {
      ctx.fillStyle = hz([60, 170, 210], p.z);
      ctx.beginPath(); ctx.ellipse(0, 0.18, 0.32, 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hz([240, 90, 140], p.z);
      ctx.beginPath(); ctx.ellipse(0.42, 0.1, 0.16, 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hz([250, 220, 60], p.z);
      ctx.fillRect(-0.55, 0, 0.18, 0.2);
    },
    bag(ctx, p) {
      shadowEllipse(ctx, 0.12, 0.28, 0.25);
      ctx.fillStyle = '#e9e1cf';
      ctx.beginPath();
      ctx.moveTo(-0.2, 0); ctx.lineTo(-0.23, 0.36); ctx.lineTo(0.23, 0.36); ctx.lineTo(0.2, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2c6fb0';
      ctx.fillRect(-0.22, 0.14, 0.44, 0.05);
      ctx.fillRect(-0.22, 0.24, 0.44, 0.05);
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(-0.13, 0.36); ctx.quadraticCurveTo(0, 0.56, 0.13, 0.36);
      ctx.stroke();
      // ossi che spuntano dalla borsa
      ctx.fillStyle = '#efe3c8';
      ctx.beginPath(); ctx.ellipse(-0.06, 0.39, 0.03, 0.04, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.05, 0.4, 0.03, 0.035, -0.4, 0, Math.PI * 2); ctx.fill();
    },
  };

  R.particles = function (ctx, cam, world) {
    for (const p of world.particles) {
      const d = p.z + cam.D;
      if (d < 0.3) continue;
      const px = cam.sx(p.x, p.z), py = cam.sy(p.y, p.z);
      const r = Math.max(0.7, p.size * cam.F / d);
      let col = p.color;
      if (!col) col = p.kind === 'sand' ? 'rgba(214,186,140,0.95)' : p.kind === 'drop' ? 'rgba(220,240,250,0.85)' : p.kind === 'foam' ? 'rgba(255,255,255,0.8)' : p.kind === 'crumb' ? 'rgba(196,150,96,1)' : 'rgba(255,255,255,0.8)';
      ctx.globalAlpha = U.clamp(p.life * 3, 0, 1);
      ctx.fillStyle = col;
      if (r < 1.6) ctx.fillRect(px - r / 2, py - r / 2, r, r);
      else { ctx.beginPath(); ctx.arc(px, py, r / 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  };

  // ombra morbida proiettata da un oggetto all'altezza h sul piano z
  R.shadow = function (ctx, cam, world, x, h, z, w, depth, strength = 0.35) {
    const sx = x + h * WORLD.SUN.sx;
    const sz = z + h * WORLD.SUN.sz;
    const d = sz + cam.D;
    if (d < 0.3) return;
    const gh = world.groundH(sx);
    const px = cam.sx(sx, sz), py = cam.sy(gh, sz);
    const spread = 1 + h * 0.6;
    const rx = Math.max(1, (w / 2) * spread * cam.F / d);
    const ry = Math.max(0.8, (depth / 2) * spread * cam.F / d * (cam.camH / d));
    const a = strength / (1 + h * 1.4);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(70,50,32,${a})`);
    g.addColorStop(0.6, `rgba(70,50,32,${a * 0.7})`);
    g.addColorStop(1, 'rgba(70,50,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // acqua che copre le zampe di chi sta nella battigia
  R.waterOver = function (ctx, cam, world, x, z, halfW) {
    const depth = world.depth(x);
    if (depth <= 0.003) return;
    const lvl = world.sea;
    const gh = world.groundH(x);
    const x0 = x - halfW, x1 = x + halfW;
    const yTop = cam.sy(lvl, z), yBot = cam.sy(gh - 0.02, z);
    const sx0 = cam.sx(x0, z), sx1 = cam.sx(x1, z);
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, 'rgba(90,170,180,0.55)');
    g.addColorStop(1, 'rgba(60,140,160,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(sx0, yTop, sx1 - sx0, yBot - yTop);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const s = cam.scale(z);
    ctx.fillRect(sx0, yTop - Math.max(1, s * 0.006), sx1 - sx0, Math.max(1.5, s * 0.012));
  };

  OAV.Camera = Camera;
  OAV.World = World;
})();
