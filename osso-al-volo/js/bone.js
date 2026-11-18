/* Osso al Volo — ossi: tipi, fisica del volo, rimbalzi sulla sabbia, galleggiamento */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const WORLD = OAV.WORLD;

  // Masse e misure realistiche di snack per cani
  const BONE_TYPES = (OAV.BONE_TYPES = {
    biscotto: { name: 'Biscotto a osso', len: 0.095, w: 0.034, eat: 0.85, pts: 50, cd: 0.022, look: 'biscuit' },
    pelle: { name: 'Osso di pelle', len: 0.15, w: 0.042, eat: 1.45, pts: 100, cd: 0.018, look: 'rawhide' },
    annodato: { name: 'Osso annodato', len: 0.205, w: 0.058, eat: 2.1, pts: 180, cd: 0.015, look: 'knot' },
    prosciutto: { name: 'Osso di prosciutto', len: 0.235, w: 0.06, eat: 2.7, pts: 300, cd: 0.012, look: 'ham' },
  });

  let NEXT_ID = 1;

  class Bone {
    constructor(type) {
      this.id = NEXT_ID++;
      this.type = type;
      this.def = BONE_TYPES[type];
      this.x = 0; this.y = 0; this.z = WORLD.HUMAN_Z;
      this.vx = 0; this.vy = 0;
      this.ang = 0; this.av = 0;
      this.state = 'hand'; // hand | flight | ground | water | held | gull | gone
      this.flightT = 0;
      this.groundT = 0;
      this.waterT = 0;
      this.bounces = 0;
      this.landed = false;
      this.tilt = U.rand(0.3, 0.7); // scorcio quando giace a terra
      this.lost = false;
    }

    launch(x, y, vx, vy, spin) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.av = spin;
      this.state = 'flight';
      this.flightT = 0;
      this.bounces = 0;
    }

    get half() { return this.def.w * 0.35; }

    update(dt, world, ev) {
      const s = this.state;
      if (s === 'flight') {
        this.flightT += dt;
        // gravità + resistenza dell'aria quadratica rispetto al vento
        const rvx = this.vx - world.wind, rvy = this.vy;
        const sp = Math.hypot(rvx, rvy);
        const k = this.def.cd;
        this.vx -= k * sp * rvx * dt;
        this.vy -= (U.G + k * sp * rvy) * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.ang += this.av * dt;
        // l'osso parte dalla mano (piano dell'umano) e scivola sul piano del cane
        this.z = U.damp(this.z, 0, 5, dt);
        const gh = world.groundH(this.x) + this.half;
        const inWater = this.x > world.wx && world.sea > world.groundH(this.x) + 0.01;
        if (inWater && this.y <= world.sea + this.half) {
          this.state = 'water';
          this.y = world.sea;
          this.vx *= 0.25; this.vy = 0; this.av *= 0.2;
          this.landed = true;
          ev && ev('splash', this);
        } else if (this.y <= gh && this.vy < 0) {
          const impact = -this.vy;
          this.landed = true;
          const wet = this.x > world.wetX - 0.3;
          ev && ev('impact', this, impact, wet);
          if (impact > 1.6 && this.bounces < 3) {
            this.bounces++;
            const rest = wet ? 0.12 : U.rand(0.16, 0.26);
            this.vy = impact * rest;
            this.vx *= wet ? 0.5 : U.rand(0.45, 0.62);
            this.av = -this.av * 0.35 + this.vx * U.rand(4, 10);
            this.y = gh;
          } else {
            this.y = gh;
            this.vy = 0;
            this.state = 'ground';
            this.groundT = 0;
          }
        }
        // la staccionata delle dune ferma l'osso dove il cane può arrivare
        if (this.x < WORLD.LEFT + 0.25) { this.x = WORLD.LEFT + 0.25; this.vx = Math.abs(this.vx) * 0.3; }
      } else if (s === 'ground') {
        this.groundT += dt;
        const mu = this.x > world.wetX ? 0.4 : 0.62;
        const dv = mu * U.G * dt;
        if (Math.abs(this.vx) <= dv) this.vx = 0; else this.vx -= Math.sign(this.vx) * dv;
        this.x += this.vx * dt;
        this.av = this.vx * 12;
        this.ang += this.av * dt;
        if (Math.abs(this.vx) < 0.05) {
          // si adagia di piatto
          const target = Math.round(this.ang / Math.PI) * Math.PI;
          this.ang = U.damp(this.ang, target, 10, dt);
        }
        if (this.x < WORLD.LEFT + 0.25) { this.x = WORLD.LEFT + 0.25; this.vx = 0; }
        this.y = world.groundH(this.x) + this.half;
        this.z = U.damp(this.z, 0, 5, dt);
        if (this.x > world.wx + 0.05) { this.state = 'water'; this.waterT = 0; }
      } else if (s === 'water') {
        this.waterT += dt;
        const depth = Math.max(0, world.sea - world.groundH(this.x));
        // trasportato dalla risacca, con lenta deriva verso il largo
        const drift = depth > 0.05 ? 0.3 : 0.08;
        const target = U.clamp(world.waterVel, -2.5, 2) * 0.55 + drift;
        this.vx = U.damp(this.vx, target, 2.5, dt);
        this.x += this.vx * dt;
        this.y = world.sea + 0.004 + Math.sin(world.t * 2.4 + this.id) * 0.006;
        this.ang += Math.sin(world.t * 1.3 + this.id) * 0.2 * dt;
        if (this.x < world.wx - 0.15) { this.state = 'ground'; this.groundT = 0; this.vx = 0; }
        if (this.x > WORLD.LOST_X) { this.state = 'gone'; this.lost = true; ev && ev('sea', this); }
      }
    }

    draw(ctx, cam, world) {
      if (this.state === 'gone' || this.state === 'held' || this.state === 'hand' || this.state === 'gull') return;
      const sx = cam.sx(this.x, this.z), sy = cam.sy(this.y, this.z), s = cam.scale(this.z);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s, -s);
      ctx.rotate(this.ang);
      const fore = this.state === 'flight' ? 1 : 0.92;
      drawBoneShape(ctx, this.def, fore, this.state === 'water');
      ctx.restore();
    }
  }

  // disegna l'osso centrato sull'origine, lungo l'asse x (metri)
  function drawBoneShape(ctx, def, fore = 1, wet = false) {
    const L = def.len * fore, w = def.w;
    const look = def.look;
    ctx.save();
    if (look === 'ham') {
      // osso di prosciutto: diafisi lunga, testa articolare grande, residui di carne
      const shaft = w * 0.42;
      ctx.fillStyle = '#e8dcc2';
      ctx.beginPath();
      U.taper(ctx, -L * 0.36, 0, shaft * 0.62, L * 0.3, 0, shaft * 0.5);
      ctx.fill();
      ctx.fillStyle = '#e2d2b0';
      ctx.beginPath();
      ctx.ellipse(-L * 0.4, 0.004, w * 0.5, w * 0.44, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(L * 0.38, w * 0.12, w * 0.3, w * 0.24, -0.3, 0, Math.PI * 2);
      ctx.ellipse(L * 0.4, -w * 0.14, w * 0.27, w * 0.22, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // carne e grasso rimasti
      ctx.fillStyle = '#b5523f';
      ctx.beginPath();
      ctx.ellipse(-L * 0.18, w * 0.12, w * 0.4, w * 0.2, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0d6c2';
      ctx.beginPath();
      ctx.ellipse(-L * 0.24, w * 0.2, w * 0.18, w * 0.08, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8e3a2c';
      ctx.beginPath();
      ctx.ellipse(-L * 0.1, w * 0.05, w * 0.16, w * 0.08, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,96,64,0.6)';
      ctx.lineWidth = 0.002;
      ctx.beginPath();
      ctx.moveTo(-L * 0.05, -shaft * 0.3); ctx.lineTo(L * 0.25, -shaft * 0.28);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const knobR = look === 'biscuit' ? w * 0.3 : look === 'knot' ? w * 0.34 : w * 0.31;
    const shaftH = look === 'biscuit' ? w * 0.5 : w * 0.42;
    const ex = L / 2 - knobR;
    const base = look === 'biscuit' ? '#c58b4b' : '#efe3c6';
    const dark = look === 'biscuit' ? '#97602c' : '#d6c39a';
    // contorno unico: diafisi + quattro nodi
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.rect(-ex, -shaftH / 2, ex * 2, shaftH);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.moveTo(sx * ex + knobR, sy * knobR * 0.78);
        ctx.arc(sx * ex, sy * knobR * 0.78, knobR, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    if (look === 'biscuit') {
      // bordo cotto e forellini
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      ctx.moveTo(-ex, -shaftH / 2); ctx.lineTo(ex, -shaftH / 2);
      ctx.stroke();
      ctx.fillStyle = '#8a5526';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * ex * 0.32, 0.002 * (i % 2), 0.0017, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,220,170,0.35)';
      ctx.fillRect(-ex, shaftH * 0.1, ex * 2, shaftH * 0.22);
    } else {
      // pelle pressata: torsioni e nodi
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.0022;
      ctx.beginPath();
      const n = look === 'knot' ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const x = -ex + ((i + 0.5) / n) * ex * 2;
        ctx.moveTo(x - shaftH * 0.25, -shaftH / 2);
        ctx.quadraticCurveTo(x + shaftH * 0.1, 0, x + shaftH * 0.25, shaftH / 2);
      }
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * ex - knobR * 0.6, 0);
        ctx.lineTo(sx * ex + knobR * 0.5 * sx, 0.001);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(-ex, shaftH * 0.12, ex * 2, shaftH * 0.16);
    }
    if (wet) {
      ctx.fillStyle = 'rgba(60,120,140,0.25)';
      ctx.fillRect(-L / 2, -shaftH, L, shaftH * 0.9);
    }
    ctx.restore();
  }

  OAV.Bone = Bone;
  OAV.drawBoneShape = drawBoneShape;
})();
