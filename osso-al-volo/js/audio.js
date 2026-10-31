/* Osso al Volo — suoni sintetizzati con Web Audio (nessun file esterno) */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;

  class Sfx {
    constructor() {
      this.ctx = null;
      this.muted = U.lsGet('oav.muted', false);
      this.master = null;
      this.ambGain = null;
      this.swashGain = null;
      this.lastPant = 0;
    }

    init() {
      if (this.ctx) { this.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) { this.ctx = null; return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);

      // buffer di rumore bianco e marrone
      const len = c.sampleRate * 2;
      this.white = c.createBuffer(1, len, c.sampleRate);
      const w = this.white.getChannelData(0);
      for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
      this.brown = c.createBuffer(1, len, c.sampleRate);
      const b = this.brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        b[i] = last * 3.5;
      }
      this.startAmbience();
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setMuted(m) {
      this.muted = m;
      U.lsSet('oav.muted', m);
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }

    noise(buf = 'white') {
      const s = this.ctx.createBufferSource();
      s.buffer = buf === 'brown' ? this.brown : this.white;
      s.loop = true;
      s.loopStart = Math.random();
      return s;
    }

    env(gainNode, t0, a, peak, d) {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(peak, t0 + a);
      g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }

    startAmbience() {
      const c = this.ctx;
      // risacca continua
      const n = this.noise('brown');
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      this.ambGain = c.createGain();
      this.ambGain.gain.value = 0.16;
      n.connect(lp).connect(this.ambGain).connect(this.master);
      n.start();
      // fruscio della battigia, modulato dal gioco
      const n2 = this.noise('white');
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.6;
      this.swashGain = c.createGain();
      this.swashGain.gain.value = 0.0;
      n2.connect(bp).connect(this.swashGain).connect(this.master);
      n2.start();
      // vento leggero
      const n3 = this.noise('white');
      const hp = c.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 600;
      hp.Q.value = 0.4;
      this.windGain = c.createGain();
      this.windGain.gain.value = 0.015;
      n3.connect(hp).connect(this.windGain).connect(this.master);
      n3.start();
    }

    setSwash(v, wind) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.swashGain.gain.setTargetAtTime(U.clamp(v, 0, 1) * 0.07, t, 0.15);
      this.windGain.gain.setTargetAtTime(0.01 + Math.abs(wind) * 0.006, t, 0.5);
    }

    // abbaio di cane piccolo: "yap" acuto con formanti
    bark(pitch = 1, double = false) {
      if (!this.ctx) return;
      const c = this.ctx;
      const doOne = (t0, p) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        const f = o.frequency;
        f.setValueAtTime(620 * p, t0);
        f.linearRampToValueAtTime(980 * p, t0 + 0.025);
        f.linearRampToValueAtTime(640 * p, t0 + 0.09);
        f.linearRampToValueAtTime(430 * p, t0 + 0.15);
        const f1 = c.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.value = 1350 * p; f1.Q.value = 2.5;
        const f2 = c.createBiquadFilter();
        f2.type = 'bandpass'; f2.frequency.value = 2900 * p; f2.Q.value = 3.5;
        const g = c.createGain();
        this.env(g, t0, 0.008, 0.9, 0.15);
        const g2 = c.createGain();
        g2.gain.value = 0.5;
        o.connect(f1).connect(g);
        o.connect(f2).connect(g2).connect(g);
        g.connect(this.master);
        o.start(t0); o.stop(t0 + 0.2);
        // respiro iniziale
        const n = this.noise();
        const nb = c.createBiquadFilter();
        nb.type = 'bandpass'; nb.frequency.value = 2200; nb.Q.value = 1.2;
        const ng = c.createGain();
        this.env(ng, t0, 0.005, 0.25, 0.06);
        n.connect(nb).connect(ng).connect(this.master);
        n.start(t0); n.stop(t0 + 0.1);
      };
      const t = c.currentTime + 0.01;
      doOne(t, pitch);
      if (double) doOne(t + 0.17, pitch * 1.04);
    }

    crunch(strength = 1) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime;
      const clicks = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < clicks; i++) {
        const t0 = t + i * U.rand(0.012, 0.03);
        const n = this.noise();
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = U.rand(1500, 3800);
        bp.Q.value = U.rand(1.5, 4);
        const g = c.createGain();
        this.env(g, t0, 0.002, 0.35 * strength, U.rand(0.02, 0.05));
        n.connect(bp).connect(g).connect(this.master);
        n.start(t0); n.stop(t0 + 0.08);
      }
    }

    chomp() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      const g = c.createGain();
      this.env(g, t, 0.003, 0.5, 0.07);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.1);
      this.crunch(0.8);
    }

    thud(intensity = 1, wet = false) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
      const g = c.createGain();
      this.env(g, t, 0.004, 0.45 * intensity, 0.1);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.15);
      const n = this.noise();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = wet ? 900 : 500;
      const ng = c.createGain();
      this.env(ng, t, 0.003, 0.3 * intensity, 0.08);
      n.connect(lp).connect(ng).connect(this.master);
      n.start(t); n.stop(t + 0.12);
    }

    splash(intensity = 1) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const n = this.noise();
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 700;
      const g = c.createGain();
      this.env(g, t, 0.006, 0.4 * intensity, 0.28);
      n.connect(hp).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.4);
    }

    whoosh(speed = 1) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const n = this.noise();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(1800 * speed, t + 0.12);
      bp.frequency.exponentialRampToValueAtTime(700, t + 0.32);
      const g = c.createGain();
      this.env(g, t, 0.06, 0.28, 0.26);
      n.connect(bp).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.4);
    }

    // verso del gabbiano reale (Larus michahellis): "kiau kiau"
    gull(count = 3) {
      if (!this.ctx) return;
      const c = this.ctx;
      let t = c.currentTime + 0.02;
      for (let i = 0; i < count; i++) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        const base = U.rand(820, 920);
        o.frequency.setValueAtTime(base, t);
        o.frequency.linearRampToValueAtTime(base * 1.45, t + 0.06);
        o.frequency.linearRampToValueAtTime(base * 1.1, t + 0.28);
        const vib = c.createOscillator();
        vib.frequency.value = 26;
        const vg = c.createGain();
        vg.gain.value = 35;
        vib.connect(vg).connect(o.frequency);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 4;
        const g = c.createGain();
        this.env(g, t, 0.02, 0.22, 0.3);
        o.connect(bp).connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.36);
        vib.start(t); vib.stop(t + 0.36);
        t += U.rand(0.3, 0.42);
      }
    }

    whistle() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + 0.01;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1700, t);
      o.frequency.linearRampToValueAtTime(2600, t + 0.22);
      o.frequency.setValueAtTime(2000, t + 0.3);
      o.frequency.linearRampToValueAtTime(2900, t + 0.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      g.gain.setValueAtTime(0.18, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.02, t + 0.27);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.32);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.6);
    }

    chime(level = 1) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const notes = level >= 2 ? [784, 988, 1319] : [784, 1175];
      notes.forEach((f, i) => {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = c.createGain();
        this.env(g, t + i * 0.07, 0.005, 0.12, 0.35);
        o.connect(g).connect(this.master);
        o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.45);
      });
    }

    waveCrash(intensity = 1) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const n = this.noise('white');
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1600, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + 1.6);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 * intensity, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      n.connect(lp).connect(g).connect(this.master);
      n.start(t); n.stop(t + 2);
    }

    pant(tired) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      if (t - this.lastPant < 0.2) return;
      this.lastPant = t;
      const n = this.noise();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = U.rand(1100, 1500);
      bp.Q.value = 1.1;
      const g = c.createGain();
      this.env(g, t, 0.02, 0.05 + 0.08 * tired, 0.09);
      n.connect(bp).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.14);
    }

    laugh() {
      if (!this.ctx) return;
      const c = this.ctx;
      let t = c.currentTime + 0.01;
      for (let i = 0; i < 3; i++) {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(190 - i * 8, t);
        o.frequency.linearRampToValueAtTime(150, t + 0.09);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
        const g = c.createGain();
        this.env(g, t, 0.01, 0.16, 0.09);
        o.connect(bp).connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.14);
        t += 0.14;
      }
    }
  }

  OAV.Sfx = Sfx;
})();
