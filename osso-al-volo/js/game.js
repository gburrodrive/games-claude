/* Osso al Volo — logica di gioco, input, camera, HUD e ciclo principale */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const WORLD = OAV.WORLD;
  const R = OAV.SceneRender;
  const DT = 1 / 120;
  const ROUND_TIME = 120;

  // ---------- input ----------
  class Input {
    constructor(game) {
      this.game = game;
      this.keys = new Set();
      this.pressed = new Set();
      this.touch = { left: false, right: false, jump: false, bark: false, sprint: false };
      this.touchPressed = new Set();
      this.padPrev = {};
      const block = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (block.has(e.code) && game.state === 'play') e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
        game.onKey(e);
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => { this.keys.clear(); for (const k in this.touch) this.touch[k] = false; });
    }
    bindTouch(el, name) {
      const on = (e) => {
        e.preventDefault();
        if (!this.touch[name]) this.touchPressed.add(name);
        this.touch[name] = true;
        el.classList.add('is-down');
        this.game.sfx.init();
      };
      const off = (e) => { e.preventDefault(); this.touch[name] = false; el.classList.remove('is-down'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    sample() {
      const k = this.keys, p = this.pressed, t = this.touch, tp = this.touchPressed;
      let left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
      let right = k.has('ArrowRight') || k.has('KeyD') || t.right;
      let jumpHeld = k.has('ArrowUp') || k.has('KeyW') || k.has('Space') || t.jump;
      let jump = p.has('ArrowUp') || p.has('KeyW') || p.has('Space') || tp.has('jump');
      let bark = p.has('KeyB') || p.has('KeyE') || p.has('KeyK') || tp.has('bark');
      let sprint = k.has('ShiftLeft') || k.has('ShiftRight') || t.sprint;
      const slow = k.has('ArrowDown') || k.has('KeyS');
      let mash = jump || p.has('ArrowDown') || p.has('KeyS');
      // gamepad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && pads[0];
      if (gp) {
        const ax = gp.axes[0] || 0;
        if (ax < -0.35 || (gp.buttons[14] && gp.buttons[14].pressed)) left = true;
        if (ax > 0.35 || (gp.buttons[15] && gp.buttons[15].pressed)) right = true;
        const bA = gp.buttons[0] && gp.buttons[0].pressed;
        const bX = (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[1] && gp.buttons[1].pressed);
        const bR = (gp.buttons[7] && gp.buttons[7].pressed) || (gp.buttons[5] && gp.buttons[5].pressed);
        if (bA) { jumpHeld = true; if (!this.padPrev.a) { jump = true; mash = true; } }
        if (bX && !this.padPrev.x) bark = true;
        if (bR) sprint = true;
        this.padPrev = { a: bA, x: bX };
      }
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      this.pressed.clear();
      this.touchPressed.clear();
      return { dir, sprint, slow, jump, jumpHeld, bark, mash };
    }
  }

  const NONE = { dir: 0, sprint: false, slow: false, jump: false, jumpHeld: false, bark: false, mash: false };

  // ---------- gioco ----------
  class Game {
    constructor(canvas, ui) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = ui;
      this.sfx = new OAV.Sfx();
      this.world = new OAV.World();
      R.prepare(this.world);
      this.cam = new OAV.Camera();
      this.dog = new OAV.Dog(this.world, this.sfx);
      this.human = new OAV.Human(this.world, this.sfx);
      this.gull = new OAV.Gull(this.world, this.sfx);
      this.input = new Input(this);
      this.state = 'menu';
      this.modeName = U.lsGet('oav.mode', 'tempo');
      this.dogName = U.lsGet('oav.name', 'Pepe');
      this.best = U.lsGet('oav.best', { tempo: 0, infinito: 0 });
      this.timeScale = 1;
      this.acc = 0;
      this.last = performance.now();
      this.world.onCrash = (i) => {
        const d = Math.abs(this.cam.x - WORLD.X0);
        this.sfx.waveCrash(U.clamp(i, 0.6, 1.3) * U.clamp(1.3 - d / 40, 0.25, 1));
      };
      this.resize();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(true); });
      this.newRound(true);
      requestAnimationFrame((t) => this.frame(t));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(320, window.innerWidth), H = Math.max(240, window.innerHeight);
      this.dpr = dpr;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.width = W + 'px';
      this.cv.style.height = H + 'px';
      this.cam.resize(W, H);
      // vignettatura pre-renderizzata
      const v = document.createElement('canvas');
      v.width = Math.round(W / 2); v.height = Math.round(H / 2);
      const c = v.getContext('2d');
      const g = c.createRadialGradient(v.width / 2, v.height * 0.45, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height * 0.5, Math.max(v.width, v.height) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(30,20,10,0.28)');
      c.fillStyle = g;
      c.fillRect(0, 0, v.width, v.height);
      this.vignette = v;
    }

    newRound(demo) {
      this.demo = demo;
      this.world.footprints.length = 0;
      this.world.particles.length = 0;
      this.dog.reset(1.7);
      this.human.x = WORLD.HUMAN_X;
      this.human.anim = null;
      this.human.facing = 1;
      this.human.hasBone = true;
      this.human.boneDef = OAV.BONE_TYPES.pelle;
      this.nextType = 'pelle';
      this.gull.active = false;
      this.bones = [];
      this.activeBone = null;
      this.hs = 'ready';
      this.readyT = 0;
      this.readyDelay = 1.4;
      this.callT = 0;
      this.plan = null;
      this.gullTimer = -1;
      this.score = 0;
      this.bonesEaten = 0;
      this.streak = 0;
      this.time = ROUND_TIME;
      this.lives = 3;
      this.stats = { air: 0, acro: 0, gull: 0, sea: 0, fakes: 0, thrown: 0 };
      this.popups = [];
      this.bubble = null;
      this.lastThrow = null;
      this.cam.x = 1.0;
      this.cam.D = this.cam.D0;
      this.world.wind = U.rand(-1.2, 1.6);
      this.timeScale = 1;
      this.timers = [];
      this.carryPress = null;
      this.say(demo ? null : `${this.gw('Pronto', 'Pronta')}, ${this.dogName}?`, 1.6);
      this.updateHud(true);
    }

    // ---------- flusso partita ----------
    start(mode, name) {
      this.timers = [];
      this.modeName = mode;
      this.dogName = (name || 'Pepe').trim().slice(0, 14) || 'Pepe';
      U.lsSet('oav.mode', mode);
      U.lsSet('oav.name', this.dogName);
      this.sfx.init();
      this.newRound(false);
      this.state = 'play';
      this.ui.show('play');
    }

    pause(on) {
      if (on && this.state === 'play') { this.state = 'pause'; this.ui.show('pause'); }
      else if (!on && this.state === 'pause') { this.state = 'play'; this.ui.show('play'); this.last = performance.now(); }
    }

    endRound() {
      if (this.state !== 'play') return;
      if (this.dog.mode === 'eat' && this.dog.bone) {
        this.dog.eatT = this.dog.eatDur;
        this.dog.updateEat(0, NONE, this);
      }
      this.state = 'over';
      const key = this.modeName;
      const rec = this.score > (this.best[key] || 0);
      if (rec) { this.best[key] = this.score; U.lsSet('oav.best', this.best); }
      this.ui.gameOver({
        mode: key, score: this.score, bones: this.bonesEaten, record: rec, best: this.best[key],
        air: this.stats.air, acro: this.stats.acro, gull: this.stats.gull, sea: this.stats.sea,
        dist: this.dog.dist, vmax: this.dog.maxSpeed * 3.6, fakes: this.stats.fakes, name: this.dogName,
      });
      this.demo = true;
    }

    onKey(e) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'play') this.pause(true);
        else if (this.state === 'pause') this.pause(false);
      }
      if (e.code === 'KeyM') this.ui.toggleMute();
      if ((e.code === 'Enter') && this.state === 'over') this.ui.restart();
    }

    dogNearHuman() { return Math.abs(this.dog.x - this.human.x) < 4.5; }

    // parole al maschile o al femminile secondo il cane
    gw(m, f) { return this.dogSex === 'f' ? f : m; }

    say(text, dur = 1.8) {
      this.bubble = text ? { text, t: dur } : null;
    }

    popup(x, y, text, sub, color) {
      this.popups.push({ x, y, text, sub, t: 0, color: color || '#ffffff' });
    }

    // ---------- l'umano ----------
    updateHuman(dt) {
      const h = this.human, dog = this.dog;
      if (this.hs === 'ready') {
        const dx = dog.x - h.x;
        const dogReady = this.dogNearHuman() && !dog.bone && dog.mode !== 'eat' && dog.mode !== 'pickup';
        if (!h.busy) {
          // guarda e si gira verso il cane
          const want = Math.sign(dx) || h.facing;
          if (Math.abs(dx) > 0.5 && want !== h.facing && h.turnT >= 1) h.face(want);
        }
        if (dogReady) {
          this.readyT += dt;
          this.callT = 0;
          if (this.readyT > this.readyDelay && !h.busy) this.beginThrow();
        } else {
          this.readyT = Math.min(this.readyT, this.readyDelay * 0.5);
          if (!dog.bone && dog.mode !== 'eat') this.callT += dt;
          if (this.callT > 3.2 && !h.busy) {
            this.callT = -2.5;
            h.play('pat');
            this.sfx.whistle();
            this.say(U.pick([`Vieni qui, ${this.dogName}!`, `${this.dogName}! Qui!`, 'Dai, torna qui!']), 1.8);
          }
        }
      } else if (this.hs === 'reload') {
        // aspetta un attimo e prende un osso dalla borsa
        this.readyT += dt;
        if (this.readyT > 0.4 && !h.busy) {
          const bagX = -0.75;
          const behind = Math.sign(bagX - h.x) !== h.facing;
          h.play(behind ? 'reachBehind' : 'reachFront', () => {
            this.hs = 'ready';
            this.readyT = 0;
            this.readyDelay = U.rand(0.7, 1.4) * U.clamp(1 - this.bonesEaten * 0.03, 0.55, 1);
          }, {
            grab: () => {
              this.nextType = this.pickType();
              h.hasBone = true;
              h.boneDef = OAV.BONE_TYPES[this.nextType];
            },
          });
        }
      }
      // sguardo
      const b = this.activeBone;
      if (b && b.state !== 'held' && b.state !== 'gone') h.lookAt = [b.x, b.y];
      else h.lookAt = [dog.x, 0.3];
      h.update(dt);
    }

    pickType() {
      const l = this.bonesEaten;
      return U.weighted([
        { w: 0.38, t: 'biscotto' },
        { w: 0.4, t: 'pelle' },
        { w: l >= 1 ? 0.17 : 0.05, t: 'annodato' },
        { w: l >= 3 ? 0.08 : 0, t: 'prosciutto' },
      ]).t;
    }

    planThrow() {
      const lvl = this.bonesEaten + (this.demo ? 2 : 0);
      let dir = 1;
      if (lvl >= 2 && Math.random() < 0.25) dir = -1;
      const dmin = Math.min(4 + lvl * 0.4, 11);
      const dmax = dir > 0 ? Math.min(9 + lvl * 1.5, lvl >= 12 ? 38 : 31) : Math.min(7 + lvl * 0.8, 13);
      const d = U.rand(dmin, Math.max(dmin + 1, dmax));
      const r = Math.random();
      let ang;
      if (r < 0.18 && lvl >= 1) ang = U.rand(60, 70);
      else if (r < 0.32 && lvl >= 2) ang = U.rand(15, 22);
      else ang = U.rand(34, 56);
      const under = d < 7.5 && ang < 48 && Math.random() < 0.7;
      const fake = !this.demo && lvl >= 3 && Math.random() < 0.22;
      return { dir, d, ang: (ang * Math.PI) / 180, under, fake };
    }

    beginThrow() {
      const h = this.human;
      const plan = this.planThrow();
      this.plan = plan;
      if (h.facing !== plan.dir) h.face(plan.dir);
      this.hs = 'throwing';
      // il vento cambia un po' a ogni lancio
      this.world.wind = U.clamp(this.world.wind * 0.6 + U.rand(-1.6, 1.6), -3.2, 3.2);
      const doThrow = () => {
        const p = this.plan;
        h.play(p.under ? 'underhand' : 'overhand', null, { release: () => this.release() });
        if (Math.random() < 0.5) this.say(U.pick(['Prendilo!', `Vai, ${this.dogName}!`, 'Vaiii!', 'Occhio!']), 1.2);
      };
      const go = () => {
        if (plan.fake) {
          h.play('fake', () => {
            this.say('Ahah, era una finta!', 1.4);
            this.sfx.laugh();
            // dopo la finta spesso lancia dall'altra parte
            if (Math.random() < 0.5) { this.plan.dir *= -1; this.plan.d = Math.min(this.plan.d, this.plan.dir > 0 ? 28 : 12); h.face(this.plan.dir); }
            setTimeoutGame(this, 0.45, doThrow);
          });
          this.stats.fakes++;
        } else doThrow();
      };
      setTimeoutGame(this, h.turnT < 1 ? 0.3 : 0.05, go);
    }

    release() {
      const h = this.human;
      const p = this.plan;
      const [hx, hy] = h.handWorld();
      const target = h.x + p.dir * p.d;
      const dist = Math.max(1, Math.abs(target - hx));
      const th = p.ang;
      const hgt = Math.max(0.3, hy);
      const v2 = (U.G * dist * dist) / (2 * Math.cos(th) ** 2 * (dist * Math.tan(th) + hgt));
      const v = Math.sqrt(v2) * 1.035 * U.rand(0.97, 1.03);
      const b = new OAV.Bone(this.nextType);
      b.z = h.z;
      b.launch(hx, hy, p.dir * v * Math.cos(th), v * Math.sin(th), p.dir * U.rand(-15, -8) * (p.under ? 0.6 : 1));
      b.prevX = b.x; b.prevY = b.y;
      b.releaseT = 0;
      this.bones.push(b);
      this.activeBone = b;
      h.hasBone = false;
      this.hs = 'wait';
      this.stats.thrown++;
      this.lastThrow = { d: p.d, v: v * 3.6 };
      // dal livello 6 un gabbiano volteggia già sulla spiaggia e segue l'osso
      const lvl = this.bonesEaten + (this.demo ? 3 : 0);
      if (lvl >= 6 && !this.gull.active && Math.random() < U.clamp((lvl - 5) * 0.08, 0, 0.6)) {
        this.gull.spawnHover(b, Math.random() < 0.5 ? 1 : -1, U.clamp(lvl / 16, 0, 1));
      }
      this.sfx.whoosh(U.clamp(v / 12, 0.7, 1.4));
      this.ui.flashThrow(p.d, this.world.wind);
    }

    resolveBone() {
      this.activeBone = null;
      this.bones = this.bones.filter((b) => b.state !== 'gone' && b.state !== 'held');
      this.hs = 'reload';
      this.readyT = 0;
    }

    // ---------- eventi ----------
    onBark(dog) {
      // vicino all'umano: lancia subito
      if (this.hs === 'ready' && this.dogNearHuman() && !dog.bone) this.readyT = Math.max(this.readyT, this.readyDelay);
      if (this.gull.active && Math.hypot(this.gull.x - dog.x, this.gull.y - dog.baseY) < 6) this.gull.scare(this, true);
      const [hx, hy] = dog.headWorld();
      this.popups.push({ x: hx + dog.facing * 0.1, y: hy + 0.12, text: 'Bau!', sub: null, t: 0, color: '#fff', small: true });
    }

    onBoneEvent(type, b, impact, wet) {
      if (type === 'impact') {
        const w = this.world;
        w.burst(wet ? 'drop' : 'sand', b.x, w.groundH(b.x), b.z, Math.round(6 + impact * 2.5), { speed: 0.6 + impact * 0.18, up: 0.9, size: wet ? 0.01 : 0.009 });
        const camD = Math.abs(b.x - this.cam.x);
        this.sfx.thud(U.clamp(impact / 8, 0.2, 1) * U.clamp(1.4 - camD / 15, 0.2, 1), wet);
        if (b.bounces === 0 && b === this.activeBone && !this.gull.active && this.gullTimer < 0) this.maybeGull(b);
      } else if (type === 'splash') {
        this.world.burst('drop', b.x, this.world.sea, b.z, 18, { speed: 1.6, up: 1.4, size: 0.012 });
        this.sfx.splash(0.8);
        if (b === this.activeBone && !this.gull.active && this.gullTimer < 0) this.maybeGull(b);
      } else if (type === 'sea') {
        this.onBoneLost(b, 'sea');
      }
    }

    maybeGull(b) {
      const lvl = this.bonesEaten + (this.demo ? 3 : 0);
      const p = U.clamp(0.1 + lvl * 0.065, 0, 0.85);
      if (Math.random() < p) {
        // più si va avanti, più i gabbiani sono vicini e sfacciati
        this.gullTimer = lvl >= 6 ? U.rand(0, 0.3) : U.rand(0.3, 1.2);
        this.gullBone = b;
        this.gullLevel = U.clamp(lvl / 16, 0, 1);
      }
    }

    onGullDrop(b) {
      this.activeBone = b;
      if (!this.bones.includes(b)) this.bones.push(b);
      this.say('Così! Fallo scappare!', 1.4);
    }

    onBoneLost(b, why) {
      if (b.lostHandled) return;
      b.lostHandled = true;
      b.state = 'gone';
      this.streak = 0;
      if (why === 'gull') {
        this.stats.gull++;
        this.ui.toast('Il gabbiano ha rubato l’osso!', 'bad');
        this.say('No! Il gabbiano!', 1.6);
      } else {
        this.stats.sea++;
        this.ui.toast('Il mare si è preso l’osso!', 'bad');
        this.say('Peccato, è andato!', 1.6);
      }
      if (!this.demo && this.modeName === 'infinito') {
        this.lives--;
        if (this.lives <= 0) setTimeoutGame(this, 0.8, () => this.endRound());
      }
      if (b === this.activeBone) this.resolveBone();
    }

    pickupInfo(b) {
      return { air: false, flight: false, apex: false, water: b.state === 'water' || this.world.depth(b.x) > 0.01, t: b.flightT + (b.groundT || 0) + (b.waterT || 0), fromGull: false };
    }

    onEaten(b, info) {
      info = info || { t: 9 };
      let mult = 1, label = null, acro = false;
      if (info.fromGull) { mult = 1.5; label = 'Strappato al gabbiano!'; }
      else if (info.flight && info.air && info.apex) { mult = 3; label = 'Presa acrobatica!'; acro = true; }
      else if (info.flight && info.air) { mult = 2; label = 'Al volo!'; }
      else if (info.flight) { mult = 1.5; label = 'Presa in corsa!'; }
      else if (info.water) { mult = 1.2; label = 'Ripescato!'; }
      const speedBonus = info.t < 4 ? Math.round((4 - info.t) * 15) : 0;
      this.streak++;
      const combo = 1 + Math.min(this.streak - 1, 10) * 0.1;
      const pts = Math.round((b.def.pts * mult + speedBonus) * combo);
      if (!this.demo) {
        this.score += pts;
        this.bonesEaten++;
      } else {
        this.bonesEaten = (this.bonesEaten + 1) % 6;
      }
      if (info.flight && info.air) this.stats.air++;
      if (acro) this.stats.acro++;
      const [hx, hy] = this.dog.headWorld();
      if (!this.demo) {
        this.popup(hx, hy + 0.25, `+${pts}`, label || b.def.name, mult >= 2 ? '#ffd166' : '#ffffff');
        if (this.streak >= 2) this.ui.toast(`Serie di ${this.streak} · ×${combo.toFixed(1)}`, 'good');
      }
      this.sfx.chime(mult >= 2 ? 2 : 1);
      if (mult >= 2 && !this.human.busy) { this.human.play('cheer'); this.say(U.pick(['Che presa!', this.gw('Bravissimo!', 'Bravissima!'), 'Incredibile!']), 1.4); }
      else if (Math.random() < 0.5) this.say(U.pick([this.gw('Bravo!', 'Brava!'), 'Buono?', `${this.gw('Bravo', 'Brava')} ${this.dogName}!`]), 1.2);
      if (b === this.activeBone) this.resolveBone();
      this.updateHud(true);
    }

    // ---------- catture ----------
    checkCatches() {
      const dog = this.dog;
      dog.snap = null;
      if (dog.bone || dog.mode === 'eat' || dog.mode === 'pickup') return;
      const [mx, my] = dog.mouthWorld();
      let best = null, bestD = 0.7;
      for (const b of this.bones) {
        if (b.state === 'flight' || (b.state === 'gull' && this.gull.carry === b)) {
          const d = U.segDist(mx, my, b.prevX ?? b.x, b.prevY ?? b.y, b.x, b.y);
          const ahead = (b.x - dog.x) * dog.facing > 0.05;
          if (d < 0.105 + b.def.len * 0.22 && ahead) {
            const fromGull = b.state === 'gull';
            if (fromGull) { this.gull.carry = null; this.gull.scare(this, false); }
            const info = { air: !dog.onGround, flight: true, apex: !dog.onGround && Math.abs(dog.vy) < 1.3, t: b.flightT, fromGull, water: false };
            b.state = 'held';
            dog.takeBone(b, info);
            if (b.z > 0.05) b.z = 0;
            return;
          }
          if (d < bestD && ahead) { bestD = d; best = b; }
        } else if ((b.state === 'ground' || b.state === 'water') && dog.onGround && dog.mode === 'free') {
          // il muso arriva da sotto il petto fino a ~40 cm davanti
          const ahead = (b.x - dog.x) * dog.facing;
          const far = 0.42 + Math.abs(dog.vx) * 0.025;
          const lowEnough = b.y < dog.baseY + (b.state === 'water' ? 0.24 : 0.12);
          if (ahead > -0.03 && ahead < far && lowEnough) {
            dog.startPickup(b);
            return;
          }
        }
      }
      if (best) dog.snap = [best.x, best.y];
    }

    // ---------- pilota automatico (demo e test) ----------
    predict(b, yLevel) {
      let x = b.x, y = b.y, vx = b.vx, vy = b.vy, t = 0;
      const k = b.def.cd, wind = this.world.wind, h = 1 / 60;
      while (t < 5) {
        const rvx = vx - wind, sp = Math.hypot(rvx, vy);
        vx -= k * sp * rvx * h;
        vy -= (U.G + k * sp * vy) * h;
        x += vx * h; y += vy * h; t += h;
        if (vy < 0 && y <= yLevel) break;
      }
      return { x, t };
    }

    autopilot() {
      const dog = this.dog, b = this.activeBone;
      const inp = { dir: 0, sprint: false, slow: false, jump: false, jumpHeld: false, bark: false, mash: false };
      if (dog.mode === 'eat') { inp.mash = Math.random() < 0.05; return inp; }
      if (b && (b.state === 'flight' || b.state === 'ground' || b.state === 'water' || b.state === 'gull')) {
        let tx;
        if (b.state === 'flight') {
          const pr = this.predict(b, 0.62);
          const side = Math.sign(pr.x - dog.x) || dog.facing;
          tx = pr.x - side * 0.3;
          const [mx, my] = dog.mouthWorld();
          const dxm = b.x - mx;
          if (b.vy < 0.5 && Math.abs(dxm) < 0.95 && b.y - my < 1.15 && b.y - my > 0.05 && dog.onGround && dxm * dog.facing > 0) {
            inp.jump = true;
          }
          inp.jumpHeld = !dog.onGround && dog.vy > 0 && b.y > dog.baseY + 0.9;
        } else if (b.state === 'gull') {
          tx = this.gull.x;
          if (Math.abs(this.gull.x - dog.x) < 5) inp.bark = Math.random() < 0.012;
        } else {
          tx = b.x - (Math.sign(b.x - dog.x) || 1) * 0.27;
          if (this.gull.active && Math.abs(this.gull.x - dog.x) < 5) inp.bark = Math.random() < 0.012;
          // osso alle spalle: girarsi
          if ((b.x - dog.x) * dog.facing < -0.03 && Math.abs(b.x - dog.x) < 0.8) { inp.dir = Math.sign(b.x - dog.x); return inp; }
        }
        const dx = tx - dog.x;
        if (Math.abs(dx) > 0.12) inp.dir = Math.sign(dx);
        if (Math.abs(dx) < 1.0 && Math.abs(dog.vx) > 3 && Math.sign(dx) === Math.sign(dog.vx)) inp.dir = 0;
        inp.sprint = Math.abs(dx) > 5 && dog.stamina > 0.3;
        if (Math.abs(dx) < 0.5 && b.state === 'flight') inp.dir = 0;
      } else if (this.hs === 'throwing' && this.plan && !this.plan.fake && this.human.anim && this.human.anim.name !== 'fake') {
        // come un cane vero: legge il caricamento del braccio e parte in anticipo
        const guess = this.botHonest ? 4 : this.plan.d * 0.55;
        const tx = this.human.x + (this.botHonest ? this.human.facing : this.plan.dir) * guess;
        const dx = tx - dog.x;
        if (Math.abs(dx) > 0.3) inp.dir = Math.sign(dx);
        inp.sprint = Math.abs(dx) > 3 && dog.stamina > 0.4;
      } else {
        const side = dog.x >= this.human.x ? 1 : -1;
        const tx = this.human.x + side * 1.5;
        const dx = tx - dog.x;
        if (Math.abs(dx) > 0.5) inp.dir = Math.sign(dx);
        else if (dog.facing === side && Math.abs(dog.vx) < 0.2 && Math.random() < 0.02) inp.dir = -side;
        if (Math.abs(dx) < 1.2 && Math.random() < 0.004 && this.hs === 'ready') inp.bark = true;
      }
      return inp;
    }

    // ---------- passo di simulazione ----------
    step(dt, inp) {
      const w = this.world;
      w.update(dt);
      this.updateHuman(dt);
      for (const b of this.bones) {
        b.prevX = b.x; b.prevY = b.y;
        b.update(dt, w, (t, bb, i, wet) => this.onBoneEvent(t, bb, i, wet));
      }
      for (const bb of this.bones) {
        if (bb.state === 'water' && bb.x > w.dogLimit() + 0.5) {
          bb.outT = (bb.outT || 0) + dt;
          if (bb.outT > 3.5) { bb.state = 'gone'; this.onBoneLost(bb, 'sea'); }
        } else if (bb.outT) bb.outT = Math.max(0, bb.outT - dt);
      }
      this.checkCatches();
      // sguardo del cane
      const dog = this.dog;
      const b = this.activeBone;
      if (b && (b.state === 'flight' || b.state === 'ground' || b.state === 'water')) dog.look = [b.x, b.y];
      else if (this.gull.active) dog.look = [this.gull.x, this.gull.y];
      else if (this.dogNearHuman()) dog.look = [this.human.x, this.human.hasBone ? 1.3 : 1.6];
      else dog.look = null;
      dog.update(dt, inp, this);
      if (this.gullTimer >= 0) {
        this.gullTimer -= dt;
        if (this.gullTimer < 0) {
          const gb = this.gullBone;
          if (gb && (gb.state === 'ground' || gb.state === 'water') && !this.gull.active) {
            const side = Math.sign(gb.x - dog.x) || 1;
            this.gull.spawn(gb, side, this.gullLevel || 0);
          }
        }
      }
      this.gull.update(dt, this);
      // timer di gioco
      if (this.timers) {
        for (let i = this.timers.length - 1; i >= 0; i--) {
          const t = this.timers[i];
          t.t -= dt;
          if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
        }
      }
      if (this.state === 'play' && !this.demo && this.modeName === 'tempo') {
        this.time -= dt;
        if (this.time <= 0) { this.time = 0; this.endRound(); }
      }
      // pulizia
      if (this.bones.length > 4) this.bones = this.bones.filter((x) => x.state !== 'gone');
    }

    updateCamera(dt) {
      const cam = this.cam, dog = this.dog;
      const b = this.activeBone;
      let cx, width;
      const base = cam.W / (cam.F / cam.D0);
      const maxW = base * cam.maxD / cam.D0;
      let needH = 1.6;
      if (b && (b.state === 'flight' || b.state === 'ground' || b.state === 'water' || b.state === 'gull')) {
        const bx = b.state === 'flight' ? U.lerp(b.x, this.predict(b, 0.5).x, 0.35) : b.x;
        const minX = Math.min(dog.x, bx) - 1.6, maxX = Math.max(dog.x, bx) + 1.6;
        width = maxX - minX;
        cx = (minX + maxX) / 2;
        if (width > maxW * 0.95) cx = dog.x + Math.sign(bx - dog.x) * (maxW * 0.95 / 2 - 1.6);
        needH = Math.min(b.y + 0.6, 4.2);
      } else if (Math.abs(dog.x - this.human.x) < 7) {
        cx = (dog.x + this.human.x) / 2 + dog.vx * 0.15;
        width = Math.abs(dog.x - this.human.x) + 4.2;
      } else {
        cx = dog.x + dog.vx * 0.4;
        width = base;
      }
      width = Math.max(width, base);
      let D = width * cam.F / cam.W;
      const playY = cam.horizonY + cam.h0 * cam.F / cam.D0;
      const Dh = (needH * cam.F) / Math.max(80, playY - 40);
      D = U.clamp(Math.max(D, Dh), cam.D0, cam.maxD);
      cam.D = U.damp(cam.D, D, 1.8, dt);
      cam.x = U.damp(cam.x, cx, 2.6, dt);
      cam.update(dt);
    }

    // ---------- ciclo ----------
    frame(now) {
      const real = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      OAV.now = now / 1000;
      const running = this.state === 'play' || this.state === 'menu' || this.state === 'over';
      if (running) {
        let inp = this.state === 'play' ? this.input.sample() : this.autopilot();
        if (this.state !== 'play') this.input.sample();
        if (this.carryPress) {
          inp.jump = inp.jump || this.carryPress.jump;
          inp.bark = inp.bark || this.carryPress.bark;
          inp.mash = inp.mash || this.carryPress.mash;
          this.carryPress = null;
        }
        // rallentatore nella presa al volo
        const dog = this.dog;
        let slowmo = false;
        if (!dog.onGround && this.activeBone && this.activeBone.state === 'flight') {
          const [mx, my] = dog.mouthWorld();
          if (Math.hypot(this.activeBone.x - mx, this.activeBone.y - my) < 0.6) slowmo = true;
        }
        this.timeScale = U.damp(this.timeScale, slowmo && !this.reducedMotion ? 0.4 : 1, slowmo ? 20 : 6, real);
        this.acc += real * this.timeScale;
        let first = true;
        let n = 0;
        while (this.acc >= DT && n < 24) {
          this.step(DT, first ? inp : Object.assign({}, inp, { jump: false, bark: false, mash: false }));
          first = false;
          this.acc -= DT;
          n++;
        }
        if (first && (inp.jump || inp.bark || inp.mash)) this.carryPress = { jump: inp.jump, bark: inp.bark, mash: inp.mash };
        this.updateCamera(real);
        // audio della risacca
        if (this.sfx.ctx) {
          const d = Math.abs(this.cam.x - this.world.wx);
          this.sfx.setSwash(this.world.uprush * U.clamp(1.2 - d / 25, 0.1, 1), this.world.wind);
        }
        for (const p of this.popups) p.t += real;
        this.popups = this.popups.filter((p) => p.t < (p.small ? 0.7 : 1.6));
        if (this.bubble) { this.bubble.t -= real; if (this.bubble.t <= 0) this.bubble = null; }
        if (this.state === 'play') this.updateHud(false);
      }
      this.render();
      requestAnimationFrame((t) => this.frame(t));
    }

    // ---------- disegno ----------
    render() {
      const ctx = this.ctx, cam = this.cam, w = this.world;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      R.sky(ctx, cam, w);
      R.far(ctx, cam);
      R.ground(ctx, cam, w);
      R.groundDetails(ctx, cam, w);
      R.towel(ctx, cam);
      R.props(ctx, cam, w, false);
      const h = this.human, dog = this.dog;
      R.shadow(ctx, cam, w, h.x + 0.05, 0, h.z, 0.62, 0.32, 0.42);
      R.shadow(ctx, cam, w, dog.x - dog.facing * 0.02, dog.y, 0, 0.48, 0.17, 0.5);
      for (const b of this.bones) {
        if (b.state === 'flight' || b.state === 'ground') R.shadow(ctx, cam, w, b.x, Math.max(0, b.y - w.groundH(b.x)), b.z, b.def.len, 0.06, 0.55);
      }
      if (this.gull.active) R.shadow(ctx, cam, w, this.gull.x, this.gull.y - w.groundH(this.gull.x), 0, this.gull.state === 'ground' || this.gull.state === 'grab' ? 0.3 : 0.9, 0.12, 0.35);
      for (const b of this.bones) if (b.state === 'ground' || b.state === 'water') b.draw(ctx, cam, w);
      for (const b of this.bones) if (b.state === 'flight' && b.z > 0.45) b.draw(ctx, cam, w);
      h.draw(ctx, cam);
      dog.draw(ctx, cam);
      R.waterOver(ctx, cam, w, dog.x, -0.001, 0.32);
      for (const b of this.bones) if (b.state === 'flight' && b.z <= 0.45) b.draw(ctx, cam, w);
      this.gull.draw(ctx, cam);
      if (this.gull.active && (this.gull.state === 'ground' || this.gull.state === 'grab')) R.waterOver(ctx, cam, w, this.gull.x, -0.001, 0.25);
      R.particles(ctx, cam, w);
      R.props(ctx, cam, w, true);
      ctx.drawImage(this.vignette, 0, 0, cam.W, cam.H);
      this.drawOverlay(ctx);
    }

    drawOverlay(ctx) {
      const cam = this.cam;
      const font = (wgt, px) => `${wgt} ${px}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
      // indicatori fuori schermo
      const b = this.activeBone;
      const ind = (x, y, label, color) => {
        const sx = cam.sx(x, 0), sy = cam.sy(y, 0);
        const m = 30;
        if (sx > m && sx < cam.W - m && sy > m + 50) return;
        const cx = U.clamp(sx, m, cam.W - m), cy = U.clamp(sy, m + 60, cam.H - m);
        const ang = Math.atan2(sy - cy, sx - cx) || (sx > cam.W / 2 ? 0 : Math.PI);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = 'rgba(31,23,20,0.78)';
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c4cacf'; ctx.lineWidth = 2; ctx.stroke();
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(29, 0); ctx.lineTo(21, -7); ctx.lineTo(21, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fbf8f1';
        ctx.font = font(700, 15);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy + 1);
      };
      if (b && (b.state === 'flight' || b.state === 'ground' || b.state === 'water' || b.state === 'gull')) {
        const dist = Math.abs(b.x - this.dog.x);
        const above = cam.sy(b.y, 0) < 70;
        ind(b.x, b.y, above && dist < 3 ? `↑${b.y.toFixed(1)}` : `${Math.round(dist)} m`, '#ffd166');
      }
      if (!b && this.hs !== 'throwing' && !this.dog.bone && Math.abs(this.dog.x - this.human.x) > 6) {
        ind(this.human.x, 1.0, `${Math.round(Math.abs(this.dog.x - this.human.x))} m`, '#e8e2d6');
      }
      // fumetto dell'umano
      if (this.bubble && this.bubble.text) {
        const h = this.human;
        const hc = h.sk.hc;
        const sx = cam.sx(h.x + h.facing * hc[0], h.z), sy = cam.sy(hc[1] + 0.2, h.z);
        ctx.font = font(600, 17);
        const tw = ctx.measureText(this.bubble.text).width;
        const bw = tw + 22, bh = 30;
        let bx = U.clamp(sx - bw / 2, 8, cam.W - bw - 8), by = Math.max(70, sy - bh - 14);
        ctx.globalAlpha = U.clamp(this.bubble.t * 4, 0, 1);
        ctx.fillStyle = 'rgba(251,248,241,0.96)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 9); else ctx.rect(bx, by, bw, bh);
        ctx.fill();
        ctx.beginPath();
        const tipX = U.clamp(sx, bx + 12, bx + bw - 12);
        ctx.moveTo(tipX - 7, by + bh); ctx.lineTo(tipX, by + bh + 10); ctx.lineTo(tipX + 7, by + bh); ctx.fill();
        ctx.fillStyle = '#1f1714';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bubble.text, bx + bw / 2, by + bh / 2 + 1);
        ctx.globalAlpha = 1;
      }
      // punteggi che salgono
      for (const p of this.popups) {
        const life = p.small ? 0.7 : 1.6;
        const k = p.t / life;
        const sx = cam.sx(p.x, 0), sy = cam.sy(p.y, 0) - k * 46;
        ctx.globalAlpha = U.clamp((1 - k) * 2.2, 0, 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        if (p.small) {
          ctx.font = font(700, 18);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(31,23,20,0.7)';
          ctx.strokeText(p.text, sx, sy);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, sx, sy);
        } else {
          const sc = 1 + Math.max(0, 0.25 - p.t) * 1.6;
          ctx.font = font(700, Math.round(34 * sc));
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(31,23,20,0.75)';
          ctx.strokeText(p.text, sx, sy);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, sx, sy);
          if (p.sub) {
            ctx.font = font(600, 17);
            ctx.lineWidth = 4;
            ctx.strokeText(p.sub, sx, sy + 22);
            ctx.fillStyle = '#fbf8f1';
            ctx.fillText(p.sub, sx, sy + 22);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    updateHud(force) {
      const ui = this.ui;
      const clock = this.modeName === 'tempo' ? fmtTime(this.time) : '●'.repeat(Math.max(0, this.lives)) + '○'.repeat(Math.max(0, 3 - this.lives));
      ui.hud({
        bones: this.bonesEaten, score: this.score, clock, clockLabel: this.modeName === 'tempo' ? 'Tempo' : 'Vite',
        stamina: this.dog.stamina, tired: this.dog.exhausted, wind: this.world.wind,
        low: this.modeName === 'tempo' && this.time < 15, streak: this.streak,
      }, force);
    }
  }

  function fmtTime(t) {
    const s = Math.ceil(t);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function setTimeoutGame(game, t, fn) {
    if (!game.timers) game.timers = [];
    game.timers.push({ t, fn });
  }

  OAV.Game = Game;
  OAV.fmtTime = fmtTime;
})();
