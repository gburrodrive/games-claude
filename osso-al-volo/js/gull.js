/* Osso al Volo — gabbiano reale mediterraneo (Larus michahellis) che ruba gli ossi */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const TAU = Math.PI * 2;

  class Gull {
    constructor(world, sfx) {
      this.world = world;
      this.sfx = sfx;
      this.active = false;
    }

    spawn(bone, side, bold = 0) {
      this.active = true;
      this.state = 'approach';
      this.target = bone;
      this.carry = null;
      this.bold = bold;
      this.x = bone.x + side * U.lerp(U.rand(13, 17), U.rand(6, 8), bold);
      this.y = U.lerp(U.rand(6, 8.5), U.rand(3.5, 5), bold);
      this.vx = -side * 5;
      this.vy = 0;
      this.facing = -side;
      this.flapPh = 0;
      this.flapping = true;
      this.t = 0;
      this.stateT = 0;
      this.walkPh = 0;
      this.dropped = false;
      this.sfx.gull(3);
    }

    // gabbiano già in volo sopra la spiaggia: segue l'osso e si tuffa quando tocca terra
    spawnHover(bone, side, bold) {
      this.spawn(bone, side, bold);
      this.state = 'hover';
      this.x = bone.x + side * U.rand(5, 8);
      this.y = U.rand(4.5, 6);
    }

    setState(s) { this.state = s; this.stateT = 0; }

    scare(game, byBark) {
      if (!this.active) return;
      const s = this.state;
      if (s === 'ground' || s === 'grab' || s === 'approach' || s === 'land') {
        this.setState('takeoff');
        this.sfx.gull(2);
      } else if ((s === 'takeoff' || s === 'leave') && this.carry && this.y < 2.6 && byBark) {
        // spaventato lascia cadere l'osso
        const b = this.carry;
        this.carry = null;
        b.launch(this.x + this.facing * 0.3, this.y - 0.05, this.vx * 0.6, this.vy * 0.3, U.rand(-6, 6));
        b.z = 0;
        this.dropped = true;
        game.onGullDrop(b);
        this.sfx.gull(1);
      }
    }

    update(dt, game) {
      if (!this.active) return;
      this.t += dt;
      this.stateT += dt;
      const w = this.world;
      const b = this.target;
      const dog = game.dog;
      const gh = w.groundH(this.x);
      const boneFree = b && (b.state === 'ground' || b.state === 'water');

      switch (this.state) {
        case 'hover': {
          if (!b || b.state === 'held' || b.state === 'gone' || b.state === 'gull') { this.setState('leave'); break; }
          if (b.state === 'ground' || b.state === 'water') { this.setState('approach'); break; }
          const tx = b.x + Math.sin(this.t * 1.3) * 1.6, ty = 4.2 + Math.sin(this.t * 0.8) * 0.5;
          const dx = tx - this.x, dy = ty - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = U.clamp(d * 1.5, 1.5, 9);
          this.vx = U.damp(this.vx, (dx / d) * sp, 2, dt);
          this.vy = U.damp(this.vy, (dy / d) * sp, 2, dt);
          this.facing = Math.sign(this.vx) || this.facing;
          this.flapping = this.vy > 0.2 || Math.sin(this.t * 1.7) > 0.3;
          break;
        }
        case 'approach': {
          if (!boneFree) { this.setState('leave'); break; }
          const side = Math.sign(this.x - b.x) || 1;
          const swoop = this.bold > 0.45;
          const tx = swoop ? b.x : b.x + side * 0.7, ty = swoop ? b.y + 0.05 : gh + 0.05;
          const dx = tx - this.x, dy = ty - this.y;
          const d = Math.hypot(dx, dy);
          const sp = U.clamp(d * 1.2, 2.2, 6.5 + this.bold * 3);
          this.vx = U.damp(this.vx, (dx / d) * sp, 2.2, dt);
          this.vy = U.damp(this.vy, (dy / d) * sp, 2.2, dt);
          this.facing = Math.sign(this.vx) || this.facing;
          this.flapping = d < 2.5 || this.vy > -0.5;
          // il cane è già sull'osso: il gabbiano rinuncia
          if (Math.abs(dog.x - b.x) < 0.9 && d < 2.5) { this.scare(game, false); break; }
          // i gabbiani esperti afferrano l'osso in volo radente senza posarsi
          if (this.bold > 0.45 && Math.hypot(b.x - this.x, b.y - this.y) < 0.55) {
            this.carry = b;
            b.state = 'gull';
            this.setState('takeoff');
            this.sfx.gull(1);
            break;
          }
          if (d < 0.35) { this.setState('ground'); this.y = gh; this.vx = 0; this.vy = 0; }
          break;
        }
        case 'ground': {
          if (!boneFree) { this.setState('takeoff'); break; }
          this.y = gh;
          const dx = b.x - this.x;
          this.facing = Math.sign(dx) || this.facing;
          if (Math.abs(dx) > 0.26) {
            this.vx = Math.sign(dx) * 0.9;
            this.walkPh += dt * 7;
          } else {
            this.vx = 0;
            this.setState('grab');
          }
          break;
        }
        case 'grab': {
          this.vx = 0;
          if (!boneFree) { this.setState('takeoff'); break; }
          if (this.stateT > 0.35 - this.bold * 0.15) {
            this.carry = b;
            b.state = 'gull';
            this.setState('takeoff');
            this.sfx.gull(1);
          }
          break;
        }
        case 'takeoff': {
          const away = Math.sign(this.x - dog.x) || 1;
          this.facing = away;
          this.vx = U.damp(this.vx, away * 3.4, 3, dt);
          this.vy = U.damp(this.vy, 2.6, 4, dt);
          this.flapping = true;
          if (this.y > gh + 1.6) this.setState('leave');
          break;
        }
        case 'leave': {
          const away = Math.sign(this.vx) || this.facing;
          this.vx = U.damp(this.vx, away * 7, 1.5, dt);
          this.vy = U.damp(this.vy, 1.6, 1.5, dt);
          this.flapping = Math.sin(this.t * 0.9) > -0.4;
          if (Math.abs(this.x - game.cam.x) > 30 || this.y > 14) {
            this.active = false;
            if (this.carry) {
              const bb = this.carry;
              this.carry = null;
              bb.state = 'gone';
              game.onBoneLost(bb, 'gull');
            }
          }
          break;
        }
      }
      this.x += this.vx * dt;
      if (this.state !== 'ground' && this.state !== 'grab') this.y += this.vy * dt;
      if (this.y < gh) this.y = gh;
      if (this.carry) {
        this.carry.x = this.x + this.facing * 0.3;
        this.carry.y = this.y + 0.02;
        this.carry.z = 0;
      }
      this.flapPh += dt * TAU * (this.flapping ? 3.1 : 0);

      // il cane si avvicina: il gabbiano scappa
      if (this.state === 'ground' || this.state === 'grab') {
        const dd = Math.abs(dog.x - this.x);
        const charging = Math.sign(this.x - dog.x) === Math.sign(dog.vx) && Math.abs(dog.vx) > 2.5;
        const bold = this.bold || 0;
        if (dd < (charging ? 2.6 - bold * 1.2 : 1.5 - bold * 0.6)) this.scare(game, false);
      }
    }

    draw(ctx, cam) {
      if (!this.active) return;
      const s = cam.scale(0);
      const sx = cam.sx(this.x, 0), sy = cam.sy(this.y, 0);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s * this.facing, -s);
      const flying = !(this.state === 'ground' || this.state === 'grab');
      if (flying) this.drawFlying(ctx); else this.drawStanding(ctx);
      ctx.restore();
    }

    wing(ctx, ang, far) {
      // ala vista di lato: l'apertura punta verso la camera, quindi si vede scorciata;
      // il polso è a metà apertura e la punta è stretta e spazzata all'indietro
      const span = 0.7;
      const sy = Math.sin(ang), cy = Math.cos(ang);
      const wristY = 0.03 + sy * span * 0.45, tipY = 0.03 + sy * span;
      const sweep = 0.05 + (1 - Math.abs(cy)) * 0.04;
      const root = [[0.085, 0.03], [-0.085, 0.025]];
      const wrist = [[0.035, wristY], [-0.055, wristY - 0.01 * Math.sign(sy || 1)]];
      const tip = [-0.07 - sweep, tipY];
      ctx.fillStyle = far ? '#8a939b' : '#adb6be';
      ctx.beginPath();
      ctx.moveTo(root[0][0], root[0][1]);
      ctx.quadraticCurveTo(0.07, (root[0][1] + wristY) / 2, wrist[0][0], wrist[0][1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(wrist[1][0], wrist[1][1]);
      ctx.quadraticCurveTo(-0.1, (root[1][1] + wristY) / 2, root[1][0], root[1][1]);
      ctx.closePath();
      ctx.fill();
      // punta nera con specchio bianco
      const k = 0.55;
      ctx.fillStyle = '#16181a';
      ctx.beginPath();
      ctx.moveTo(U.lerp(wrist[0][0], tip[0], k), U.lerp(wrist[0][1], tip[1], k));
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(U.lerp(wrist[1][0], tip[0], k), U.lerp(wrist[1][1], tip[1], k));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4f4f2';
      ctx.beginPath();
      ctx.arc(U.lerp(wrist[0][0], tip[0], 0.82) - 0.004, U.lerp(wrist[0][1], tip[1], 0.82), 0.009, 0, TAU);
      ctx.fill();
      // bordo d'uscita bianco tipico del gabbiano reale
      if (!far) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(root[1][0], root[1][1]);
        ctx.lineTo(wrist[1][0], wrist[1][1]);
        ctx.stroke();
      }
    }

    drawFlying(ctx) {
      const ang = this.flapping ? 0.25 + Math.sin(this.flapPh) * 0.85 : 0.18;
      ctx.save();
      ctx.rotate(U.clamp(Math.atan2(this.vy, Math.abs(this.vx) + 0.5) * 0.4, -0.4, 0.4));
      this.wing(ctx, ang + 0.1, true);
      // corpo
      ctx.fillStyle = '#f5f5f2';
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.21, 0.062, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.18, 0.02); ctx.lineTo(-0.31, 0.01); ctx.lineTo(-0.3, -0.025); ctx.lineTo(-0.17, -0.03); ctx.fill();
      ctx.fillStyle = '#b9c1c8';
      ctx.beginPath();
      ctx.ellipse(-0.02, 0.035, 0.16, 0.03, 0, 0, TAU);
      ctx.fill();
      this.head(ctx, 0.2, 0.03);
      this.wing(ctx, ang, false);
      ctx.restore();
      if (this.carry) this.drawCarry(ctx);
    }

    drawStanding(ctx) {
      const bob = this.state === 'ground' ? Math.abs(Math.sin(this.walkPh)) * 0.012 : 0;
      const peck = this.state === 'grab' ? Math.sin(Math.min(1, this.stateT / 0.35) * Math.PI) : 0;
      // zampe gialle
      ctx.strokeStyle = '#e1b93c';
      ctx.lineWidth = 0.012;
      const st = this.state === 'ground' ? Math.sin(this.walkPh) * 0.04 : 0;
      ctx.beginPath();
      ctx.moveTo(-0.01, 0.13); ctx.lineTo(-0.01 + st, 0.0);
      ctx.moveTo(0.02, 0.13); ctx.lineTo(0.02 - st, 0.0);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, bob - 0.07);
      ctx.fillStyle = '#f5f5f2';
      ctx.beginPath();
      ctx.ellipse(0, 0.27, 0.17, 0.085, -0.15, 0, TAU);
      ctx.fill();
      // ali ripiegate grigie con punte nere oltre la coda
      ctx.fillStyle = '#aab3bb';
      ctx.beginPath();
      ctx.moveTo(0.1, 0.31);
      ctx.quadraticCurveTo(-0.02, 0.36, -0.2, 0.3);
      ctx.lineTo(-0.27, 0.27);
      ctx.quadraticCurveTo(-0.08, 0.25, 0.1, 0.27);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#16181a';
      ctx.beginPath();
      ctx.moveTo(-0.17, 0.3); ctx.lineTo(-0.3, 0.27); ctx.lineTo(-0.16, 0.27); ctx.fill();
      ctx.restore();
      const hx = 0.15 + peck * 0.06, hy = 0.3 - peck * 0.17 + bob;
      ctx.fillStyle = '#f5f5f2';
      ctx.beginPath();
      U.taper(ctx, 0.1, 0.23 + bob, 0.05, hx, hy, 0.04);
      ctx.fill();
      this.head(ctx, hx, hy, -peck * 0.9);
    }

    head(ctx, x, y, rot = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#f7f7f4';
      ctx.beginPath();
      ctx.arc(0, 0, 0.045, 0, TAU);
      ctx.fill();
      // becco giallo con macchia rossa
      ctx.fillStyle = '#efc63b';
      ctx.beginPath();
      ctx.moveTo(0.035, 0.012); ctx.lineTo(0.105, 0.0); ctx.quadraticCurveTo(0.112, -0.012, 0.1, -0.016); ctx.lineTo(0.035, -0.012);
      ctx.fill();
      ctx.fillStyle = '#d6372f';
      ctx.beginPath(); ctx.arc(0.088, -0.011, 0.006, 0, TAU); ctx.fill();
      ctx.fillStyle = '#121212';
      ctx.beginPath(); ctx.arc(0.012, 0.012, 0.0075, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e7a52f';
      ctx.beginPath(); ctx.arc(0.012, 0.012, 0.0035, 0, TAU); ctx.fill();
      ctx.restore();
    }

    drawCarry(ctx) {
      ctx.save();
      ctx.translate(0.3, 0.0);
      ctx.rotate(-0.2);
      ctx.scale(0.8, 1);
      OAV.drawBoneShape(ctx, this.carry.def, 1, false);
      ctx.restore();
    }
  }

  OAV.Gull = Gull;
})();
