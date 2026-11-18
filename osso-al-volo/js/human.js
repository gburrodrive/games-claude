/* Osso al Volo — l'umano che lancia: scheletro, keyframe del lancio, disegno */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const WORLD = OAV.WORLD;
  const TAU = Math.PI * 2;

  // Proporzioni di un adulto di circa 1,80 m (metri)
  const B = { thigh: 0.46, shin: 0.45, ankle: 0.075, torso: 0.5, ua: 0.3, fa: 0.27, hand: 0.085 };
  const PROPS = ['px', 'py', 'lean', 'head', 'nA', 'nF', 'fA', 'fF', 'nX', 'nY', 'fX', 'fY'];
  const IDLE = { px: 0, py: 0.972, lean: 0.03, head: 0.0, nA: 0.25, nF: 1.2, fA: 0.1, fF: 0.35, nX: -0.07, nY: 0, fX: 0.09, fY: 0 };
  const K = (t, o) => Object.assign({ t }, IDLE, o);

  // Angoli dei bracci misurati dalla verticale verso il basso, positivi in avanti.
  // Il braccio che lancia percorre: indietro-basso → caricamento dietro la testa → sopra la testa → avanti-basso.
  const ANIMS = {
    overhand: {
      dur: 1.6, release: 0.5, keys: [
        K(0.0, { head: 0.05 }),
        K(0.2, { px: -0.05, py: 0.93, lean: -0.04, head: 0.12, nA: -0.9, nF: 0.3, fA: 0.6, fF: 0.5, fX: 0.24, fY: 0.07 }),
        K(0.34, { px: -0.03, py: 0.92, lean: -0.15, head: 0.18, nA: -2.15, nF: -0.95, fA: 1.45, fF: 0.2, fX: 0.44, fY: 0.05 }),
        K(0.44, { px: 0.09, py: 0.9, lean: -0.04, head: 0.16, nA: -2.85, nF: 0.5, fA: 1.1, fF: 0.6, fX: 0.54 }),
        K(0.5, { px: 0.17, py: 0.9, lean: 0.16, head: 0.12, nA: -3.55, nF: -0.2, fA: 0.4, fF: 1.4, nY: 0.02, fX: 0.54 }),
        K(0.62, { px: 0.24, py: 0.87, lean: 0.4, head: -0.02, nA: -4.75, nF: -0.3, fA: -0.3, fF: 1.0, nX: -0.08, nY: 0.05, fX: 0.54 }),
        K(0.8, { px: 0.27, py: 0.9, lean: 0.3, head: 0.05, nA: -5.75, nF: 0.35, fA: -0.1, fF: 0.5, nX: 0.22, nY: 0.07, fX: 0.54 }),
        K(0.95, { px: 0.28, py: 0.94, lean: 0.12, head: 0.05, nA: -5.95, nF: 0.4, fA: 0.05, nX: 0.32, fX: 0.54 }),
        K(1.2, { px: 0.16, py: 0.94, lean: 0.05, head: 0.05, nA: -6.05, nF: 0.4, nX: 0.32, fX: 0.3, fY: 0.06 }),
        K(1.4, { px: 0.06, head: 0.05, nA: -6.05, nF: 0.4, nX: 0.08, nY: 0.06 }),
        K(1.6, { nA: -6.03, nF: 0.4 }),
      ],
    },
    underhand: {
      dur: 1.0, release: 0.42, keys: [
        K(0.0, {}),
        K(0.24, { px: -0.03, py: 0.9, lean: 0.14, head: 0.1, nA: -0.85, nF: 0.15, fA: 0.4, fF: 0.6, fX: 0.26, fY: 0.04 }),
        K(0.42, { px: 0.08, py: 0.9, lean: 0.12, head: 0.12, nA: 0.8, nF: 0.15, fA: 0.2, fF: 0.8, fX: 0.34 }),
        K(0.55, { px: 0.12, py: 0.92, lean: 0.06, head: 0.12, nA: 1.7, nF: 0.25, fA: 0.1, fF: 0.6, nY: 0.02, fX: 0.34 }),
        K(0.8, { px: 0.06, py: 0.94, lean: 0.04, head: 0.05, nA: 0.6, nF: 0.4, fX: 0.24, fY: 0.05 }),
        K(1.0, { nF: 0.4 }),
      ],
    },
    fake: {
      dur: 1.35, keys: [
        K(0.0, { head: 0.05 }),
        K(0.2, { px: -0.05, py: 0.93, lean: -0.04, head: 0.12, nA: -0.9, nF: 0.3, fA: 0.6, fF: 0.5, fX: 0.24, fY: 0.07 }),
        K(0.34, { px: -0.03, py: 0.92, lean: -0.15, head: 0.18, nA: -2.15, nF: -0.95, fA: 1.45, fF: 0.2, fX: 0.44, fY: 0.05 }),
        K(0.47, { px: 0.08, py: 0.91, lean: 0.03, head: 0.15, nA: -2.95, nF: -0.35, fA: 1.0, fF: 0.6, fX: 0.5 }),
        K(0.62, { px: 0.1, py: 0.92, lean: 0.0, head: 0.1, nA: -3.05, nF: -0.6, fA: 0.8, fF: 0.6, fX: 0.5 }),
        K(0.92, { px: 0.08, py: 0.93, lean: 0.04, head: 0.02, nA: -3.0, nF: -0.55, fA: 0.5, fF: 0.6, fX: 0.5 }),
        K(1.12, { px: 0.04, py: 0.94, nA: -5.2, nF: 0.9, fX: 0.3, fY: 0.05 }),
        K(1.35, { nA: -6.03, nF: 1.2 }),
      ],
    },
    cheer: {
      dur: 1.25, keys: [
        K(0.0, { nF: 0.4 }),
        K(0.18, { py: 0.97, lean: -0.05, head: 0.22, nA: 2.85, nF: 0.15, fA: 2.95, fF: 0.2 }),
        K(0.45, { py: 0.93, lean: -0.02, head: 0.2, nA: 2.6, nF: 0.3, fA: 2.7, fF: 0.25 }),
        K(0.7, { py: 0.97, lean: -0.05, head: 0.22, nA: 2.85, nF: 0.15, fA: 2.95, fF: 0.2 }),
        K(1.25, { nF: 0.4 }),
      ],
    },
    pat: {
      dur: 1.0, keys: [
        K(0.0, {}),
        K(0.15, { lean: 0.22, head: -0.25, nA: 0.05, nF: 0.3, py: 0.93 }),
        K(0.3, { lean: 0.24, head: -0.25, nA: 0.38, nF: 0.3, py: 0.93 }),
        K(0.45, { lean: 0.22, head: -0.25, nA: 0.05, nF: 0.3, py: 0.93 }),
        K(0.6, { lean: 0.24, head: -0.25, nA: 0.38, nF: 0.3, py: 0.93 }),
        K(0.75, { lean: 0.2, head: -0.2, nA: 0.1, nF: 0.4, py: 0.94 }),
        K(1.0, {}),
      ],
    },
    laugh: {
      dur: 1.0, keys: [
        K(0.0, {}),
        K(0.15, { lean: -0.1, head: 0.3 }),
        K(0.3, { lean: 0.12, head: 0.05 }),
        K(0.45, { lean: -0.06, head: 0.28 }),
        K(0.6, { lean: 0.1, head: 0.05 }),
        K(1.0, {}),
      ],
    },
  };

  function reachAnim(behind) {
    return {
      dur: 0.95, grab: 0.5, keys: behind ? [
        K(0.0, { nF: 0.4 }),
        K(0.35, { py: 0.7, lean: 0.25, head: -0.35, nA: -0.55, nF: 0.15, nX: -0.18, fX: 0.2 }),
        K(0.55, { py: 0.7, lean: 0.25, head: -0.3, nA: -0.6, nF: 0.2, nX: -0.18, fX: 0.2 }),
        K(0.95, {}),
      ] : [
        K(0.0, { nF: 0.4 }),
        K(0.35, { py: 0.8, lean: 0.62, head: -0.5, nA: 0.45, nF: 0.1, fA: 0.3, nX: -0.16, fX: 0.18 }),
        K(0.55, { py: 0.8, lean: 0.62, head: -0.45, nA: 0.5, nF: 0.15, fA: 0.3, nX: -0.16, fX: 0.18 }),
        K(0.95, {}),
      ],
    };
  }

  const SKIN = '#d7a07c', SKIN_FAR = '#b98161', SKIN_SH = '#b77d5c';
  const SHORTS = '#17616f', SHORTS_FAR = '#0f4752';

  class Human {
    constructor(world, sfx) {
      this.world = world;
      this.sfx = sfx;
      this.x = WORLD.HUMAN_X;
      this.z = WORLD.HUMAN_Z;
      this.facing = 1;
      this.turnFrom = 1;
      this.turnT = 1;
      this.anim = null;
      this.t = 0;
      this.hasBone = false;
      this.boneDef = null;
      this.lookAt = null;
      this.pose = Object.assign({}, IDLE);
      this.sk = {};
      this.lastStep = [0, 0];
      this.update(0);
    }

    get busy() { return !!this.anim; }
    get animName() { return this.anim ? this.anim.name : null; }

    play(name, cb, events) {
      const def = name === 'reachBehind' ? reachAnim(true) : name === 'reachFront' ? reachAnim(false) : ANIMS[name];
      this.anim = { name, def, t: 0, cb, events: events || {}, fired: {} };
    }

    face(dir) {
      if (dir === this.facing) return;
      this.turnFrom = this.facing;
      this.facing = dir;
      this.turnT = 0;
      // passo di rotazione: impronte nuove
      this.world.addFootprint(this.x - 0.1, this.z - 0.08, 'human', 0, 0.27);
    }

    handWorld() {
      const h = this.sk.hand;
      return [this.x + this.facing * h[0], h[1]];
    }

    update(dt) {
      this.t += dt;
      if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / 0.28);
      let pose;
      const a = this.anim;
      if (a) {
        a.t += dt;
        pose = {};
        for (const p of PROPS) pose[p] = U.keyInterp(a.def.keys, a.t, p);
        if (a.def.release !== undefined && a.t >= a.def.release && !a.fired.release) {
          a.fired.release = true;
          this.computeSkeleton(pose);
          a.events.release && a.events.release();
        }
        if (a.def.grab !== undefined && a.t >= a.def.grab && !a.fired.grab) {
          a.fired.grab = true;
          a.events.grab && a.events.grab();
        }
        if (a.t >= a.def.dur) {
          this.anim = null;
          a.cb && a.cb();
        }
      } else {
        pose = Object.assign({}, IDLE);
        const br = Math.sin(this.t * 1.6);
        pose.lean += br * 0.008;
        pose.py += br * 0.003;
        pose.nF = this.hasBone ? 1.2 : 0.4;
        pose.nA = this.hasBone ? 0.25 : 0.12 + Math.sin(this.t * 0.7) * 0.03;
        pose.fA = 0.08 + Math.sin(this.t * 0.6 + 1) * 0.02;
      }
      // la testa segue il cane o l'osso
      if (this.lookAt) {
        const hx = this.x + this.facing * 0.05, hy = 1.68;
        const dx = Math.abs(this.lookAt[0] - hx);
        const dy = this.lookAt[1] - hy;
        const want = U.clamp(Math.atan2(dy, Math.max(0.6, dx)) * 0.8, -0.45, 0.45);
        pose.head = U.lerp(pose.head, want, a ? 0.4 : 0.85);
      }
      this.pose = pose;
      this.computeSkeleton(pose);
      // impronte quando un piede si appoggia
      for (const [k, key] of [[0, 'nY'], [1, 'fY']]) {
        const lifted = pose[key] > 0.02;
        if (!lifted && this.lastStep[k]) {
          const fx = k === 0 ? pose.nX : pose.fX;
          this.world.addFootprint(this.x + this.facing * (fx + 0.07), this.z + (k ? 0.1 : -0.1), 'human', 0, 0.27);
        }
        this.lastStep[k] = lifted;
      }
    }

    computeSkeleton(p) {
      const sk = this.sk;
      const lean = p.lean;
      const pel = [p.px, p.py];
      const R = (x, y) => U.rot(x, y, -lean);
      const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
      const tor = add(pel, R(0, B.torso));
      const sh = add(tor, R(-0.012, -0.065));
      const hip = add(pel, R(0.0, -0.02));
      sk.lean = lean; sk.pel = pel; sk.tor = tor; sk.sh = sh; sk.hip = hip;
      // gambe (IK, ginocchio in avanti)
      const footPitch = (y, x) => (y > 0.005 ? (x < p.px ? -0.5 : -0.2) * U.clamp(y / 0.06, 0, 1) : 0);
      const legs = [];
      for (const [fx, fy] of [[p.nX, p.nY], [p.fX, p.fY]]) {
        const fp = footPitch(fy, fx);
        const ank = [fx, fy + B.ankle];
        const r = U.ik2(hip[0], hip[1], ank[0], ank[1], B.thigh, B.shin, 1);
        legs.push({ hip, knee: [r[0], r[1]], ank: [r[2], r[3]], fp });
      }
      sk.legs = legs;
      // braccia (angoli assoluti)
      const arm = (s, a, f) => {
        const el = [s[0] + Math.sin(a) * B.ua, s[1] - Math.cos(a) * B.ua];
        const a2 = a + f;
        const wr = [el[0] + Math.sin(a2) * B.fa, el[1] - Math.cos(a2) * B.fa];
        const a3 = a2 + 0.12;
        const hd = [wr[0] + Math.sin(a3) * B.hand * 0.6, wr[1] - Math.cos(a3) * B.hand * 0.6];
        return { sh: s, el, wr, hand: hd, a2, a3 };
      };
      sk.nArm = arm(sh, p.nA, p.nF);
      sk.fArm = arm(add(sh, [0.02, 0.012]), p.fA, p.fF);
      sk.hand = sk.nArm.hand;
      // collo e testa
      const nt = add(tor, R(0.02, 0.07));
      sk.neckTop = nt;
      const hrot = -lean * 0.5 + p.head;
      const hc = add(nt, U.rot(0.012, 0.105, hrot));
      sk.hc = hc; sk.hrot = hrot;
    }

    // ---------- disegno ----------
    draw(ctx, cam) {
      const sx = cam.sx(this.x, this.z), sy = cam.sy(this.world.groundH(this.x), this.z), s = cam.scale(this.z);
      let fx = this.facing;
      if (this.turnT < 1) {
        const c = Math.cos(Math.PI * this.turnT);
        fx = this.turnFrom * Math.sign(c || 1) * Math.max(0.3, Math.abs(c));
      }
      const sk = this.sk;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s * fx, -s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawArm(ctx, sk.fArm, SKIN_FAR, true);
      this.drawLeg(ctx, sk.legs[1], SKIN_FAR, SHORTS_FAR, true);
      this.drawTorso(ctx);
      this.drawLeg(ctx, sk.legs[0], SKIN, SHORTS, false);
      this.drawHead(ctx);
      this.drawArm(ctx, sk.nArm, SKIN, false);
      ctx.restore();
    }

    drawLeg(ctx, L, skin, shorts, far) {
      const [hx, hy] = L.hip, [kx, ky] = L.knee, [ax, ay] = L.ank;
      ctx.fillStyle = skin;
      ctx.beginPath();
      U.taper(ctx, hx, hy, 0.083, kx, ky, 0.058);
      U.taper(ctx, kx, ky, 0.054, ax, ay, 0.036);
      // polpaccio
      const nx = ax - kx, ny = ay - ky;
      U.taper(ctx, kx + nx * 0.18 - 0.016, ky + ny * 0.18, 0.06, kx + nx * 0.6 - 0.008, ky + ny * 0.6, 0.042);
      ctx.fill();
      // piede
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(L.fp);
      ctx.beginPath();
      ctx.moveTo(-0.055, -0.01);
      ctx.quadraticCurveTo(-0.07, -0.07, -0.03, -0.075);
      ctx.lineTo(0.17, -0.075);
      ctx.quadraticCurveTo(0.2, -0.07, 0.19, -0.045);
      ctx.quadraticCurveTo(0.12, -0.03, 0.04, 0.01);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (!far) {
        // peli sulle gambe e luce
        ctx.strokeStyle = 'rgba(70,45,30,0.14)';
        ctx.lineWidth = 0.0025;
        ctx.beginPath();
        for (let i = 0; i < 18; i++) {
          const t = 0.1 + (i / 18) * 0.8;
          const px = U.lerp(kx, ax, t) + 0.03 - (i % 4) * 0.012, py = U.lerp(ky, ay, t);
          ctx.moveTo(px, py);
          ctx.lineTo(px + 0.006, py - 0.012);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,225,200,0.35)';
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(kx + 0.04, ky - 0.02);
        ctx.lineTo(ax + 0.03, ay + 0.03);
        ctx.stroke();
      }
      // gamba dei pantaloncini
      const tx = kx - hx, ty = ky - hy, tl = Math.hypot(tx, ty);
      const ux = tx / tl, uy = ty / tl;
      const ex = hx + ux * 0.25, ey = hy + uy * 0.25;
      ctx.fillStyle = shorts;
      ctx.beginPath();
      ctx.moveTo(hx - uy * 0.105 - ux * 0.04, hy + ux * 0.105 - uy * 0.04);
      ctx.lineTo(ex - uy * 0.088, ey + ux * 0.088);
      ctx.lineTo(ex + uy * 0.088, ey - ux * 0.088);
      ctx.lineTo(hx + uy * 0.105 - ux * 0.04, hy - ux * 0.105 - uy * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.008;
      ctx.beginPath();
      ctx.moveTo(ex - uy * 0.088, ey + ux * 0.088);
      ctx.lineTo(ex + uy * 0.088, ey - ux * 0.088);
      ctx.stroke();
    }

    drawTorso(ctx) {
      const sk = this.sk;
      ctx.save();
      ctx.translate(sk.pel[0], sk.pel[1]);
      ctx.rotate(-sk.lean);
      // busto di profilo
      const pts = [[0.11, 0.0], [0.122, 0.12], [0.128, 0.22], [0.125, 0.33], [0.085, 0.43], [0.04, 0.505], [-0.035, 0.51], [-0.095, 0.45], [-0.112, 0.33], [-0.09, 0.19], [-0.115, 0.05], [-0.12, -0.04]];
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      U.smoothPath(ctx, pts, true);
      ctx.fill();
      ctx.save();
      ctx.clip();
      const g = ctx.createLinearGradient(-0.12, 0, 0.13, 0);
      g.addColorStop(0, 'rgba(120,70,40,0.35)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(255,220,190,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(-0.2, -0.1, 0.4, 0.7);
      ctx.strokeStyle = 'rgba(140,85,55,0.35)';
      ctx.lineWidth = 0.006;
      ctx.beginPath();
      ctx.moveTo(0.122, 0.3); ctx.quadraticCurveTo(0.09, 0.27, 0.06, 0.3); // pettorale
      ctx.moveTo(0.11, 0.17); ctx.quadraticCurveTo(0.1, 0.12, 0.112, 0.08);
      ctx.stroke();
      ctx.restore();
      // pantaloncini da bagno: vita, glutei e cavallo
      ctx.fillStyle = SHORTS;
      ctx.beginPath();
      U.smoothPath(ctx, [[0.118, 0.09], [0.13, 0.0], [0.11, -0.085], [0.0, -0.11], [-0.12, -0.085], [-0.145, -0.01], [-0.128, 0.09]], true);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-0.006, -0.1, 0.011, 0.19);
      ctx.strokeStyle = '#0b3c46';
      ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.moveTo(-0.127, 0.084); ctx.lineTo(0.117, 0.084); ctx.stroke();
      ctx.strokeStyle = '#f2efe6';
      ctx.lineWidth = 0.005;
      ctx.beginPath(); ctx.moveTo(0.1, 0.078); ctx.quadraticCurveTo(0.112, 0.035, 0.098, 0.005); ctx.stroke();
      ctx.restore();
    }

    drawHead(ctx) {
      const sk = this.sk;
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      U.taper(ctx, sk.tor[0], sk.tor[1] - 0.02, 0.06, sk.neckTop[0], sk.neckTop[1], 0.054);
      ctx.fill();
      ctx.save();
      ctx.translate(sk.hc[0], sk.hc[1]);
      ctx.rotate(sk.hrot);
      // cranio e profilo del viso
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(-0.012, 0.012, 0.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      U.smoothPath(ctx, [[0.07, 0.07], [0.092, 0.03], [0.098, 0.012], [0.122, -0.026], [0.104, -0.038], [0.107, -0.054], [0.099, -0.064], [0.103, -0.076], [0.092, -0.104], [0.04, -0.12], [-0.03, -0.075], [-0.02, 0.04]], true);
      ctx.fill();
      // barba corta
      ctx.fillStyle = 'rgba(60,40,30,0.16)';
      ctx.beginPath();
      U.smoothPath(ctx, [[0.09, -0.07], [0.094, -0.1], [0.04, -0.118], [-0.02, -0.08], [-0.005, -0.05], [0.05, -0.06]], true);
      ctx.fill();
      // orecchio
      ctx.fillStyle = SKIN_SH;
      ctx.beginPath(); ctx.ellipse(-0.02, -0.005, 0.022, 0.034, 0.1, 0, TAU); ctx.fill();
      // capelli corti scuri
      ctx.fillStyle = '#2c1f17';
      ctx.beginPath();
      U.smoothPath(ctx, [[0.078, 0.068], [0.05, 0.1], [-0.02, 0.115], [-0.09, 0.08], [-0.113, 0.01], [-0.095, -0.04], [-0.055, -0.035], [-0.05, 0.03], [0.0, 0.07]], true);
      ctx.fill();
      // occhiali da sole
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0.052, -0.002, 0.05, 0.03, 0.01); else ctx.rect(0.052, -0.002, 0.05, 0.03);
      ctx.fill();
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(0.055, 0.02); ctx.lineTo(-0.012, 0.012); ctx.stroke();
      ctx.fillStyle = 'rgba(120,170,220,0.45)';
      ctx.fillRect(0.075, 0.016, 0.02, 0.008);
      // bocca e naso
      ctx.strokeStyle = 'rgba(110,60,45,0.7)';
      ctx.lineWidth = 0.004;
      ctx.beginPath();
      const smile = this.anim && (this.anim.name === 'cheer' || this.anim.name === 'laugh') ? 0.008 : 0;
      ctx.moveTo(0.09, -0.066); ctx.quadraticCurveTo(0.075, -0.07 - smile, 0.065, -0.064);
      ctx.stroke();
      ctx.restore();
    }

    drawArm(ctx, A, skin, far) {
      ctx.fillStyle = skin;
      ctx.beginPath();
      U.taper(ctx, A.sh[0], A.sh[1], 0.052, A.el[0], A.el[1], 0.038);
      U.taper(ctx, A.el[0], A.el[1], 0.037, A.wr[0], A.wr[1], 0.026);
      // bicipite e avambraccio
      U.taper(ctx, U.lerp(A.sh[0], A.el[0], 0.3), U.lerp(A.sh[1], A.el[1], 0.3), 0.05, U.lerp(A.sh[0], A.el[0], 0.75), U.lerp(A.sh[1], A.el[1], 0.75), 0.042);
      U.taper(ctx, U.lerp(A.el[0], A.wr[0], 0.1), U.lerp(A.el[1], A.wr[1], 0.1), 0.04, U.lerp(A.el[0], A.wr[0], 0.5), U.lerp(A.el[1], A.wr[1], 0.5), 0.032);
      ctx.fill();
      // mano
      ctx.save();
      ctx.translate(A.wr[0], A.wr[1]);
      ctx.rotate(A.a3 - Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0.045, 0.0, 0.05, 0.028, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0.02, 0.026, 0.025, 0.013, 0.6, 0, TAU);
      ctx.fill();
      if (!far && this.hasBone && this.boneDef) {
        ctx.save();
        ctx.translate(0.05, 0.0);
        ctx.rotate(Math.PI / 2 - 0.3);
        OAV.drawBoneShape(ctx, this.boneDef, 1, false);
        ctx.restore();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.ellipse(0.055, -0.01, 0.03, 0.022, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      if (!far) {
        // braccialetti al polso (come nella foto)
        const dx = A.wr[0] - A.el[0], dy = A.wr[1] - A.el[1], dl = Math.hypot(dx, dy);
        const ux = dx / dl, uy = dy / dl;
        const cols = ['#d1d5d8', '#c7303a', '#d8b24e', '#aeb3b7'];
        cols.forEach((c, i) => {
          const t = 0.03 + i * 0.016;
          const cx = A.wr[0] - ux * t, cy = A.wr[1] - uy * t;
          ctx.strokeStyle = c;
          ctx.lineWidth = i === 1 ? 0.007 : 0.0055;
          ctx.beginPath();
          ctx.moveTo(cx - uy * 0.03, cy + ux * 0.03);
          ctx.lineTo(cx + uy * 0.03, cy - ux * 0.03);
          ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(70,45,30,0.25)';
        ctx.lineWidth = 0.003;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const t = 0.25 + i * 0.07;
          const px = U.lerp(A.el[0], A.wr[0], t) - uy * 0.02, py = U.lerp(A.el[1], A.wr[1], t) + ux * 0.02;
          ctx.moveTo(px, py);
          ctx.lineTo(px + ux * 0.02, py + uy * 0.02);
        }
        ctx.stroke();
      }
    }
  }

  OAV.Human = Human;
})();
