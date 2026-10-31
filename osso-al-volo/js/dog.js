/* Osso al Volo — il cagnolino: andature biomeccaniche, IK delle zampe, pose, disegno */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const WORLD = OAV.WORLD;
  const TAU = Math.PI * 2;

  // Anatomia (metri) di un meticcio piccolo tipo pinscher/chihuahua: ~31 cm al garrese
  const ANAT = {
    shoulder: [0.138, 0.228],
    hip: [-0.152, 0.24],
    fL: [0.095, 0.112, 0.036], // omero, radio-ulna, metacarpo
    hL: [0.108, 0.118, 0.066], // femore, tibia, metatarso
    neckBase: [0.148, 0.296],
    neckLen: 0.098,
    tailBase: [-0.206, 0.284],
  };
  // ordine zampe: 0 anteriore sinistra (vicina), 1 anteriore destra (lontana), 2 posteriore sinistra, 3 posteriore destra
  const NEUTRAL = [0.15, 0.144, -0.176, -0.184];
  const STAND_D = [0.18, 0.15, 0.06, 0.04];

  // profilo del corpo: [x, y, segmento] 0 = treno anteriore, 1 = centro, 2 = treno posteriore
  const BODY = [
    [0.196, 0.236, 0], [0.184, 0.19, 0], [0.13, 0.151, 0], [0.05, 0.149, 1], [-0.04, 0.166, 1],
    [-0.105, 0.193, 2], [-0.15, 0.205, 2], [-0.2, 0.21, 2], [-0.226, 0.246, 2], [-0.214, 0.282, 2],
    [-0.176, 0.301, 2], [-0.095, 0.306, 1], [0.0, 0.304, 1], [0.098, 0.318, 0], [0.138, 0.33, 0],
  ];
  // pettorina a gilet (rossa con profili riflettenti, come nella foto)
  const HARNESS = [
    [0.028, 0.35], [0.116, 0.345], [0.142, 0.318], [0.17, 0.284], [0.196, 0.252],
    [0.24, 0.215], [0.24, 0.11], [0.032, 0.11], [0.02, 0.23],
  ];
  const HEAD = [[-0.04, -0.022], [-0.051, 0.006], [-0.036, 0.04], [0.0, 0.051], [0.03, 0.041], [0.0463, 0.021], [0.067, 0.012], [0.085, 0.009], [0.0922, -0.004], [0.0877, -0.02], [0.0634, -0.027], [0.034, -0.027], [0.0, -0.031]];
  const JAW = [[0.012, -0.022], [0.04, -0.028], [0.0706, -0.029], [0.0796, -0.034], [0.0742, -0.041], [0.049, -0.043], [0.02, -0.04], [-0.004, -0.034]];

  // Andature canine (tempi di appoggio nel ciclo): passo laterale, trotto diagonale, galoppo rotatorio
  const GAITS = [
    { off: [0.25, 0.75, 0.0, 0.5], duty: 0.64, lift: 0.028, fold: 0.45 },
    { off: [0.5, 0.0, 0.0, 0.5], duty: 0.45, lift: 0.042, fold: 0.7 },
    { off: [0.53, 0.42, 0.0, 0.1], duty: 0.28, lift: 0.06, fold: 1.0 },
  ];

  const C = {
    coat: '#241a15', far: '#110b09', farHind: '#130d0a',
    white: '#f4f0e9', whiteShade: '#d8d0c4',
    harness: '#cf1f2e', harnessDark: '#8f121d', pipe: '#c3c9ce', pipeHi: '#f0f3f5',
    nose: '#0c0909', mouth: '#6b2633', tongue: '#e0768a', teeth: '#f7f3ea',
  };

  let MESH = null;
  function meshPattern(ctx) {
    if (MESH) return MESH;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 6;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(70,0,8,0.55)';
    c.beginPath(); c.arc(1.5, 1.5, 1.1, 0, TAU); c.fill();
    c.beginPath(); c.arc(4.5, 4.5, 1.1, 0, TAU); c.fill();
    MESH = ctx.createPattern(cv, 'repeat');
    try { MESH.setTransform(new DOMMatrix([0.0012, 0, 0, 0.0012, 0, 0])); } catch (e) { /* vecchi browser */ }
    return MESH;
  }

  // ciuffi di pelo (posizioni fisse nel corpo)
  const HAIR = [];
  for (let i = 0; i < 70; i++) {
    HAIR.push([U.lerp(-0.22, 0.2, U.hash(i, 1)), U.lerp(0.15, 0.33, U.hash(i, 2)), U.lerp(-0.4, 0.3, U.hash(i, 3))]);
  }

  function newPose() {
    return {
      bob: 0, pitch: 0, pivotX: 0, ext: 0, neck: 1, head: -0.2, tail: 0.8,
      legs: [0, 1, 2, 3].map(() => ({ x: 0, y: 0, d: 0, pa: 0, st: false })),
    };
  }
  function blendPose(P, Q, w) {
    if (w <= 0.0001) return;
    if (w > 1) w = 1;
    P.bob += (Q.bob - P.bob) * w;
    P.pitch += (Q.pitch - P.pitch) * w;
    P.pivotX += (Q.pivotX - P.pivotX) * w;
    P.ext += (Q.ext - P.ext) * w;
    P.neck += (Q.neck - P.neck) * w;
    P.head += (Q.head - P.head) * w;
    P.tail += (Q.tail - P.tail) * w;
    for (let k = 0; k < 4; k++) {
      const a = P.legs[k], b = Q.legs[k];
      a.x += (b.x - a.x) * w;
      a.y += (b.y - a.y) * w;
      a.d += (b.d - a.d) * w;
      a.pa += (b.pa - a.pa) * w;
      if (w > 0.5) a.st = b.st;
    }
  }
  function setLegs(Q, arr) {
    for (let k = 0; k < 4; k++) {
      const [x, y, d, pa] = arr[k];
      Q.legs[k].x = x; Q.legs[k].y = y; Q.legs[k].d = d; Q.legs[k].pa = pa || 0; Q.legs[k].st = y < 0.005;
    }
  }

  class Dog {
    constructor(world, sfx) {
      this.world = world;
      this.sfx = sfx;
      this.P = newPose();
      this.Q = newPose();
      this.reset(1.7);
    }

    reset(x) {
      this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
      this.facing = -1; this.turnFrom = -1; this.turnT = 1;
      this.mode = 'free'; this.modeT = 0;
      this.onGround = true;
      this.phase = 0; this.g = 0; this.freq = 2; this.speed = 0;
      this.stamina = 1; this.exhausted = false;
      this.sitW = 1; this.lieW = 0; this.pickW = 0; this.airW = 0; this.crouchW = 0; this.landW = 0; this.skidW = 0;
      this.skidding = false;
      this.barkT = 9; this.barkCD = 0;
      this.neckAng = 1.2; this.headAng = -0.1; this.jaw = 0; this.tongue = 0.2;
      this.earA = 0; this.earV = 0;
      this.tail = new Array(7).fill(0).map(() => ({ a: -0.9, v: 0 }));
      this.wag = 0.4; this.wagPh = 0;
      this.idleT = 2;
      this.bone = null; this.pickBone = null;
      this.eatT = 0; this.eatDur = 1; this.chewPh = 0; this.chewN = 0;
      this.catchInfo = null;
      this.look = null; this.snap = null;
      this.prevSt = [false, false, false, false];
      this.blinkT = 2;
      this.lastSplash = 0;
      this.happyT = 0;
      this.dist = 0; this.maxSpeed = 0;
      this.jumpHoldT = 0;
      this.nearHuman = true;
      this.baseY = 0;
      this.sk = null;
      this.computePose(0);
    }

    get busy() { return this.mode === 'eat' || this.mode === 'pickup'; }
    get eating() { return this.mode === 'eat'; }

    mouthWorld() {
      const m = this.sk.mouth;
      return [this.x + this.facing * m[0], this.baseY + m[1]];
    }
    headWorld() {
      const h = this.sk.hc;
      return [this.x + this.facing * h[0], this.baseY + h[1]];
    }

    bark(game) {
      if (this.barkCD > 0 || this.mode === 'eat') return false;
      this.barkCD = 0.42;
      this.barkT = 0;
      this.sfx.bark(U.rand(0.96, 1.06), Math.random() < 0.35);
      if (game) game.onBark(this);
      return true;
    }

    startPickup(bone) {
      this.mode = 'pickup';
      this.modeT = 0;
      this.pickBone = bone;
      bone.state = 'held';
    }

    takeBone(bone, info) {
      this.bone = bone;
      bone.state = 'held';
      this.catchInfo = info;
      this.sfx.chomp();
      this.happyT = 1.2;
      if (this.world.depth(this.x) > 0.03 || !this.onGround) {
        if (this.mode !== 'air') { this.mode = 'free'; this.modeT = 0; }
      } else {
        this.startEat();
      }
    }

    startEat() {
      this.mode = 'eat';
      this.modeT = 0;
      this.eatT = 0;
      this.eatDur = this.bone.def.eat;
      this.chewN = 0;
    }

    update(dt, inp, game) {
      const w = this.world;
      this.modeT += dt;
      this.barkCD -= dt;
      this.barkT += dt;
      this.happyT -= dt;
      this.blinkT -= dt;
      if (this.blinkT < -0.12) this.blinkT = U.rand(2, 5);
      if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / 0.17);
      const depth = w.depth(this.x);
      this.depth = depth;

      if (inp.bark) this.bark(game);

      this.skidding = false;
      const m = this.mode;
      if (m === 'eat') this.updateEat(dt, inp, game);
      else if (m === 'pickup') {
        this.vx = U.damp(this.vx, Math.sign(this.vx) * Math.min(Math.abs(this.vx), 1.2), 10, dt);
        if (this.modeT > 0.2) {
          const b = this.pickBone;
          this.pickBone = null;
          this.mode = 'free';
          this.takeBone(b, game.pickupInfo(b));
        }
      } else if (m === 'crouch') {
        this.vx *= 1 - 3 * dt;
        if (this.modeT > 0.075) {
          this.mode = 'air';
          this.modeT = 0;
          this.vy = 3.05 + 0.25 * Math.min(Math.abs(this.vx) / 7, 1);
          this.onGround = false;
          this.jumpHoldT = 0;
          this.stamina = Math.max(0, this.stamina - 0.035);
          w.burst('sand', this.x - this.facing * 0.15, w.groundH(this.x), 0, 6, { dir: -this.facing, speed: 1.2, up: 0.8 });
        }
      } else if (m === 'air') {
        const holding = inp.jumpHeld && this.jumpHoldT < 0.2 && this.vy > 0;
        this.jumpHoldT += dt;
        this.vy -= U.G * (holding ? 0.42 : 1) * dt;
        if (inp.dir) this.vx = U.clamp(this.vx + inp.dir * 2.4 * dt, -7.5, 7.5);
        this.y += this.vy * dt;
        if (this.y <= 0 && this.vy < 0) this.land(game);
      } else {
        this.updateFree(dt, inp, game);
      }

      // spostamento e limiti
      this.x += this.vx * dt;
      if (this.x < WORLD.LEFT) { this.x = WORLD.LEFT; this.vx = Math.max(0, this.vx); }
      const lim = w.dogLimit();
      if (this.x > lim) { this.x = U.damp(this.x, lim, 6, dt); this.vx = Math.min(this.vx, 0); }
      this.baseY = w.groundH(this.x) + this.y;
      const spd = Math.abs(this.vx);
      this.dist += spd * dt;
      if (this.onGround) this.maxSpeed = Math.max(this.maxSpeed, spd);

      // resistenza: lo scatto stanca un cane piccolo in pochi secondi
      let drain;
      if (this.mode === 'eat') drain = -0.24;
      else if (spd > 5.3) drain = 0.075 + 0.17 * ((spd - 5.3) / 1.7);
      else if (spd > 3.4) drain = 0.022;
      else drain = this.sitW > 0.5 ? -0.17 : -0.11;
      this.stamina = U.clamp(this.stamina - drain * dt, 0, 1);
      if (this.stamina <= 0.02) this.exhausted = true;
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;

      // andatura
      const gSpd = this.onGround ? spd : this.speed;
      this.speed = U.damp(this.speed, gSpd, 12, dt);
      const s = this.speed;
      this.g = U.smooth(0.95, 1.45, s) + U.smooth(3.0, 3.7, s);
      const fw = 1.3 + 1.1 * s, ft = 2.5 + 0.35 * (s - 1), fg = 3.25 + 0.24 * (s - 3);
      this.freq = this.g < 1 ? U.lerp(fw, ft, this.g) : U.lerp(ft, fg, this.g - 1);
      if (this.onGround && !this.skidding && s > 0.03 && this.mode !== 'eat') this.phase = U.wrap01(this.phase + this.freq * dt);

      // pesi delle pose
      const near = game ? game.dogNearHuman() : true;
      this.nearHuman = near;
      if (this.mode === 'free' && this.onGround && spd < 0.06 && !inp.dir && !this.bone) this.idleT += dt; else this.idleT = 0;
      const sitT = this.idleT > 0.6 && near ? 1 : 0;
      this.sitW = U.damp(this.sitW, sitT, sitT ? 5 : 14, dt);
      this.lieW = U.damp(this.lieW, this.mode === 'eat' ? 1 : 0, this.mode === 'eat' ? 8 : 7, dt);
      this.pickW = U.damp(this.pickW, this.mode === 'pickup' ? 1 : 0, 22, dt);
      this.airW = U.damp(this.airW, this.mode === 'air' ? 1 : 0, this.mode === 'air' ? 14 : 22, dt);
      this.crouchW = U.damp(this.crouchW, this.mode === 'crouch' ? 1 : 0, 40, dt);
      this.skidW = U.damp(this.skidW, this.skidding ? 1 : 0, 16, dt);
      this.landW = Math.max(0, this.landW - dt * 7);

      // ansimare
      const pantNeed = U.clamp(1.1 - this.stamina * 1.2 + (s > 3 ? 0.25 : 0), 0, 1);
      this.tongue = U.damp(this.tongue, this.mode === 'eat' ? 0 : pantNeed, 3, dt);
      if (this.stamina < 0.45 && s < 2 && this.mode !== 'eat') this.sfx.pant(1 - this.stamina);

      this.computePose(dt);
      this.updateTail(dt);
      this.footfalls(game);
    }

    updateFree(dt, inp, game) {
      const w = this.world;
      const dir = inp.dir;
      let maxV = inp.slow ? 1.0 : inp.sprint && !this.exhausted ? 7.0 : 5.0;
      if (this.exhausted) maxV = Math.min(maxV, 3.0);
      if (this.bone) maxV = Math.min(maxV, 4.2);
      if (this.depth > 0) maxV *= U.clamp(1 - this.depth / 0.24, 0.22, 1);
      // da seduto o sdraiato serve un attimo per alzarsi
      const rising = this.sitW > 0.35 || this.lieW > 0.35;

      if (dir !== 0 && dir !== this.facing) {
        if (Math.abs(this.vx) > 1.3) {
          this.skidding = true;
          this.vx -= Math.sign(this.vx) * 15 * dt;
          if (Math.random() < 0.6) w.burst('sand', this.x + this.facing * 0.22, w.groundH(this.x), -0.03, 2, { dir: this.facing, speed: 2.2, up: 0.5 });
        } else if (this.turnT >= 1) {
          this.turnFrom = this.facing;
          this.facing = dir;
          this.turnT = 0;
          this.vx *= 0.3;
        }
      }
      if (!this.skidding) {
        let target = dir === this.facing ? dir * maxV : 0;
        if (rising || this.turnT < 0.6) target = 0;
        const accel = Math.abs(target) > Math.abs(this.vx) && (Math.sign(target) === Math.sign(this.vx) || this.vx === 0);
        const a = accel ? 9.5 * (1 - Math.abs(this.vx) / 9) + 1.6 : dir === 0 ? 8.5 : 11;
        const dv = target - this.vx;
        this.vx += U.clamp(dv, -a * dt, a * dt);
        if (!accel && Math.abs(this.vx) > 3 && dir === 0 && Math.random() < 0.25) {
          w.burst('sand', this.x + this.facing * 0.2, w.groundH(this.x), -0.03, 1, { dir: this.facing, speed: 1.4, up: 0.4 });
        }
      }
      if (inp.jump && this.turnT >= 1 && !rising) {
        this.mode = 'crouch';
        this.modeT = 0;
      }
      // con l'osso in bocca, appena fuori dall'acqua si sdraia a mangiarlo
      if (this.bone && this.depth < 0.005 && this.onGround && this.mode === 'free' && (Math.abs(this.vx) < 2.2 || dir === 0)) {
        this.startEat();
      }
    }

    land(game) {
      const impact = -this.vy;
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
      this.mode = 'free';
      this.modeT = 0;
      this.landW = 1;
      const w = this.world;
      const gh = w.groundH(this.x);
      for (const k of [0, 1]) {
        const L = this.sk.legs[k];
        w.addFootprint(this.x + this.facing * L.P[0], k ? 0.05 : -0.05, 'dog', 0, 0.05);
      }
      if (w.depth(this.x) > 0.01) {
        w.burst('drop', this.x, w.sea, 0, 14, { speed: 1.8, up: 1.4, size: 0.012 });
        this.sfx.splash(0.7);
      } else {
        w.burst('sand', this.x + this.facing * 0.15, gh, 0, 8 + Math.round(impact * 2), { speed: 1.2, up: 0.7 });
        this.sfx.thud(0.25 + impact * 0.05);
      }
      if (game && impact > 3.2) game.cam.shake = Math.min(0.6, impact * 0.08);
      // se aveva preso l'osso in volo, ora lo mangia
      if (this.bone && this.mode === 'free' && w.depth(this.x) < 0.03) this.startEat();
    }

    updateEat(dt, inp, game) {
      this.vx = U.damp(this.vx, 0, 9, dt);
      if (this.lieW < 0.7) return;
      let rate = 1;
      if (inp.mash) this.eatT += 0.11;
      this.eatT += dt * rate;
      const prev = this.chewPh;
      this.chewPh += dt * TAU * 3.1;
      if (Math.floor(prev / TAU) !== Math.floor(this.chewPh / TAU)) {
        this.chewN++;
        this.sfx.crunch(0.7 + Math.random() * 0.4);
        const [mx, my] = this.mouthWorld();
        this.world.burst('crumb', mx, my, -0.02, 2 + ((Math.random() * 3) | 0), { speed: 0.6, up: 0.8, size: 0.006, color: this.bone && this.bone.def.look === 'biscuit' ? 'rgba(170,110,60,1)' : 'rgba(225,205,165,1)' });
      }
      if (this.eatT >= this.eatDur) {
        const b = this.bone;
        this.bone = null;
        this.mode = 'free';
        this.modeT = 0;
        b.state = 'gone';
        this.happyT = 1.5;
        if (game) game.onEaten(b, this.catchInfo);
        this.catchInfo = null;
      }
    }

    // ---------- posa e scheletro ----------
    computePose(dt) {
      const P = this.P, Q = this.Q;
      const s = this.speed, g = this.g;
      const gi = Math.min(1, Math.floor(g)), gt = Math.min(1, g - gi);
      const G0 = GAITS[gi], G1 = GAITS[gi + 1];
      let duty = U.lerp(G0.duty, G1.duty, gt);
      if (g > 1) duty = U.lerp(duty, U.lerp(0.3, 0.22, U.smooth(3.7, 7, s)), g - 1);
      const lift = U.lerp(G0.lift, G1.lift, gt);
      const fold = U.lerp(G0.fold, G1.fold, gt);
      const L = s / Math.max(0.5, this.freq);
      const stand = 1 - U.smooth(0.05, 0.5, s);
      const gw = U.clamp(g - 1, 0, 1), tw = U.clamp(1 - Math.abs(g - 1), 0, 1), ww = U.clamp(1 - g, 0, 1);
      const ph = this.phase;
      const mv = 1 - stand;

      for (let k = 0; k < 4; k++) {
        const front = k < 2;
        const off = U.phaseLerp(G0.off[k], G1.off[k], gt);
        const p = U.wrap01(ph - off);
        let x, y, d, pa, st;
        if (p < duty) {
          const u = p / duty;
          x = L * duty * (0.5 - u);
          y = 0;
          d = front ? U.lerp(0.15, -0.55, u * u) : U.lerp(0.1, -0.42, u);
          pa = 0;
          st = true;
        } else {
          const u = (p - duty) / (1 - duty);
          const e = u * u * (3 - 2 * u);
          x = L * duty * (-0.5 + e);
          y = lift * Math.pow(Math.sin(Math.PI * u), 0.85) * (front ? 1 : 0.85);
          if (front) d = U.lerp(-0.55, 0.2, u) - 1.7 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.3) * fold;
          else d = U.lerp(-0.42, 0.12, u) - 0.55 * Math.sin(TAU * u) * fold;
          pa = d * 0.55;
          st = false;
        }
        const leg = P.legs[k];
        leg.x = U.lerp(NEUTRAL[k] + x, NEUTRAL[k], stand);
        leg.y = y * mv;
        leg.d = U.lerp(d, STAND_D[k], stand);
        leg.pa = pa * mv;
        leg.st = st && mv > 0.5;
      }
      P.bob = (ww * 0.004 * Math.cos(TAU * 2 * (ph - 0.1)) + tw * 0.007 * Math.cos(TAU * 2 * (ph - 0.47)) + gw * (0.013 * Math.cos(TAU * 2 * (ph - 0.37)) - 0.012)) * mv;
      P.pitch = (gw * 0.07 * Math.sin(TAU * (ph - 0.12)) + tw * 0.008 * Math.sin(TAU * 2 * ph)) * mv;
      P.ext = gw * -Math.cos(TAU * ph) * mv;
      P.pivotX = 0;
      P.neck = U.lerp(U.lerp(1.02, 0.86, U.clamp(g, 0, 1)), 0.58, gw) + gw * 0.07 * Math.sin(TAU * (ph + 0.1)) * mv;
      P.head = U.lerp(-0.2, -0.3, U.clamp(g / 2, 0, 1));
      P.tail = U.lerp(0.75, 0.22, gw);

      // frenata: zampe anteriori puntate in avanti
      if (this.skidW > 0.01) {
        Q.bob = -0.02; Q.pitch = 0.07; Q.pivotX = 0; Q.ext = 0.3; Q.neck = 0.95; Q.head = -0.1; Q.tail = 0.6;
        setLegs(Q, [[0.27, 0, 0.55], [0.25, 0, 0.5], [-0.12, 0, 0.3], [-0.14, 0, 0.25]]);
        blendPose(P, Q, this.skidW);
      }
      // in volo: zampe raccolte in salita, protese in discesa
      if (this.airW > 0.01) {
        const vy = this.vy;
        const u = U.clamp(0.5 - vy / 5, 0, 1);
        const pitch = U.clamp(vy * 0.11, -0.35, 0.42);
        Q.bob = 0; Q.pitch = pitch; Q.pivotX = 0; Q.ext = U.lerp(0.6, -0.2, u);
        Q.neck = 0.95; Q.head = -0.1; Q.tail = 0.45;
        const air = [
          [U.lerp(0.17, 0.25, u), U.lerp(0.12, 0.015, u), U.lerp(-1.7, 0.25, u)],
          [U.lerp(0.15, 0.235, u), U.lerp(0.125, 0.03, u), U.lerp(-1.6, 0.2, u)],
          [U.lerp(-0.36, -0.13, u), U.lerp(0.06, 0.04, u), U.lerp(-0.7, 0.5, u)],
          [U.lerp(-0.34, -0.15, u), U.lerp(0.07, 0.05, u), U.lerp(-0.6, 0.45, u)],
        ];
        for (let k = 0; k < 4; k++) {
          const [ax, ay, d] = air[k];
          const [rx, ry] = U.rot(ax, ay - 0.23, pitch);
          Q.legs[k].x = rx; Q.legs[k].y = ry + 0.23; Q.legs[k].d = d; Q.legs[k].pa = d * 0.6; Q.legs[k].st = false;
        }
        blendPose(P, Q, this.airW);
      }
      // seduto
      if (this.sitW > 0.01) {
        Q.bob = 0.012; Q.pitch = 0.62; Q.pivotX = 0.13; Q.ext = 0; Q.neck = 1.28; Q.head = -0.12; Q.tail = -0.55;
        setLegs(Q, [[0.156, 0, 0.12], [0.147, 0, 0.1], [-0.02, 0, 1.45, 0], [-0.032, 0, 1.45, 0]]);
        blendPose(P, Q, this.sitW);
      }
      // sdraiato a sfinge per mangiare
      if (this.lieW > 0.01) {
        const chew = this.mode === 'eat' ? Math.sin(this.chewPh) : 0;
        Q.bob = -0.125; Q.pitch = 0.02; Q.pivotX = 0; Q.ext = 0;
        Q.neck = -0.12 + chew * 0.05; Q.head = -0.62 + chew * 0.08; Q.tail = -0.25;
        setLegs(Q, [[0.3, 0, 1.5, 0], [0.288, 0, 1.5, 0], [-0.03, 0, 1.45, 0], [-0.046, 0, 1.45, 0]]);
        blendPose(P, Q, this.lieW);
      }
      // raccolta da terra
      if (this.pickW > 0.01) {
        Q.bob = -0.022; Q.pitch = -0.12; Q.pivotX = 0; Q.ext = -0.2; Q.neck = -0.6; Q.head = -1.15; Q.tail = 0.7;
        setLegs(Q, [[0.19, 0, 0.3], [0.17, 0, 0.25], [-0.17, 0, 0.1], [-0.19, 0, 0.05]]);
        blendPose(P, Q, this.pickW);
      }
      P.bob -= 0.04 * this.crouchW + 0.032 * this.landW;
      P.pitch += 0.06 * this.crouchW;

      // trasformazione del corpo (flessione della colonna + beccheggio)
      const ext = P.ext;
      const piv = P.pivotX;
      const T = (x, y, tag) => {
        if (tag === 0) x += ext * 0.02;
        else if (tag === 2) x -= ext * 0.02;
        else y += Math.max(0, -ext) * 0.012;
        const [rx, ry] = U.rot(x - piv, y - 0.23, P.pitch);
        return [piv + rx, 0.23 + ry + P.bob];
      };
      const sk = this.sk || (this.sk = { legs: [{}, {}, {}, {}] });
      sk.T = T;
      sk.pitch = P.pitch;
      sk.body = BODY.map(([x, y, t]) => T(x, y, t));
      sk.harness = HARNESS.map(([x, y]) => T(x, y, 0));
      const jF = T(ANAT.shoulder[0], ANAT.shoulder[1], 0);
      const jH = T(ANAT.hip[0], ANAT.hip[1], 2);
      sk.jF = jF; sk.jH = jH;
      for (let k = 0; k < 4; k++) {
        const front = k < 2, far = k % 2 === 1;
        const J = front ? jF : jH;
        const jx = J[0] - (far ? 0.008 : 0), jy = J[1] + (far ? 0.006 : 0);
        const lg = P.legs[k];
        const lens = front ? ANAT.fL : ANAT.hL;
        const pjx = lg.x - 0.004, pjy = lg.y + 0.013;
        const cx = pjx - lens[2] * Math.sin(lg.d), cy = pjy + lens[2] * Math.cos(lg.d);
        const r = U.ik2(jx, jy, cx, cy, lens[0], lens[1], front ? -1 : 1);
        const dx = r[2] - cx, dy = r[3] - cy;
        const o = sk.legs[k];
        o.J = [jx, jy]; o.M = [r[0], r[1]]; o.C = [r[2], r[3]];
        o.PJ = [pjx + dx, pjy + dy]; o.P = [lg.x + dx, lg.y + dy];
        o.pa = lg.pa; o.d = lg.d; o.st = lg.st;
      }

      // testa: sguardo verso il bersaglio e scatto per afferrare l'osso
      const nb = T(ANAT.neckBase[0], ANAT.neckBase[1], 0);
      sk.nb = nb;
      let neckT = P.neck, headT = P.head;
      const lookW = this.mode === 'eat' || this.mode === 'pickup' ? 0 : U.lerp(0.9, 0.3, gw) * (1 - this.lieW);
      const baseY = this.world.groundH(this.x) + this.y;
      if (this.look && lookW > 0) {
        const tx = (this.look[0] - this.x) * this.facing - nb[0];
        const ty = this.look[1] - baseY - nb[1] - 0.06;
        let th = Math.atan2(ty, tx);
        if (tx < 0) th = U.clamp(Math.atan2(ty, 0.05), -0.3, 1.0);
        const hd = U.clamp(th - P.pitch, -1.0, 0.85);
        headT = U.lerp(headT, hd, lookW);
        neckT += U.clamp(th, -0.25, 0.9) * 0.35 * lookW;
      }
      let snapping = false;
      if (this.snap && this.mode !== 'eat') {
        const tx = (this.snap[0] - this.x) * this.facing - nb[0];
        const ty = this.snap[1] - baseY - nb[1];
        if (tx > -0.04) {
          const th = Math.atan2(ty, tx);
          neckT = U.clamp(th - P.pitch * 0.6 + 0.12, -0.75, 1.75);
          headT = U.clamp(th - 0.2, -1.25, 1.3);
          snapping = true;
        }
      }
      const rate = snapping ? 30 : 12;
      if (dt > 0) {
        this.neckAng = U.damp(this.neckAng, neckT, rate, dt);
        this.headAng = U.damp(this.headAng, headT, rate, dt);
      } else { this.neckAng = neckT; this.headAng = headT; }
      if (this.barkT < 0.18) {
        const b = Math.sin((this.barkT / 0.18) * Math.PI);
        this.neckAng += b * 0.12;
        this.headAng += b * 0.18;
      }
      const na = this.neckAng + P.pitch * 0.6;
      const hc = [nb[0] + Math.cos(na) * ANAT.neckLen, nb[1] + Math.sin(na) * ANAT.neckLen];
      const ha = this.headAng + P.pitch * 0.3;
      sk.hc = hc; sk.headA = ha;
      const mo = U.rot(0.075, -0.03, ha);
      sk.mouth = [hc[0] + mo[0], hc[1] + mo[1]];
      sk.tailBase = T(ANAT.tailBase[0], ANAT.tailBase[1], 2);
      sk.tailDir = P.tail;

      // mascella
      let jawT = 0.04 + this.tongue * 0.3 + Math.sin(this.world.t * 9) * 0.04 * this.tongue;
      if (this.bone && this.mode !== 'eat') jawT = 0.28;
      if (this.mode === 'eat') jawT = 0.12 + 0.38 * Math.max(0, Math.sin(this.chewPh));
      if (snapping) {
        const d = Math.hypot((this.snap[0] - this.x) * this.facing - sk.mouth[0], this.snap[1] - baseY - sk.mouth[1]);
        jawT = d < 0.45 ? 1 : jawT;
      }
      if (this.mode === 'pickup') jawT = this.modeT < 0.12 ? 0.9 : 0.3;
      if (this.barkT < 0.14) jawT = 0.85;
      this.jaw = dt > 0 ? U.damp(this.jaw, jawT, 28, dt) : jawT;

      // orecchie a rosa: si appiattiscono in corsa e rimbalzano
      if (dt > 0) {
        const earT = 0.2 + U.clamp(s / 7, 0, 1) * 0.25 - (this.look && s < 1 ? 0.14 : 0) + (this.mode === 'air' ? 0.12 : 0);
        const bounce = (P.bob - (this.prevBob || 0)) / dt;
        this.prevBob = P.bob;
        this.earV += ((earT - this.earA) * 260 - this.earV * 14 - bounce * 9) * dt;
        this.earA += this.earV * dt;
        this.earA = U.clamp(this.earA, -0.35, 0.75);
      }
      this.baseY = baseY;
    }

    updateTail(dt) {
      if (dt <= 0) return;
      const happy = this.mode === 'eat' ? 1 : this.happyT > 0 ? 1 : this.sitW > 0.5 ? 0.75 : this.speed < 1 ? 0.45 : 0.12;
      this.wag = U.damp(this.wag, happy, 3, dt);
      this.wagPh += dt * TAU * (5 + happy * 3);
      const base = this.sk.tailDir;
      const curl = this.sitW > 0.5 || this.lieW > 0.5 ? -0.02 : 0.11;
      let prev = base;
      for (let i = 0; i < this.tail.length; i++) {
        const seg = this.tail[i];
        const target = (i === 0 ? base : prev + curl) + (this.lieW > 0.5 || this.sitW > 0.5 ? 0 : Math.sin(this.wagPh - i * 0.5) * 0.07 * this.wag);
        seg.v += ((target - seg.a) * 320 - seg.v * 20) * dt;
        seg.a += seg.v * dt;
        prev = seg.a;
      }
    }

    footfalls(game) {
      const w = this.world;
      const moving = this.onGround && this.speed > 0.25 && this.mode !== 'eat' && this.sitW < 0.4;
      for (let k = 0; k < 4; k++) {
        const L = this.sk.legs[k];
        const st = moving && L.st;
        if (st && !this.prevSt[k]) {
          const wx = this.x + this.facing * L.P[0];
          const z = k % 2 === 0 ? -0.05 : 0.05;
          if (this.depth > 0.01) {
            if (w.t - this.lastSplash > 0.08) {
              w.burst('drop', wx, w.sea, z, 5, { speed: 1 + this.speed * 0.2, up: 1.2, size: 0.01 });
              this.lastSplash = w.t;
              if (Math.random() < 0.3) this.sfx.splash(0.25);
            }
          } else {
            w.addFootprint(wx, z, 'dog', 0, 0.045);
            if (this.g > 1.6 && k >= 2) w.burst('sand', wx, w.groundH(wx), z, 3, { dir: -this.facing, speed: 1.0 + this.speed * 0.15, up: 0.55 });
          }
        }
        this.prevSt[k] = st;
      }
    }

    // ---------- disegno ----------
    draw(ctx, cam) {
      const sk = this.sk;
      if (!sk) return;
      const sx = cam.sx(this.x, 0), sy = cam.sy(this.baseY, 0), s = cam.scale(0);
      let fx = this.facing;
      if (this.turnT < 1) {
        const c = Math.cos(Math.PI * this.turnT);
        fx = this.turnFrom * Math.sign(c || 1) * Math.max(0.22, Math.abs(c));
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s * fx, -s);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      this.drawLeg(ctx, sk.legs[3], false, C.farHind, true, false);
      this.drawLeg(ctx, sk.legs[1], true, C.far, true, false);
      this.drawTail(ctx);
      this.withHead(ctx, () => this.drawEar(ctx, true));
      this.drawBody(ctx);
      this.drawLeg(ctx, sk.legs[2], false, C.coat, false, false);
      this.drawLeg(ctx, sk.legs[0], true, C.coat, false, true);
      if (this.mode === 'eat' && this.bone) this.drawEatingBone(ctx);
      this.withHead(ctx, () => this.drawHead(ctx));
      if (this.bone && this.mode !== 'eat') this.drawCarriedBone(ctx);
      ctx.restore();
    }

    withHead(ctx, fn) {
      const sk = this.sk;
      ctx.save();
      ctx.translate(sk.hc[0], sk.hc[1]);
      ctx.rotate(sk.headA);
      fn();
      ctx.restore();
    }

    drawLeg(ctx, L, front, color, far, lowerOnly) {
      const [jx, jy] = L.J, [mx, my] = L.M, [cx, cy] = L.C, [px, py] = L.PJ, [fx, fy] = L.P;
      ctx.fillStyle = color;
      if (front) {
        ctx.beginPath();
        if (!lowerOnly) U.taper(ctx, jx, jy, 0.034, mx, my, 0.021);
        U.taper(ctx, mx, my, 0.0185, cx, cy, 0.0126);
        U.taper(ctx, cx, cy, 0.0126, px, py, 0.0112);
        ctx.fill();
      } else {
        // coscia muscolosa
        const ux = mx - jx, uy = my - jy;
        const ul = Math.hypot(ux, uy) || 1;
        const tx = ux / ul, ty = uy / ul;
        // normale verso il lato convesso del ginocchio (davanti della coscia)
        const vl = Math.hypot(cx - mx, cy - my) || 1;
        const bx = -((jx - mx) / ul + (cx - mx) / vl), by = -((jy - my) / ul + (cy - my) / vl);
        const nx = -ty, ny = tx;
        const sgn = nx * bx + ny * by >= 0 ? 1 : -1;
        const N = (a) => [nx * a * sgn, ny * a * sgn];
        const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
        const thigh = [
          add(add([jx, jy], N(0.04)), [tx, ty], -0.035),
          add(add([jx, jy], N(0.05)), [tx, ty], ul * 0.4),
          add([mx, my], N(0.017)),
          add(add([mx, my], N(-0.019)), [tx, ty], -0.012),
          add(add([jx, jy], N(-0.06)), [tx, ty], ul * 0.5),
          add(add([jx, jy], N(-0.05)), [tx, ty], -0.045),
        ];
        ctx.beginPath();
        U.smoothPath(ctx, thigh, true);
        ctx.fill();
        if (!far) {
          ctx.save();
          ctx.clip();
          const g = ctx.createLinearGradient(jx, jy + 0.05, jx, my - 0.02);
          g.addColorStop(0, 'rgba(160,128,108,0.18)');
          g.addColorStop(1, 'rgba(0,0,0,0.14)');
          ctx.fillStyle = g;
          ctx.fillRect(jx - 0.12, my - 0.05, 0.24, 0.2);
          ctx.restore();
          ctx.fillStyle = color;
        }
        ctx.beginPath();
        U.taper(ctx, mx, my, 0.02, cx, cy, 0.0102);
        // polpaccio
        U.taper(ctx, U.lerp(mx, cx, 0.1) - 0.004, U.lerp(my, cy, 0.1), 0.019, U.lerp(mx, cx, 0.55) - 0.003, U.lerp(my, cy, 0.55), 0.012);
        U.taper(ctx, cx, cy, 0.0102, px, py, 0.0088);
        ctx.fill();
      }
      // zampa (piede)
      ctx.save();
      ctx.translate(px, py - 0.004);
      ctx.rotate(L.pa);
      ctx.beginPath();
      ctx.ellipse(0.011, -0.002, front ? 0.0195 : 0.018, 0.0095, 0, 0, TAU);
      ctx.fill();
      if (!far) {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 0.0012;
        ctx.beginPath();
        ctx.moveTo(0.019, 0.003); ctx.lineTo(0.026, -0.006);
        ctx.moveTo(0.012, 0.004); ctx.lineTo(0.017, -0.008);
        ctx.stroke();
      }
      ctx.restore();
      // luce di contorno sulle zampe vicine
      if (!far) {
        ctx.strokeStyle = 'rgba(150,122,104,0.55)';
        ctx.lineWidth = 0.0028;
        ctx.beginPath();
        if (front) {
          const [ax, ay] = [mx + 0.014, my];
          ctx.moveTo(ax, ay);
          ctx.lineTo(cx + 0.011, cy);
          ctx.lineTo(px + 0.01, py);
        } else {
          ctx.moveTo(mx + 0.012, my + 0.008);
          ctx.quadraticCurveTo(U.lerp(mx, cx, 0.5) + 0.006, U.lerp(my, cy, 0.5), cx + 0.006, cy);
        }
        ctx.stroke();
      }
    }

    bodyPath() {
      const sk = this.sk;
      const pts = sk.body;
      const hc = sk.hc, ha = sk.headA;
      const nt = U.rot(-0.032, 0.03, ha), th = U.rot(-0.006, -0.034, ha);
      const neckTop = [hc[0] + nt[0], hc[1] + nt[1]];
      const throat = [hc[0] + th[0], hc[1] + th[1]];
      const p0 = pts[0];
      const mid = [(throat[0] + p0[0]) / 2 + 0.008, (throat[1] + p0[1]) / 2 - 0.004];
      const outline = pts.concat([neckTop, throat, mid]);
      const path = new Path2D();
      U.smoothPath(path, outline, true);
      return { path, neckTop, throat, mid };
    }

    drawBody(ctx) {
      const sk = this.sk;
      const { path, neckTop, throat, mid } = this.bodyPath();
      const pts = sk.body;
      const T = sk.T;
      ctx.fillStyle = C.coat;
      ctx.fill(path);
      ctx.save();
      ctx.clip(path);
      // ombreggiatura: luce del sole dall'alto
      const g = ctx.createLinearGradient(0, 0.37 + sk.pitch * 0.1, 0, 0.12);
      g.addColorStop(0, 'rgba(165,132,112,0.55)');
      g.addColorStop(0.32, 'rgba(95,74,62,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = g;
      ctx.fillRect(-0.5, -0.2, 1.2, 0.9);
      // macchia bianca sul petto e sulla gola
      const blaze = [
        [throat[0] + 0.004, throat[1] - 0.002],
        [mid[0] + 0.01, mid[1] - 0.004],
        [pts[0][0] + 0.01, pts[0][1]],
        [pts[1][0] + 0.012, pts[1][1] - 0.006],
        T(0.15, 0.165, 0),
        T(0.16, 0.207, 0),
        [mid[0] - 0.022, mid[1] + 0.012],
        [U.lerp(throat[0], neckTop[0], 0.28), U.lerp(throat[1], neckTop[1], 0.28)],
      ];
      ctx.fillStyle = C.white;
      ctx.beginPath();
      U.smoothPath(ctx, blaze, true);
      ctx.fill();
      ctx.save();
      ctx.clip();
      const wg = ctx.createLinearGradient(mid[0] - 0.03, 0, mid[0] + 0.01, 0);
      wg.addColorStop(0, 'rgba(150,140,130,0.45)');
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(mid[0] - 0.1, 0, 0.2, 0.5);
      ctx.restore();
      // pelo: piccoli tratti che seguono il corpo
      ctx.strokeStyle = 'rgba(140,112,96,0.22)';
      ctx.lineWidth = 0.0016;
      ctx.beginPath();
      for (const [hx, hy, a] of HAIR) {
        const [x, y] = T(hx, hy, hx > 0.08 ? 0 : hx < -0.1 ? 2 : 1);
        ctx.moveTo(x, y);
        ctx.lineTo(x - 0.012 * Math.cos(a), y - 0.012 * Math.sin(a) * 0.4);
      }
      ctx.stroke();
      // costole e fianco
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 0.004;
      ctx.beginPath();
      const f1 = T(-0.08, 0.2, 1), f2 = T(-0.1, 0.26, 1), f3 = T(-0.07, 0.29, 1);
      ctx.moveTo(f1[0], f1[1]); ctx.quadraticCurveTo(f2[0], f2[1], f3[0], f3[1]);
      ctx.stroke();
      // spalla e braccio vicino (sotto la pettorina)
      const L0 = sk.legs[0];
      ctx.fillStyle = C.coat;
      ctx.beginPath();
      U.taper(ctx, L0.J[0], L0.J[1], 0.036, L0.M[0], L0.M[1], 0.022);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,122,104,0.35)';
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      ctx.moveTo(L0.J[0] + 0.03, L0.J[1] + 0.02);
      ctx.quadraticCurveTo(L0.J[0] + 0.035, L0.M[1] + 0.03, L0.M[0] + 0.02, L0.M[1]);
      ctx.stroke();

      // pettorina
      const hp = new Path2D();
      sk.harness.forEach(([x, y], i) => (i ? hp.lineTo(x, y) : hp.moveTo(x, y)));
      hp.closePath();
      ctx.fillStyle = C.harness;
      ctx.fill(hp);
      ctx.fillStyle = meshPattern(ctx);
      ctx.fill(hp);
      const hg = ctx.createLinearGradient(0, 0.34, 0, 0.13);
      hg.addColorStop(0, 'rgba(255,170,170,0.25)');
      hg.addColorStop(0.4, 'rgba(0,0,0,0)');
      hg.addColorStop(1, 'rgba(60,0,10,0.45)');
      ctx.fillStyle = hg;
      ctx.fill(hp);
      // profili riflettenti
      ctx.save();
      ctx.clip(hp);
      ctx.strokeStyle = C.pipe;
      ctx.lineWidth = 0.02;
      ctx.stroke(path);
      ctx.restore();
      const H = sk.harness;
      ctx.strokeStyle = C.pipe;
      ctx.lineWidth = 0.009;
      ctx.beginPath();
      ctx.moveTo(H[1][0], H[1][1]);
      for (let i = 2; i <= 5; i++) ctx.lineTo(H[i][0], H[i][1]);
      ctx.moveTo(H[0][0], H[0][1]);
      ctx.lineTo(H[8][0], H[8][1]);
      ctx.lineTo(H[7][0], H[7][1]);
      ctx.stroke();
      ctx.strokeStyle = C.pipeHi;
      ctx.lineWidth = 0.0025;
      ctx.stroke();
      // logo tondo
      const lg = T(0.1, 0.238, 0);
      ctx.fillStyle = '#9aa1a8';
      ctx.beginPath(); ctx.arc(lg[0], lg[1], 0.017, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5d646b';
      ctx.beginPath(); ctx.arc(lg[0], lg[1] - 0.003, 0.006, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * (0.2 + i * 0.2);
        ctx.beginPath(); ctx.arc(lg[0] + Math.cos(a) * 0.009, lg[1] - 0.003 + Math.sin(a) * 0.009, 0.0026, 0, TAU); ctx.fill();
      }
      // collare bianco con localizzatore
      const ca = [U.lerp(neckTop[0], pts[14][0], 0.45), U.lerp(neckTop[1], pts[14][1], 0.45)];
      const cb = [U.lerp(throat[0], mid[0], 0.75), U.lerp(throat[1], mid[1], 0.75)];
      ctx.strokeStyle = '#f2f1ec';
      ctx.lineWidth = 0.014;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(ca[0] - 0.02, ca[1] + 0.03); ctx.lineTo(cb[0] + 0.02, cb[1] - 0.03); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.002;
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.restore();
      // localizzatore GPS (fuori dalla sagoma, pende sotto la gola)
      ctx.save();
      ctx.translate(cb[0] + 0.004, cb[1] - 0.006);
      ctx.rotate(sk.headA * 0.3 - 0.4);
      ctx.fillStyle = '#f6f6f3';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.0015;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-0.011, -0.016, 0.022, 0.016, 0.004); else ctx.rect(-0.011, -0.016, 0.022, 0.016);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7bc96f';
      ctx.beginPath(); ctx.arc(0.006, -0.006, 0.0015, 0, TAU); ctx.fill();
      ctx.restore();
      // anello a D sul dorso
      const dr = T(0.07, 0.322, 0);
      ctx.strokeStyle = '#b7bcc0';
      ctx.lineWidth = 0.0035;
      ctx.beginPath(); ctx.arc(dr[0], dr[1] + 0.004, 0.009, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
      // bordo di luce sul profilo
      ctx.strokeStyle = 'rgba(255,232,214,0.12)';
      ctx.lineWidth = 0.003;
      ctx.stroke(path);
    }

    drawHead(ctx) {
      const jaw = this.jaw;
      const jawA = -jaw * 0.55;
      const jp = (x, y) => {
        const [rx, ry] = U.rot(x - 0.012, y + 0.022, jawA);
        return [0.012 + rx, -0.022 + ry];
      };
      // interno della bocca
      if (jaw > 0.04) {
        ctx.fillStyle = C.mouth;
        ctx.beginPath();
        ctx.moveTo(0.028, -0.024);
        ctx.lineTo(0.083, -0.021);
        const a = jp(0.079, -0.034), b = jp(0.03, -0.031);
        ctx.lineTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        ctx.fill();
      }
      // mandibola e lingua
      ctx.save();
      ctx.translate(0.012, -0.022);
      ctx.rotate(jawA);
      ctx.translate(-0.012, 0.022);
      if (this.tongue > 0.08 || jaw > 0.3) {
        const t = U.clamp(this.tongue, 0, 1);
        ctx.fillStyle = C.tongue;
        ctx.beginPath();
        ctx.moveTo(0.03, -0.03);
        ctx.quadraticCurveTo(0.07, -0.026, 0.077 + t * 0.012, -0.034 - t * 0.022);
        ctx.quadraticCurveTo(0.075 + t * 0.008, -0.044 - t * 0.032, 0.062, -0.04 - t * 0.02);
        ctx.quadraticCurveTo(0.05, -0.036, 0.03, -0.035);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,40,60,0.5)';
        ctx.lineWidth = 0.0012;
        ctx.beginPath();
        ctx.moveTo(0.048, -0.031); ctx.lineTo(0.07 + t * 0.008, -0.035 - t * 0.018);
        ctx.stroke();
      }
      ctx.fillStyle = C.coat;
      ctx.beginPath();
      U.smoothPath(ctx, JAW, true);
      ctx.fill();
      if (jaw > 0.28) {
        ctx.fillStyle = C.teeth;
        ctx.beginPath();
        ctx.moveTo(0.064, -0.03); ctx.lineTo(0.067, -0.021); ctx.lineTo(0.07, -0.03); ctx.fill();
      }
      ctx.restore();
      // cranio e muso
      ctx.fillStyle = C.coat;
      ctx.beginPath();
      U.smoothPath(ctx, HEAD, true);
      ctx.fill();
      ctx.save();
      ctx.clip();
      const g = ctx.createRadialGradient(-0.005, 0.035, 0.004, 0.0, 0.01, 0.07);
      g.addColorStop(0, 'rgba(170,138,118,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-0.06, -0.05, 0.17, 0.11);
      const mg = ctx.createRadialGradient(0.068, -0.01, 0.002, 0.068, -0.01, 0.028);
      mg.addColorStop(0, 'rgba(120,98,86,0.35)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0.03, -0.04, 0.08, 0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0.0, -0.028, 0.05, 0.012, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (jaw > 0.28) {
        ctx.fillStyle = C.teeth;
        ctx.beginPath();
        ctx.moveTo(0.066, -0.024); ctx.lineTo(0.069, -0.034); ctx.lineTo(0.073, -0.023); ctx.fill();
      }
      // labbro
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 0.0018;
      ctx.beginPath();
      ctx.moveTo(0.03, -0.025);
      ctx.quadraticCurveTo(0.056, -0.029, 0.084, -0.02);
      ctx.stroke();
      // occhio grande e scuro con riflesso
      const ex = 0.028, ey = 0.015;
      if (this.blinkT > 0) {
        ctx.fillStyle = '#120a06';
        ctx.beginPath(); ctx.ellipse(ex, ey, 0.0118, 0.009, -0.15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3b2213';
        ctx.beginPath(); ctx.ellipse(ex + 0.002, ey, 0.0083, 0.0075, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#050302';
        ctx.beginPath(); ctx.arc(ex + 0.0025, ey, 0.0047, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.arc(ex + 0.0045, ey + 0.0035, 0.0021, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(ex - 0.002, ey - 0.003, 0.001, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(170,140,120,0.45)';
        ctx.lineWidth = 0.0013;
        ctx.beginPath(); ctx.ellipse(ex, ey, 0.0122, 0.0094, -0.15, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 0.002;
        ctx.beginPath(); ctx.moveTo(ex - 0.01, ey + 0.001); ctx.quadraticCurveTo(ex, ey - 0.004, ex + 0.01, ey); ctx.stroke();
      }
      // arcata sopracciliare
      ctx.strokeStyle = 'rgba(160,130,112,0.35)';
      ctx.lineWidth = 0.003;
      ctx.beginPath(); ctx.moveTo(ex - 0.012, ey + 0.012); ctx.quadraticCurveTo(ex, ey + 0.017, ex + 0.012, ey + 0.011); ctx.stroke();
      // tartufo umido e lucido
      ctx.fillStyle = C.nose;
      ctx.beginPath(); ctx.ellipse(0.0858, -0.001, 0.0106, 0.009, 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(0.0858, 0.0038, 0.0052, 0.0024, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0.0915, -0.004, 0.0022, 0.0016, 0.6, 0, TAU); ctx.fill();
      // vibrisse
      ctx.strokeStyle = 'rgba(210,200,190,0.5)';
      ctx.lineWidth = 0.0007;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(0.068, -0.012 - i * 0.003);
        ctx.quadraticCurveTo(0.095, -0.012 - i * 0.006, 0.116, -0.006 - i * 0.012);
      }
      ctx.stroke();
      this.drawEar(ctx, false);
    }

    drawEar(ctx, far) {
      ctx.save();
      ctx.translate(-0.02 + (far ? 0.008 : 0), 0.038 + (far ? 0.006 : 0));
      ctx.rotate(this.earA + (far ? 0.12 : 0));
      ctx.fillStyle = far ? C.far : C.coat;
      ctx.beginPath();
      U.smoothPath(ctx, [[0.012, 0.004], [-0.006, 0.021], [-0.04, 0.017], [-0.06, 0.0], [-0.052, -0.013], [-0.016, -0.009]], true);
      ctx.fill();
      if (!far) {
        // piega dell'orecchio a rosa
        ctx.fillStyle = 'rgba(120,80,72,0.45)';
        ctx.beginPath();
        U.smoothPath(ctx, [[0.002, 0.006], [-0.012, 0.014], [-0.038, 0.008], [-0.018, -0.002]], true);
        ctx.fill();
        ctx.strokeStyle = 'rgba(170,140,120,0.4)';
        ctx.lineWidth = 0.0018;
        ctx.beginPath();
        ctx.moveTo(-0.006, 0.02); ctx.quadraticCurveTo(-0.032, 0.022, -0.056, 0.004);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTail(ctx) {
      const sk = this.sk;
      let [x, y] = sk.tailBase;
      const pitch = sk.pitch;
      const lenK = this.wag > 0.3 ? 0.82 + 0.18 * Math.cos(this.wagPh * 1) : 1;
      const seg = 0.03;
      const pts = [[x, y]];
      for (let i = 0; i < this.tail.length; i++) {
        const a = Math.PI - this.tail[i].a + pitch;
        const l = seg * (i === 0 ? 1 : lenK);
        x += Math.cos(a) * l;
        y += Math.sin(a) * l;
        if (y < 0.004 - this.y) { y = 0.004 - this.y; }
        pts.push([x, y]);
      }
      ctx.fillStyle = C.coat;
      ctx.beginPath();
      for (let i = 0; i < pts.length - 1; i++) {
        const r1 = U.lerp(0.012, 0.004, i / (pts.length - 1));
        const r2 = U.lerp(0.012, 0.004, (i + 1) / (pts.length - 1));
        U.taper(ctx, pts[i][0], pts[i][1], r1, pts[i + 1][0], pts[i + 1][1], r2);
      }
      ctx.fill();
    }

    drawCarriedBone(ctx) {
      const sk = this.sk;
      ctx.save();
      const m = sk.mouth;
      ctx.translate(m[0] - 0.02 * Math.cos(sk.headA), m[1] + 0.004);
      ctx.rotate(sk.headA * 0.6 - 0.35);
      ctx.scale(0.62, 1);
      OAV.drawBoneShape(ctx, this.bone.def, 1, false);
      ctx.restore();
    }

    drawEatingBone(ctx) {
      const sk = this.sk;
      const m = sk.mouth;
      const p = sk.legs[0].P;
      const L = this.bone.def.len;
      // un'estremità tra le zampe, l'altra in bocca
      const ax = p[0] + 0.022, ay = 0.014;
      const ang = Math.atan2(m[1] - ay, m[0] - ax);
      const left = 1 - U.clamp(this.eatT / this.eatDur, 0, 1) * 0.5;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.translate(L * left * 0.5 - 0.004, 0);
      ctx.scale(left, 1);
      OAV.drawBoneShape(ctx, this.bone.def, 1, false);
      ctx.restore();
      // la zampa vicina appoggiata sopra l'osso
      ctx.fillStyle = C.coat;
      ctx.beginPath();
      ctx.ellipse(p[0] + 0.012, p[1] + 0.008, 0.019, 0.0095, 0, 0, TAU);
      ctx.fill();
    }
  }

  OAV.Dog = Dog;
})();
